import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { ObservabilityStack } from './observability-stack.js';

describe('ObservabilityStack', () => {
  const synth = () => {
    const app = new App();
    const stack = new ObservabilityStack(app, 'TestObservability', {
      env: { account: '111111111111', region: 'eu-west-2' },
      budgetEmail: 'sandy@example.com',
    });
    return Template.fromStack(stack);
  };

  it('creates a multi-region CloudTrail trail with global service events', () => {
    const template = synth();
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      IsMultiRegionTrail: true,
      IncludeGlobalServiceEvents: true,
    });
  });

  it('creates exactly two Budget resources at the email subscriber', () => {
    const template = synth();
    template.resourceCountIs('AWS::Budgets::Budget', 2);
  });

  it('each budget alerts at 100% ACTUAL threshold to the configured email', () => {
    const template = synth();
    template.hasResourceProperties('AWS::Budgets::Budget', {
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({
            ComparisonOperator: 'GREATER_THAN',
            NotificationType: 'ACTUAL',
            Threshold: 100,
            ThresholdType: 'PERCENTAGE',
          }),
          Subscribers: Match.arrayWith([
            Match.objectLike({
              SubscriptionType: 'EMAIL',
              Address: 'sandy@example.com',
            }),
          ]),
        }),
      ]),
    });
  });

  it('Trail bucket lifecycles to Glacier after 90 days', () => {
    const template = synth();
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: Match.objectLike({
        Rules: Match.arrayWith([
          Match.objectLike({
            Transitions: Match.arrayWith([
              Match.objectLike({
                StorageClass: 'GLACIER',
                TransitionInDays: 90,
              }),
            ]),
          }),
        ]),
      }),
    });
  });
});
