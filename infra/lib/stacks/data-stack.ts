import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  BackupPlan,
  BackupPlanRule,
  BackupResource,
  BackupSelection,
  BackupVault,
} from 'aws-cdk-lib/aws-backup';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { Key } from 'aws-cdk-lib/aws-kms';
import type { Construct } from 'constructs';

export class DataStack extends Stack {
  readonly table: Table;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { terminationProtection: true, ...props });

    this.table = new Table(this, 'GigbuddyData', {
      tableName: 'gigbuddy-data',
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    const backupKey = new Key(this, 'BackupKey', {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const vault = new BackupVault(this, 'BackupVault', {
      encryptionKey: backupKey,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const plan = new BackupPlan(this, 'BackupPlan', {
      backupVault: vault,
      backupPlanRules: [
        new BackupPlanRule({
          ruleName: 'DailyRetain365',
          scheduleExpression: Schedule.cron({
            minute: '0',
            hour: '3',
            day: '*',
            month: '*',
            year: '*',
          }),
          deleteAfter: Duration.days(365),
          moveToColdStorageAfter: Duration.days(30),
        }),
      ],
    });

    new BackupSelection(this, 'BackupSelection', {
      backupPlan: plan,
      resources: [BackupResource.fromDynamoDbTable(this.table)],
    });
  }
}
