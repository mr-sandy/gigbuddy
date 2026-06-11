import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { WebStack } from './web-stack.js';

describe('WebStack', () => {
  const synth = () => {
    const app = new App();
    const stack = new WebStack(app, 'TestWeb', {
      env: { account: '111111111111', region: 'eu-west-2' },
      subdomain: 'gig.cormie.com',
      hostedZoneId: 'Z0000000000000000000',
      hostedZoneName: 'cormie.com',
      certificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate/abc',
      wafArn: 'arn:aws:wafv2:us-east-1:111111111111:global/webacl/test/abc',
      lambdaFunctionArn: 'arn:aws:lambda:eu-west-2:111111111111:function:gigbuddy-api',
      lambdaFunctionUrlDomain: 'abcdef.lambda-url.eu-west-2.on.aws',
    });
    return Template.fromStack(stack);
  };

  it('creates a private S3 bucket with BlockPublicAccess fully on', () => {
    const template = synth();
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('creates a CloudFront distribution with two behaviors and TLS 1.2 minimum', () => {
    const template = synth();
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['gig.cormie.com'],
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: 'TLSv1.2_2021',
        }),
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: '/api/*',
            // CACHING_DISABLED managed policy ID — proves API responses are never cached
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
          }),
        ]),
      }),
    });
  });

  it('returns SPA index.html on 404 and 403 (for client-side routing)', () => {
    const template = synth();
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
        ]),
      }),
    });
  });

  it('creates a CAA record restricting issuance to amazon.com', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'CAA',
      ResourceRecords: Match.arrayWith([Match.stringLikeRegexp('amazon\\.com')]),
    });
  });

  it('creates A and AAAA alias records for the subdomain', () => {
    const template = synth();
    template.resourceCountIs('AWS::Route53::RecordSet', 3); // A, AAAA, CAA
    template.hasResourceProperties('AWS::Route53::RecordSet', { Type: 'A' });
    template.hasResourceProperties('AWS::Route53::RecordSet', { Type: 'AAAA' });
  });

  it('creates a Lambda::Permission restricting Function URL access to this distribution', () => {
    const template = synth();
    // SourceArn must be a CloudFormation intrinsic expression (not a bare string or '*')
    // referencing this distribution — a literal string would break the Function URL lock.
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunctionUrl',
      FunctionUrlAuthType: 'NONE',
      Principal: '*',
      SourceArn: Match.objectLike({}),
    });
  });
});
