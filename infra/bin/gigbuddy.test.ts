import { App } from 'aws-cdk-lib';
import { describe, expect, it } from 'vitest';

describe('CDK App', () => {
  it('instantiates without throwing when no stacks are registered', () => {
    expect(() => new App()).not.toThrow();
  });
});
