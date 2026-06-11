import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CfnPermission } from 'aws-cdk-lib/aws-lambda';
import {
  AaaaRecord,
  ARecord,
  CaaRecord,
  CaaTag,
  HostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface WebStackProps extends StackProps {
  subdomain: string;
  hostedZoneId: string;
  hostedZoneName: string;
  certificateArn: string;
  wafArn: string;
  lambdaFunctionArn: string;
  lambdaFunctionUrlDomain: string;
}

export class WebStack extends Stack {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    // Derive the DNS record name from the subdomain prop so this stack stays
    // correct if the subdomain is ever changed (e.g. staging environment).
    const recordName = props.subdomain.replace(`.${props.hostedZoneName}`, '');

    this.bucket = new Bucket(this, 'SpaBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
      enforceSSL: true,
    });

    // ALL_VIEWER_EXCEPT_HOST_HEADER forwards cookies, all viewer headers
    // (including Authorization), and query strings to the Lambda Function URL
    // origin. CloudFront blocks Authorization from custom OriginRequestPolicy
    // header allowlists, so we use this managed policy.
    const apiOriginRequestPolicy = OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER;

    const certificate = Certificate.fromCertificateArn(this, 'Cert', props.certificateArn);

    this.distribution = new Distribution(this, 'Dist', {
      domainNames: [props.subdomain],
      certificate,
      webAclId: props.wafArn,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(props.lambdaFunctionUrlDomain),
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: apiOriginRequestPolicy,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
    });

    new ARecord(this, 'AliasA', {
      zone: hostedZone,
      recordName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    new AaaaRecord(this, 'AliasAaaa', {
      zone: hostedZone,
      recordName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
    });

    new CaaRecord(this, 'Caa', {
      zone: hostedZone,
      recordName,
      values: [{ flag: 0, tag: CaaTag.ISSUE, value: 'amazon.com' }],
    });

    // Function URL lock: only this distribution can invoke the Lambda Function URL.
    // Direct hits to the Function URL hostname (bypassing CloudFront + WAF) return 403.
    new CfnPermission(this, 'FurlInvokeFromCloudFront', {
      action: 'lambda:InvokeFunctionUrl',
      functionName: props.lambdaFunctionArn,
      principal: '*',
      functionUrlAuthType: 'NONE',
      sourceArn: this.distribution.distributionArn,
    });

    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new CfnOutput(this, 'DistributionDomain', { value: this.distribution.distributionDomainName });
    new CfnOutput(this, 'SpaBucketName', { value: this.bucket.bucketName });
  }
}
