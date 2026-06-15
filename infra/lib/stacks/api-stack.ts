import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, FunctionUrlAuthType, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FUNCTION_NAME = 'gigbuddy-api';

export interface ApiStackProps extends StackProps {
  table: ITable;
}

export class ApiStack extends Stack {
  readonly functionArn: string;
  readonly functionUrlDomain: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const logGroup = new LogGroup(this, 'LambdaLogs', {
      logGroupName: `/aws/lambda/${FUNCTION_NAME}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const handlerEntry = path.resolve(__dirname, '../../../api/src/handler.ts');

    const lambdaFn = new NodejsFunction(this, 'ApiFunction', {
      functionName: FUNCTION_NAME,
      entry: handlerEntry,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      reservedConcurrentExecutions: 50,
      logGroup,
      loggingFormat: LoggingFormat.JSON,
      bundling: {
        format: OutputFormat.ESM,
        target: 'node22',
        externalModules: ['@aws-sdk/*'],
        minify: true,
        sourceMap: true,
      },
      environment: {
        TABLE_NAME: props.table.tableName,
        JWT_KEY_PARAM: '/gigbuddy/jwt-key',
        PASSWORD_HASH_PARAM: '/gigbuddy/password-hash',
      },
    });

    props.table.grantReadWriteData(lambdaFn);

    lambdaFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/gigbuddy/*`],
      }),
    );

    lambdaFn.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` },
        },
      }),
    );

    const functionUrl = lambdaFn.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });

    this.functionArn = lambdaFn.functionArn;
    // functionUrl.url is a CDK token — .replace() on a token string is a no-op at
    // runtime. Use Fn.select/split to strip "https://" and the trailing "/" so that
    // web-stack can pass a bare FQDN to HttpOrigin (CloudFront rejects colons).
    this.functionUrlDomain = Fn.select(0, Fn.split('/', Fn.select(1, Fn.split('//', functionUrl.url))));

    new CfnOutput(this, 'LambdaFunctionArn', { value: lambdaFn.functionArn });
    new CfnOutput(this, 'LambdaFunctionUrlDomain', { value: this.functionUrlDomain });
  }
}
