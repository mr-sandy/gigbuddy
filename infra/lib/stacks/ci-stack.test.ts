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

  it('grants dynamodb:Query+Scan+DescribeTable on the table + GSI', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:DescribeTable']),
            Resource: Match.arrayWith([
              'arn:aws:dynamodb:eu-west-2:111111111111:table/gigbuddy-data',
              'arn:aws:dynamodb:eu-west-2:111111111111:table/gigbuddy-data/index/*',
            ]),
          }),
        ]),
      }),
    });
  });

  it('grants logs:CreateLogGroup+CreateLogStream+PutLogEvents on /gigbuddy/deploy-force only', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
            ]),
            Resource: Match.arrayWith([
              'arn:aws:logs:eu-west-2:111111111111:log-group:/gigbuddy/deploy-force',
              'arn:aws:logs:eu-west-2:111111111111:log-group:/gigbuddy/deploy-force:*',
            ]),
          }),
        ]),
      }),
    });
  });
});
