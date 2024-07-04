import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { VpcStack } from '../vpc_stack';
import { FargateServiceStack } from '../fargate_service_stack';
import { SERVICE_PREFIX } from './service_config';
import { ROOT_DOMAIN, ROOT_DOMAIN_NAME_SERVER, ROOT_HOSTED_ZONE_ID, ROOT_HOSTED_ZONE_ACCOUNT_ID } from './domain_config';
import { RepoConfig } from './repo_config';
export interface AppStageProp extends cdk.StageProps {
  readonly stageName: string;
  readonly repoConfigList: Array<RepoConfig>;
}

export class AppStage extends cdk.Stage {

  constructor(scope: Construct, id: string, props: AppStageProp) {
    super(scope, id, props);

    const vpcStack = new VpcStack(this, `${SERVICE_PREFIX}VpcStack-${props?.stageName}`, {
      servicePrefix: SERVICE_PREFIX,
      stage: props?.stageName
    });
    const backendStack = new FargateServiceStack(this, `${SERVICE_PREFIX}Backend-${props?.stageName}`, {
      vpc: vpcStack.vpc,
      servicePrefix: SERVICE_PREFIX,
      serviceName: `${SERVICE_PREFIX}Backend`,
      rootHostedZoneName: ROOT_DOMAIN,
      rootHostedZoneID: ROOT_HOSTED_ZONE_ID,
      rootHostedZoneAccountID: ROOT_HOSTED_ZONE_ACCOUNT_ID,
      rootHostedZoneNameServers: ROOT_DOMAIN_NAME_SERVER,
      childHostedZoneName: this.getDomainNameFromStage("service", ROOT_DOMAIN, props?.stageName),
      childHostedZoneAccountId: props!.env!.account!,
      healthCheckPath: "/health/ping",
      cpu: 512,
      memory: 2048,
      minCapacity: this.isProdStage(props?.stageName) ? 1 : 1,
      maxCapacity: 1,
      dockerFileName: this.isProdStage(props?.stageName) ? "Dockerfile.prod" : "Dockerfile.devo",
      packagePath: props.repoConfigList[1].repoName,
      servicePort: 8000
    });

    backendStack.addDependency(vpcStack);
  }

  isProdStage(stageName: string): boolean {
    return stageName === "prod";
  }

  getDomainNameFromStage(baseSubDomainName: string, rootDomainName: string, stageName: string): string {
    if (this.isProdStage(stageName)) {
      return `${baseSubDomainName}.${rootDomainName}`;
    } else {
      return `${baseSubDomainName}-${stageName}.${rootDomainName}`;
    }
  }
}