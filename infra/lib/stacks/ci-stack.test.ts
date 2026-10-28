import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { CiStack } from './ci-stack.js';

describe('CiStack', () => {
  const synth = () => {
    const app = new App();
    const stack = new CiStack(app, 'TestCi', {
      env: { account: '111111111111', region: 'eu-west-2' },
      githubOwner: 'sandycormie',
    });
    return Template.fromStack(stack);
  };

  it('imports (not creates) the OIDC provider — no Custom::AWSCDKOpenIdConnectProvider resource', () => {
    const template = synth();
    // The account already has the GitHub OIDC provider; we import it via
    // fromOpenIdConnectProviderArn rather than creating a second one.
    // Importing produces no CloudFormation resource — assert the count is zero.
    template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 0);
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

  it('grants no dynamodb:* or logs:* actions', () => {
    const template = synth();
    const actions: string[] = [];
    for (const policy of Object.values(template.findResources('AWS::IAM::Policy'))) {
      for (const statement of policy.Properties.PolicyDocument.Statement) {
        actions.push(...[statement.Action].flat());
      }
    }
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.filter((a) => /^(dynamodb|logs):/.test(a))).toEqual([]);
  });
});
