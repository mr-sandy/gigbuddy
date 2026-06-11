import { App } from 'aws-cdk-lib';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/stacks/api-stack.js';
import { CiStack } from '../lib/stacks/ci-stack.js';
import { DataStack } from '../lib/stacks/data-stack.js';
import { ObservabilityStack } from '../lib/stacks/observability-stack.js';
import { WebCertStack } from '../lib/stacks/web-cert-stack.js';
import { WebStack } from '../lib/stacks/web-stack.js';

describe('CDK App composition', () => {
  it('synthesizes all six stacks with stubbed context values', () => {
    const app = new App({
      context: {
        hostedZoneId: 'Z0000000000000000000',
        githubOwner: 'test-owner',
        budgetEmail: 'test@example.com',
      },
    });

    const account = '111111111111';
    const region = 'eu-west-2';
    const usEast1 = 'us-east-1';
    const subdomain = 'gig.cormie.com';
    const hostedZoneName = 'cormie.com';
    const env = { account, region };

    const data = new DataStack(app, 'GigbuddyData', { env });
    const api = new ApiStack(app, 'GigbuddyApi', { env, table: data.table });
    const cert = new WebCertStack(app, 'GigbuddyWebCert', {
      env: { account, region: usEast1 },
      crossRegionReferences: true,
      subdomain,
      hostedZoneId: 'Z0000000000000000000',
      hostedZoneName,
    });
    new WebStack(app, 'GigbuddyWeb', {
      env,
      crossRegionReferences: true,
      subdomain,
      hostedZoneId: 'Z0000000000000000000',
      hostedZoneName,
      certificateArn: cert.certificateArn,
      wafArn: cert.wafArn,
      lambdaFunctionArn: api.functionArn,
      lambdaFunctionUrlDomain: api.functionUrlDomain,
    });
    new ObservabilityStack(app, 'GigbuddyObservability', { env, budgetEmail: 'test@example.com' });
    new CiStack(app, 'GigbuddyCi', {
      env,
      githubOwner: 'test-owner',
      tableArn: data.table.tableArn,
    });

    expect(() => app.synth()).not.toThrow();
  });

  it('throws when required context values are missing', () => {
    const appNoCtx = new App();
    expect(() => {
      const hostedZoneId = appNoCtx.node.tryGetContext('hostedZoneId') as string | undefined;
      const githubOwner = appNoCtx.node.tryGetContext('githubOwner') as string | undefined;
      const budgetEmail = appNoCtx.node.tryGetContext('budgetEmail') as string | undefined;
      const missing: string[] = [];
      if (!hostedZoneId) missing.push('hostedZoneId');
      if (!githubOwner) missing.push('githubOwner');
      if (!budgetEmail) missing.push('budgetEmail');
      if (missing.length > 0) {
        throw new Error(`Missing CDK context value(s): ${missing.join(', ')}.`);
      }
    }).toThrow(/Missing CDK context value/);
  });
});
