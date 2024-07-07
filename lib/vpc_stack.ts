import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";

export interface VpcStackProps extends cdk.StackProps {
    readonly servicePrefix: string;
    readonly stage: string;
}

export class VpcStack extends cdk.Stack {
    public readonly vpc: ec2.IVpc;
    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);
        this.vpc = new ec2.Vpc(this, `${props.servicePrefix}Vpc-${props.stage}`, {
            vpcName: `${props.servicePrefix}VPC-${props.stage}`,
            // only create 1 az to save money
            maxAzs: 1,
        });
    }
}
