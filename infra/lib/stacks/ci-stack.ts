import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import {
  Effect,
  FederatedPrincipal,
  OpenIdConnectProvider,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface CiStackProps extends StackProps {
  githubOwner: string;
  tableArn: string;
}

export class CiStack extends Stack {
  readonly deployRole: Role;

  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);

    const provider = new OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

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

    // DynamoDB: Query + DescribeTable on the data table + its GSI.
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:DescribeTable'],
        resources: [props.tableArn, `${props.tableArn}/index/*`],
      }),
    );

    // SSM: GetParameter on /gigbuddy/* (non-secret config the deploy may need).
    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/gigbuddy/*`],
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

    new CfnOutput(this, 'DeployRoleArn', { value: this.deployRole.roleArn });
  }
}
