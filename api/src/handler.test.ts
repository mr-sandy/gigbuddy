import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getJwtKeyMock, getPasswordHashMock } = vi.hoisted(() => ({
  getJwtKeyMock: vi.fn(),
  getPasswordHashMock: vi.fn(),
}));

vi.mock('./secrets/ssm.js', () => ({
  getJwtKey: getJwtKeyMock,
  getPasswordHash: getPasswordHashMock,
}));

import { handler } from './handler.js';

// Minimal Lambda Function URL / API Gateway v2 event for a GET /api/v1/* call.
// Hand-rolled inline to avoid pulling in @types/aws-lambda just for tests.
function buildEvent(opts: { path: string; headers?: Record<string, string> }): unknown {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: opts.path,
    rawQueryString: '',
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    requestContext: {
      accountId: 'anonymous',
      apiId: 'test',
      domainName: 'test.lambda-url.eu-west-2.on.aws',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: opts.path,
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
}

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

beforeEach(() => {
  getJwtKeyMock.mockReset();
  getPasswordHashMock.mockReset();
  getJwtKeyMock.mockResolvedValue(`test-key-${'x'.repeat(40)}`);
});

describe('Lambda handler', () => {
  it('returns HTTP 200 with {status:"ok"} for GET /api/v1/health', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: handler accepts a union of Lambda event types
    const result: any = await (handler as any)(
      buildEvent({ path: '/api/v1/health' }),
      lambdaContext,
      () => undefined,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual({ status: 'ok' });
  });

  it('returns HTTP 401 UNAUTHORIZED for GET /api/v1/me without a session cookie', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: handler accepts a union of Lambda event types
    const result: any = await (handler as any)(
      buildEvent({ path: '/api/v1/me' }),
      lambdaContext,
      () => undefined,
    );
    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body).toEqual({
      status: 'error',
      error: { code: 'UNAUTHORIZED', message: 'authentication required' },
    });
  });
});
