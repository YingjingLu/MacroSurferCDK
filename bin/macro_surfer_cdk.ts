#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline_stack';

const app = new cdk.App();
new PipelineStack(app, 'MacroSurferPipelineStack', {
  env: {
    account: '372183484622',
    region: 'us-west-2',
  }
});

app.synth();