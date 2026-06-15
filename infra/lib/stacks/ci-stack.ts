import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import {
  Effect,
  FederatedPrincipal,
  OpenIdConnectProvider,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

const GITHUB_OIDC_PROVIDER_ARN = `arn:aws:iam::828560234470:oidc-provider/token.actions.githubusercontent.com`;

export interface CiStackProps extends StackProps {
  githubOwner: string;
  tableArn: string;
}

export class CiStack extends Stack {
  readonly deployRole: Role;

  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);

    // Import the existing OIDC provider rather than creating a new one —
    // this account already has token.actions.githubusercontent.com registered
    // (from another project). Creating a second one fails with EntityAlreadyExists.
    const provider = OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GithubOidc',
      GITHUB_OIDC_PROVIDER_ARN,
    );

    this.deployRole = new Role(this, 'DeployRole', {
      roleName: 'gigbuddy-deploy-role',
      assumedBy: new FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.githubOwner}/gigbuddy:ref:refs/heads/main`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    // CloudFormation: cloudformation:* scoped to Gigbuddy* stack ARNs.
    // Using * rather than enumerating actions because CDK deploy requires ~12 CF
    // actions and the list changes across CDK versions — the ARN scope limits blast
    // radius to our own stacks. DataStack has terminationProtection; others are
    // reconstructible via cdk deploy. DeleteStack is not needed for routine deploys
    // but is accepted here given the narrow ARN scope and personal-tool risk profile.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudformation:*'],
        resources: [
          `arn:aws:cloudformation:${this.region}:${this.account}:stack/Gigbuddy*/*`,
          `arn:aws:cloudformation:us-east-1:${this.account}:stack/Gigbuddy*/*`,
        ],
      }),
    );

    // CDK toolkit: DescribeStacks on CDKToolkit is required for cdk deploy to
    // resolve the bootstrap bucket name during asset publishing.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          `arn:aws:cloudformation:${this.region}:${this.account}:stack/CDKToolkit/*`,
          `arn:aws:cloudformation:us-east-1:${this.account}:stack/CDKToolkit/*`,
        ],
      }),
    );

    // S3: web bucket + CDK bootstrap bucket. Actions cover CDK asset publishing
    // (get/put/list on bootstrap bucket) and SPA sync with --delete (put/delete/list
    // on web bucket). Excludes DeleteBucket and PutBucketPolicy.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          's3:GetBucketLocation',
          's3:GetEncryptionConfiguration',
          's3:GetObject',
          's3:GetObjectVersion',
          's3:ListBucket',
          's3:ListBucketMultipartUploads',
          's3:AbortMultipartUpload',
          's3:PutObject',
          's3:DeleteObject',
        ],
        resources: [
          `arn:aws:s3:::cdk-*-assets-${this.account}-*`,
          `arn:aws:s3:::cdk-*-assets-${this.account}-*/*`,
          'arn:aws:s3:::gigbuddyweb-*',
          'arn:aws:s3:::gigbuddyweb-*/*',
        ],
      }),
    );

    // CloudFront: invalidations on any distribution (distribution ARN is
    // resolved at deploy time; scoping further would require importing the
    // distribution from web-stack, which creates a stack cycle).
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: ['*'],
      }),
    );

    // DynamoDB: Query + Scan + DescribeTable on the data table + its GSI.
    // Scan is required by the deploy-time blackout check (infra/scripts/blackout-check.ts):
    // GSI1's partition key is BAND#<bandId>#SETLIST_BY_DATE — V1 ships a single Band but
    // the deploy script does not know its bandId, so Scan on GSI1 covers all bands at
    // negligible cost (single-user volume).
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:DescribeTable'],
        resources: [props.tableArn, `${props.tableArn}/index/*`],
      }),
    );

    // SSM: GetParameter on /gigbuddy/* (non-secret config the deploy may need)
    // and on /cdk-bootstrap/* (CDK checks the bootstrap stack version via SSM
    // before every deploy — without this the role can't deploy any stack).
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/gigbuddy/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/*`,
          `arn:aws:ssm:us-east-1:${this.account}:parameter/cdk-bootstrap/*`,
        ],
      }),
    );

    // IAM PassRole on the Lambda execution role (for cdk to update Lambda config).
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [`arn:aws:iam::${this.account}:role/GigbuddyApi-*`],
      }),
    );

    // Lambda: operations needed by CDK to manage the function resource and by the
    // deploy pipeline to update code. Excludes DeleteFunction.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'lambda:CreateFunction',
          'lambda:UpdateFunctionCode',
          'lambda:UpdateFunctionConfiguration',
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:PublishVersion',
          'lambda:TagResource',
          'lambda:UntagResource',
          'lambda:ListTags',
          'lambda:AddPermission',
          'lambda:RemovePermission',
          'lambda:CreateFunctionUrlConfig',
          'lambda:GetFunctionUrlConfig',
          'lambda:UpdateFunctionUrlConfig',
          'lambda:DeleteFunctionUrlConfig',
        ],
        resources: [`arn:aws:lambda:${this.region}:${this.account}:function:gigbuddy-api`],
      }),
    );

    // CloudWatch Logs: audit log for deploy-force overrides. Scoped to
    // /gigbuddy/deploy-force only — the deploy role intentionally cannot read or
    // tamper with the Lambda log group /aws/lambda/gigbuddy-api (operator's read
    // surface, not the deploy pipeline's). The two-resource ARN pattern is
    // required: PutLogEvents expects the :log-stream:* sub-resource form, while
    // CreateLogGroup operates on the unsuffixed log-group ARN.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/gigbuddy/deploy-force`,
          `arn:aws:logs:${this.region}:${this.account}:log-group:/gigbuddy/deploy-force:*`,
        ],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: this.deployRole.roleArn });
  }
}
