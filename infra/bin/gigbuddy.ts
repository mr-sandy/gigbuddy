#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/stacks/api-stack.js';
import { CiStack } from '../lib/stacks/ci-stack.js';
import { DataStack } from '../lib/stacks/data-stack.js';
import { ObservabilityStack } from '../lib/stacks/observability-stack.js';
import { WebCertStack } from '../lib/stacks/web-cert-stack.js';
import { WebStack } from '../lib/stacks/web-stack.js';

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
if (!account) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT is not set. ' +
      'Run: export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)',
  );
}
const region = 'eu-west-2';
const usEast1 = 'us-east-1';

// Subdomain + apex zone are public DNS facts and live as literals in the repo.
const subdomain = 'gig.cormie.com';
const hostedZoneName = 'cormie.com';

// Per-environment secret-ish context lives in the gitignored infra/cdk.context.json.
// See infra/runbooks/bootstrap.md for the template.
const hostedZoneId = app.node.tryGetContext('hostedZoneId') as string | undefined;
const githubOwner = app.node.tryGetContext('githubOwner') as string | undefined;
const budgetEmail = app.node.tryGetContext('budgetEmail') as string | undefined;

const missing: string[] = [];
if (!hostedZoneId) missing.push('hostedZoneId');
if (!githubOwner) missing.push('githubOwner');
if (!budgetEmail) missing.push('budgetEmail');
if (missing.length > 0) {
  throw new Error(
    `Missing CDK context value(s): ${missing.join(', ')}. ` +
      'Set them in infra/cdk.context.json (see infra/runbooks/bootstrap.md) ' +
      'or pass them on the command line as `-c <key>=<value>`.',
  );
}

const env = { account, region };

const data = new DataStack(app, 'GigbuddyData', { env, terminationProtection: true });

const api = new ApiStack(app, 'GigbuddyApi', {
  env,
  table: data.table,
});

const cert = new WebCertStack(app, 'GigbuddyWebCert', {
  env: { account, region: usEast1 },
  crossRegionReferences: true,
  subdomain,
  hostedZoneId: hostedZoneId as string,
  hostedZoneName,
});

new WebStack(app, 'GigbuddyWeb', {
  env,
  crossRegionReferences: true,
  subdomain,
  hostedZoneId: hostedZoneId as string,
  hostedZoneName,
  certificateArn: cert.certificateArn,
  wafArn: cert.wafArn,
  lambdaFunctionArn: api.functionArn,
  lambdaFunctionUrlDomain: api.functionUrlDomain,
});

new ObservabilityStack(app, 'GigbuddyObservability', {
  env,
  budgetEmail: budgetEmail as string,
});

new CiStack(app, 'GigbuddyCi', {
  env,
  githubOwner: githubOwner as string,
  tableArn: data.table.tableArn,
});
