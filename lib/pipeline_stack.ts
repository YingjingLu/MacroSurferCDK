import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, DockerCredential, ShellStep } from 'aws-cdk-lib/pipelines';
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { STAGE_LIST } from './deployment/stage_config';
import { AppStage } from './deployment/app_stage';
import { CDK_REPO, CODE_STAR_CONNECTION, REPO_LIST } from './deployment/repo_config';
import { SERVICE_PREFIX } from './deployment/service_config';
import {
  PIPELINE_DOCKERHUB_SECRET_ARN
} from "./deployment/pipeline_config";
import { Bucket } from "aws-cdk-lib/aws-s3";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import { BuildSpec, ComputeType } from "aws-cdk-lib/aws-codebuild";

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    let additionalRepoInputs: any = {};
    for (const repoConfig of REPO_LIST) {
      additionalRepoInputs[repoConfig.repoName] = CodePipelineSource.connection(repoConfig.repoString, repoConfig.repoBranch, {
        connectionArn: CODE_STAR_CONNECTION
      });
    }

    const dockerHubSecret = Secret.fromSecretCompleteArn(this, 'DHSecret', PIPELINE_DOCKERHUB_SECRET_ARN);

    const buildCacheBucket = new Bucket(this, 'CodeBuildCacheBucket');

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: `${SERVICE_PREFIX}Pipeline`,
      dockerCredentials: [
        DockerCredential.dockerHub(dockerHubSecret),
      ],
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(CDK_REPO.repoString, CDK_REPO.repoBranch, {
          connectionArn: CODE_STAR_CONNECTION
        }),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
        additionalInputs: additionalRepoInputs,
      }),
      // If deploying locally, use false, commit true
      selfMutation: true,
      assetPublishingCodeBuildDefaults: {
        cache: codebuild.Cache.bucket(buildCacheBucket),
        buildEnvironment: {
          computeType: ComputeType.MEDIUM
        }
      },
      codeBuildDefaults: {
        partialBuildSpec: BuildSpec.fromObject({
          env: {
            'secrets-manager': {
              // Placeholder just to illustrate how this is used
              // 'SSH_PUBLIC_KEY_FE': FRONTEND_SSH_PUBLIC_KEY_ARN,
            }
          }
        })
      }
    });

    for (const stageConfig of STAGE_LIST) {
      pipeline.addStage(new AppStage(this, `Stage${stageConfig.name}`, {
        env: { account: stageConfig.account, region: stageConfig.region },
        stageName: stageConfig.name,
        repoConfigList: REPO_LIST
      }));
    }
  }
}