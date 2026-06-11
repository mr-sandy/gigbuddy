import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { ApiStack } from './api-stack.js';
import { DataStack } from './data-stack.js';

describe('ApiStack', () => {
  const synth = () => {
    const app = new App();
    const env = { account: '111111111111', region: 'eu-west-2' };
    const data = new DataStack(app, 'TestData', { env });
    const api = new ApiStack(app, 'TestApi', { env, table: data.table });
    return Template.fromStack(api);
  };

  it('creates the Lambda with Node 22, arm64, 512MB, reserved concurrency 50', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      MemorySize: 512,
      ReservedConcurrentExecutions: 50,
      Timeout: 10,
    });
  });

  it('exposes a Function URL with AuthType NONE (CloudFront fronts auth)', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'NONE',
    });
  });

  it('passes TABLE_NAME, JWT_KEY_PARAM, PASSWORD_HASH_PARAM env vars', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          JWT_KEY_PARAM: '/gigbuddy/jwt-key',
          PASSWORD_HASH_PARAM: '/gigbuddy/password-hash',
          TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it('declares an explicit LogGroup with 14-day retention', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/gigbuddy-api',
      RetentionInDays: 14,
    });
  });

  it('grants SSM GetParameter scoped to parameter/gigbuddy/* (not *)', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['ssm:GetParameter', 'ssm:GetParameters']),
            Resource: Match.stringLikeRegexp('parameter/gigbuddy/\\*'),
          }),
        ]),
      }),
    });
  });

  it('grants kms:Decrypt only when called via the SSM service', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'kms:Decrypt',
            Condition: {
              StringEquals: { 'kms:ViaService': 'ssm.eu-west-2.amazonaws.com' },
            },
          }),
        ]),
      }),
    });
  });

  it('grants DynamoDB read+write on the table (via grantReadWriteData)', () => {
    const template = synth();
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:BatchGetItem',
              'dynamodb:Query',
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
            ]),
          }),
        ]),
      }),
    });
  });

  it('uses JSON logging format', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Lambda::Function', {
      LoggingConfig: Match.objectLike({ LogFormat: 'JSON' }),
    });
  });
});
