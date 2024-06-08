import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface SubDomainProps {
    readonly servicePrefix: string;
    readonly serviceName: string;
    readonly rootHostedZoneId: string;
    readonly rootHostedZoneName: string;
    readonly rootHostedZoneAccountId: string;
    readonly rootHostedZoneNameServers: Array<string>;
    readonly childHostedZoneName: string;
    readonly childHostedZomeAccountId: string;
}

export class DomainDelegationConstruct extends Construct {
    public readonly hostedZone: route53.IHostedZone;
    constructor(scope: Construct, id: string, props: SubDomainProps) {
        super(scope, id);

        this.hostedZone = new route53.HostedZone(this, `${props.serviceName}HostedZone`, {
            zoneName: props.childHostedZoneName
        });
        
        if (props.rootHostedZoneAccountId !== props.childHostedZomeAccountId) {
            const parentDelegationRole = iam.Role.fromRoleArn(
                scope, 
                `${props.serviceName}DelegationRole`,
                    `arn:aws:iam::${props.rootHostedZoneAccountId}:role/${props.servicePrefix}HostedZoneDelegationRole`
            );
            new route53.CrossAccountZoneDelegationRecord(scope, `${props.serviceName}CrossAccountDelegationRecord`, {
                delegatedZone: this.hostedZone,
                delegationRole: parentDelegationRole,
                parentHostedZoneId: props.rootHostedZoneId,
                removalPolicy: cdk.RemovalPolicy.DESTROY
            });
        } else {
            console.log("Got hosted zone id", props.rootHostedZoneId)
            new route53.ZoneDelegationRecord(scope, `${props.serviceName}DelegationRecord`, {
                zone: route53.HostedZone.fromHostedZoneAttributes(this, `RootHostedZoneId`, {
                    hostedZoneId: props.rootHostedZoneId,
                    zoneName: props.rootHostedZoneName
                }),
                nameServers: this.hostedZone.hostedZoneNameServers!,
                recordName: props.childHostedZoneName
            })
        }
    }
}