import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import {Construct} from "constructs";
import {DomainDelegationConstruct} from './constructs/domain_delegation_construct';
import {Secret, ISecret} from "aws-cdk-lib/aws-secretsmanager";
import {Policy, PolicyStatement} from "aws-cdk-lib/aws-iam";
import {Schedule} from "aws-cdk-lib/aws-events";

export interface PresetHostedZoneAndCertificate {
    readonly hostedZoneId: string;
    readonly certificateArn: string;
    readonly hostedZoneName: string;
}

export interface FargateServiceStackProps extends cdk.StackProps {
    readonly vpc: ec2.IVpc;
    readonly servicePrefix: string;
    readonly serviceName: string;
    readonly rootHostedZoneID: string;
    readonly rootHostedZoneName: string;
    readonly rootHostedZoneAccountID: string;
    readonly rootHostedZoneNameServers: Array<string>;
    readonly childHostedZoneName: string;
    readonly childHostedZoneAccountId: string;
    readonly healthCheckPath: string;
    readonly cpu: number;
    readonly memory: number;
    readonly minCapacity: number;
    readonly maxCapacity: number;
    readonly dockerFileName: string;
    readonly packagePath: string;
    readonly servicePort: number;

    readonly presetHostedZoneCertificate?: PresetHostedZoneAndCertificate;
}

export class FargateServiceStack extends cdk.Stack {
    public readonly externalSecuredPort: number = 443;

    constructor(scope: Construct, id: string, props: FargateServiceStackProps) {
        super(scope, id, props);

        let hostedZoneDelegationConstruct: any;
        if (props.presetHostedZoneCertificate) {
            hostedZoneDelegationConstruct = {
                hostedZone: route53.HostedZone.fromHostedZoneAttributes(
                    this,
                    `${props.servicePrefix}DomainDelegation`, {
                        hostedZoneId: props.presetHostedZoneCertificate.hostedZoneId,
                        zoneName: props.presetHostedZoneCertificate.hostedZoneName
                    })
            }
        } else {
            hostedZoneDelegationConstruct = new DomainDelegationConstruct(this, `${props.servicePrefix}DomainDelegation`, {
                servicePrefix: props.servicePrefix,
                serviceName: props.serviceName,
                rootHostedZoneId: props.rootHostedZoneID,
                rootHostedZoneName: props.rootHostedZoneName,
                rootHostedZoneAccountId: props.rootHostedZoneAccountID,
                rootHostedZoneNameServers: props.rootHostedZoneNameServers,
                childHostedZoneName: props.childHostedZoneName,
                childHostedZomeAccountId: props.childHostedZoneAccountId
            });
        }

        //Create Certificate
        let siteCertificate: acm.ICertificate;
        if (props.presetHostedZoneCertificate) {
            siteCertificate = acm.Certificate.fromCertificateArn(this, `${props.servicePrefix}Certificate`,
                props.presetHostedZoneCertificate.certificateArn);
        } else {
            siteCertificate = new acm.Certificate(this, `${props.servicePrefix}Certificate`, {
                domainName: props.childHostedZoneName,
                validation: acm.CertificateValidation.fromDns(hostedZoneDelegationConstruct.hostedZone),
            });
        }

        const cluster = new ecs.Cluster(this, `${props.servicePrefix}Cluster`, {
            vpc: props.vpc
        });


        const securityGroup = new ec2.SecurityGroup(this, `${props.servicePrefix}SecurityGroup`, {
            vpc: props.vpc,
            allowAllOutbound: true,
            description: "Default security group for UI services",
        });
        securityGroup.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(props.servicePort),
            `Allow service request to enter through port ${props.servicePort}`
        );
        securityGroup.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(this.externalSecuredPort),
            `Allow service request to enter through port ${this.externalSecuredPort}`
        );
        securityGroup.addIngressRule(
            ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
            ec2.Port.allTcp(),
            `Allow service request to enter through within VPC`
        );

        const taskDefinition = new ecs.FargateTaskDefinition(this, `${props.servicePrefix}TaskDefinition`, {
            cpu: props.cpu,
            memoryLimitMiB: props.memory
        });

        // For local testing, assume that all package folders are at the same level
        // For pipeline deployment packages will be within CDK folder
        let filePath = props.packagePath;
        if (process.env.DEPLOYMENT_ENV !== undefined && process.env.DEPLOYMENT_ENV == 'local') {
            filePath = `../${filePath}`
        }

        const image = ecs.ContainerImage.fromAsset(filePath, {
            file: props.dockerFileName,
            invalidation: {
                file: true
            }
        });

        const containerDefinition = taskDefinition.addContainer(`${props.servicePrefix}Container`, {
            image: image,
            // logging: ecs.AwsLogDriver.awsLogs({
            //     streamPrefix: props.serviceName,
            //     logRetention: logs.RetentionDays.TWO_WEEKS,
            //     mode: ecs.AwsLogDriverMode.NON_BLOCKING
            // }),
        });
        containerDefinition.addPortMappings({
            containerPort: props.servicePort,
            hostPort: props.servicePort,
            protocol: ecs.Protocol.TCP
        });

        // Create a load-balanced Fargate service and make it public
        const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, `${props.servicePrefix}FargateService`, {
            assignPublicIp: true,
            certificate: siteCertificate,
            cluster: cluster, // Required
            taskDefinition: taskDefinition,
            listenerPort: this.externalSecuredPort,
            publicLoadBalancer: true, // Default is false
            protocol: elb.ApplicationProtocol.HTTPS,
            targetProtocol: elb.ApplicationProtocol.HTTP,
            securityGroups: [securityGroup],
            serviceName: `${props.servicePrefix}FargateService`
        });

        fargateService.targetGroup.configureHealthCheck({
            enabled: true,
            path: props.healthCheckPath,
            port: `${props.servicePort}`,
            protocol: elb.Protocol.HTTP,
            timeout: cdk.Duration.seconds(5)
        });

        const scaling = fargateService.service.autoScaleTaskCount({maxCapacity: props.maxCapacity, minCapacity: props.minCapacity});
        scaling.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 50,
            scaleInCooldown: cdk.Duration.seconds(10),
            scaleOutCooldown: cdk.Duration.seconds(10)
        });

        scaling.scaleOnMemoryUtilization('MemoryScaling', {
            targetUtilizationPercent: 50,
            scaleInCooldown: cdk.Duration.seconds(10),
        });

        //Create A Record Custom Domain to CloudFront CDN
        new route53.ARecord(this, `${props.servicePrefix}Record`, {
            recordName: props.presetHostedZoneCertificate ? props.presetHostedZoneCertificate.hostedZoneName : props.childHostedZoneName,
            target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(fargateService.loadBalancer)),
            zone: hostedZoneDelegationConstruct.hostedZone
        });
    }
}