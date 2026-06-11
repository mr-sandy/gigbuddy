import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

export interface WebCertStackProps extends StackProps {
  subdomain: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

export class WebCertStack extends Stack {
  readonly certificateArn: string;
  readonly wafArn: string;

  constructor(scope: Construct, id: string, props: WebCertStackProps) {
    super(scope, id, props);

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    const certificate = new Certificate(this, 'Cert', {
      domainName: props.subdomain,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const webAcl = new CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'RateLimit',
          priority: 1,
          action: {
            block: {
              customResponse: { responseCode: 429 },
            },
          },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: 500,
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'GigbuddyWebAcl',
      },
    });

    this.certificateArn = certificate.certificateArn;
    this.wafArn = webAcl.attrArn;

    new CfnOutput(this, 'CertificateArn', { value: this.certificateArn });
    new CfnOutput(this, 'WafArn', { value: this.wafArn });
  }
}
