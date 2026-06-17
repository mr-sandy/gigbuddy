import { describe, expect, it } from 'vitest';
import { ClientErrorReportSchema } from './client-error.js';

const validPayload = {
  where: 'window.onerror',
  message: 'TypeError: Cannot read properties of undefined',
  stack: 'at handleClick (button.tsx:42)',
  performanceActive: false,
  timestamp: '2026-06-16T12:34:56.789Z',
};

describe('ClientErrorReportSchema', () => {
  it('accepts a valid full payload', () => {
    expect(ClientErrorReportSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts a payload without stack (optional)', () => {
    const { stack: _s, ...without } = validPayload;
    expect(ClientErrorReportSchema.safeParse(without).success).toBe(true);
  });

  it('rejects missing where', () => {
    const { where: _w, ...without } = validPayload;
    expect(ClientErrorReportSchema.safeParse(without).success).toBe(false);
  });

  it('rejects missing message', () => {
    const { message: _m, ...without } = validPayload;
    expect(ClientErrorReportSchema.safeParse(without).success).toBe(false);
  });

  it('rejects missing performanceActive', () => {
    const { performanceActive: _p, ...without } = validPayload;
    expect(ClientErrorReportSchema.safeParse(without).success).toBe(false);
  });

  it('rejects missing timestamp', () => {
    const { timestamp: _t, ...without } = validPayload;
    expect(ClientErrorReportSchema.safeParse(without).success).toBe(false);
  });

  it('rejects a non-ISO-8601 timestamp', () => {
    const bad = { ...validPayload, timestamp: '2026-06-16 12:34:56' };
    expect(ClientErrorReportSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an empty where string', () => {
    const bad = { ...validPayload, where: '' };
    expect(ClientErrorReportSchema.safeParse(bad).success).toBe(false);
  });
});
