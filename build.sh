#!/bin/bash

. ./env-config.sh

export DEPLOYMENT_ENV='local'

echo '>>> Start npm run build'
npm run build

echo '>>> Start CDK run synth'
npx cdk synth

echo '>>> Start CDK bootstrap'
npx cdk bootstrap

echo '>>> Start CDK deploy'
npx cdk deploy --all --require-approval never
