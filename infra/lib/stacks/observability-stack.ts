import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { ReadWriteType, Trail } from 'aws-cdk-lib/aws-cloudtrail';
import { BlockPublicAccess, Bucket, BucketEncryption, StorageClass } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface ObservabilityStackProps extends StackProps {
  budgetEmail: string;
}

export class ObservabilityStack extends Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const trailBucket = new Bucket(this, 'TrailBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: StorageClass.GLACIER,
              transitionAfter: Duration.days(90),
            },
          ],
        },
      ],
    });

    new Trail(this, 'Trail', {
      bucket: trailBucket,
      sendToCloudWatchLogs: false,
      isMultiRegionTrail: true,
      managementEvents: ReadWriteType.ALL,
      includeGlobalServiceEvents: true,
    });

    for (const limit of [5, 20] as const) {
      new CfnBudget(this, `Budget${limit}`, {
        budget: {
          budgetName: `gigbuddy-monthly-${limit}usd`,
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: limit, unit: 'USD' },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: 'GREATER_THAN',
              notificationType: 'ACTUAL',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: props.budgetEmail }],
          },
        ],
      });
    }
  }
}
