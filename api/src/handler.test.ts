import { describe, expect, it } from 'vitest';
import { handler } from './handler.js';

// Minimal Lambda Function URL / API Gateway v2 event for GET /api/v1/health.
// Hand-rolled inline to avoid pulling in @types/aws-lambda just for tests.
const healthEvent = {
  version: '2.0',
  routeKey: '$default',
  rawPath: '/api/v1/health',
  rawQueryString: '',
  headers: { 'content-type': 'application/json' },
  requestContext: {
    accountId: 'anonymous',
    apiId: 'test',
    domainName: 'test.lambda-url.eu-west-2.on.aws',
    domainPrefix: 'test',
    http: {
      method: 'GET',
      path: '/api/v1/health',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'vitest',
    },
    requestId: 'test',
    routeKey: '$default',
    stage: '$default',
    time: '01/Jan/2026:00:00:00 +0000',
    timeEpoch: 1735689600000,
  },
  body: null,
  isBase64Encoded: false,
};

const lambdaContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:eu-west-2:000000000000:function:test',
  memoryLimitInMB: '512',
  awsRequestId: 'test',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test',
  getRemainingTimeInMillis: () => 10_000,
  done: () => undefined,
  fail: () => undefined,
  succeed: () => undefined,
};

describe('Lambda handler', () => {
  it('returns HTTP 200 with {status:"ok"} for GET /api/v1/health', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: handler accepts a union of Lambda event types
    const result: any = await (handler as any)(healthEvent, lambdaContext, () => undefined);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual({ status: 'ok' });
  });
});
