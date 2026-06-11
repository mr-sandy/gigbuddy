import { describe, expect, it } from 'vitest';
import {
  LoginAppliedResponseSchema,
  LoginRequestSchema,
  MeDataSchema,
  MeResponseSchema,
} from './auth.js';

describe('LoginRequestSchema', () => {
  it('accepts a non-empty password string', () => {
    const result = LoginRequestSchema.safeParse({ password: 'hunter2' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = LoginRequestSchema.safeParse({ password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing password field', () => {
    const result = LoginRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string password', () => {
    const result = LoginRequestSchema.safeParse({ password: 42 });
    expect(result.success).toBe(false);
  });
});

describe('LoginAppliedResponseSchema', () => {
  it('accepts the canonical applied envelope', () => {
    const result = LoginAppliedResponseSchema.safeParse({ status: 'applied' });
    expect(result.success).toBe(true);
  });

  it('rejects an unrelated status literal', () => {
    const result = LoginAppliedResponseSchema.safeParse({ status: 'ok' });
    expect(result.success).toBe(false);
  });
});

describe('MeDataSchema and MeResponseSchema', () => {
  it('accepts a valid /me success body', () => {
    const result = MeResponseSchema.safeParse({
      status: 'ok',
      data: { authenticated: true, daysUntilExpiry: 365 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative daysUntilExpiry', () => {
    const result = MeDataSchema.safeParse({ authenticated: true, daysUntilExpiry: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer daysUntilExpiry', () => {
    const result = MeDataSchema.safeParse({ authenticated: true, daysUntilExpiry: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects authenticated: false', () => {
    const result = MeDataSchema.safeParse({ authenticated: false, daysUntilExpiry: 365 });
    expect(result.success).toBe(false);
  });
});
