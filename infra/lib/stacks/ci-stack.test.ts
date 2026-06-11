import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { CiStack } from './ci-stack.js';

describe('CiStack', () => {
  const synth = () => {
    const app = new App();
    const stack = new CiStack(app, 'TestCi', {
      env: { account: '111111111111', region: 'eu-west-2' },
      githubOwner: 'sandycormie',
      tableArn: 'arn:aws:dynamodb:eu-west-2:111111111111:table/gigbuddy-data',
    });
    return Template.fromStack(stack);
  };

  it('creates an OIDC provider for token.actions.githubusercontent.com', () => {
    const template = synth();
    // CDK uses a custom resource (Lambda-backed) to manage the OIDC provider.
    // The provider URL is in the Custom::AWSCDKOpenIdConnectProvider resource.
    template.hasResourceProperties('Custom::AWSCDKOpenIdConnectProvider', {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIDList: ['sts.amazonaws.com'],
    });
  });

  it('creates the gigbuddy-deploy-role with the OIDC sub constraint scoped to main', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'gigbuddy-deploy-role',
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: Match.objectLike({
              StringLike: Match.objectLike({
                'token.actions.githubusercontent.com:sub':
                  'repo:sandycormie/gigbuddy:ref:refs/heads/main',
              }),
              StringEquals: Match.objectLike({
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
              }),
            }),
          }),
        ]),
      }),
    });
  });

  it('does not create any IAM users (no long-lived static credentials)', () => {
    const template = synth();
    template.resourceCountIs('AWS::IAM::User', 0);
    template.resourceCountIs('AWS::IAM::AccessKey', 0);
  });

  it('grants CloudFormation only on Gigbuddy* stack ARNs', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'cloudformation:*',
            Resource: Match.arrayWith([Match.stringLikeRegexp('stack/Gigbuddy\\*')]),
          }),
        ]),
      }),
    });
  });
});
