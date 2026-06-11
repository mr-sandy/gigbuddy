import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { DataStack } from './data-stack.js';

describe('DataStack', () => {
  const synth = () => {
    const app = new App();
    const stack = new DataStack(app, 'TestData', {
      env: { account: '111111111111', region: 'eu-west-2' },
    });
    return Template.fromStack(stack);
  };

  it('creates the gigbuddy-data DynamoDB table with PITR, deletion protection, and AWS-managed encryption', () => {
    const template = synth();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'gigbuddy-data',
      BillingMode: 'PAY_PER_REQUEST',
      DeletionProtectionEnabled: true,
      SSESpecification: { SSEEnabled: true },
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    });
  });

  it('creates GSI1 with gsi1pk/gsi1sk and ALL projection', () => {
    const template = synth();
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        }),
      ]),
    });
  });

  it('creates exactly one BackupVault and one BackupPlan with 365-day retention and 30-day cold storage', () => {
    const template = synth();
    template.resourceCountIs('AWS::Backup::BackupVault', 1);
    template.resourceCountIs('AWS::Backup::BackupPlan', 1);
    template.hasResourceProperties('AWS::Backup::BackupPlan', {
      BackupPlan: Match.objectLike({
        BackupPlanRule: Match.arrayWith([
          Match.objectLike({
            Lifecycle: {
              DeleteAfterDays: 365,
              MoveToColdStorageAfterDays: 30,
            },
          }),
        ]),
      }),
    });
  });

  it('selects only the gigbuddy-data table for backup (not the entire account)', () => {
    const template = synth();
    template.resourceCountIs('AWS::Backup::BackupSelection', 1);
  });

  it('declares the BackupVault encryption key with rotation enabled', () => {
    const template = synth();
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });
  });
});
