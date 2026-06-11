import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { WebCertStack } from './web-cert-stack.js';

describe('WebCertStack', () => {
  const synth = () => {
    const app = new App();
    const stack = new WebCertStack(app, 'TestWebCert', {
      env: { account: '111111111111', region: 'us-east-1' },
      subdomain: 'gig.cormie.com',
      hostedZoneId: 'Z0000000000000000000',
      hostedZoneName: 'cormie.com',
    });
    return Template.fromStack(stack);
  };

  it('creates an ACM certificate for the subdomain', () => {
    const template = synth();
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'gig.cormie.com',
    });
  });

  it('creates a CLOUDFRONT-scoped WAFv2 web ACL with one IP rate-limit rule at 500/5min returning 429', () => {
    const template = synth();
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      Rules: [
        Match.objectLike({
          Name: 'RateLimit',
          Statement: {
            RateBasedStatement: {
              AggregateKeyType: 'IP',
              Limit: 500,
            },
          },
          Action: {
            Block: {
              CustomResponse: { ResponseCode: 429 },
            },
          },
        }),
      ],
    });
  });
});
