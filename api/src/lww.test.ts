import { describe, expect, it } from 'vitest';
import { compareLww } from './lww.js';

type StampedRecord = { clientWrittenAt: string };

describe('compareLww', () => {
  it('applies when existing is undefined (new record)', () => {
    const incoming: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.000Z' };
    expect(compareLww(incoming, undefined)).toBe('apply');
  });

  it('applies when incoming and existing have the same clientWrittenAt (>= wins)', () => {
    const ts = '2026-06-16T12:00:00.000Z';
    expect(compareLww({ clientWrittenAt: ts }, { clientWrittenAt: ts })).toBe('apply');
  });

  it('applies when incoming is strictly newer by one millisecond', () => {
    const incoming: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.001Z' };
    const existing: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.000Z' };
    expect(compareLww(incoming, existing)).toBe('apply');
  });

  it('drops when incoming is strictly older by one millisecond', () => {
    const incoming: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.000Z' };
    const existing: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.001Z' };
    expect(compareLww(incoming, existing)).toBe('drop');
  });

  it('applies when incoming is far in the future (large positive clock skew)', () => {
    const incoming: StampedRecord = { clientWrittenAt: '2036-06-16T12:00:00.000Z' };
    const existing: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.000Z' };
    expect(compareLww(incoming, existing)).toBe('apply');
  });

  it('drops when incoming is far in the past (large negative clock skew)', () => {
    const incoming: StampedRecord = { clientWrittenAt: '2016-06-16T12:00:00.000Z' };
    const existing: StampedRecord = { clientWrittenAt: '2026-06-16T12:00:00.000Z' };
    expect(compareLww(incoming, existing)).toBe('drop');
  });

  it('compares ISO-8601 strings lexically across millisecond, second, and day boundaries', () => {
    const a = '2026-01-01T00:00:00.000Z';
    const b = '2026-01-01T00:00:00.001Z';
    const c = '2026-01-01T00:00:01.000Z';
    const d = '2026-01-02T00:00:00.000Z';

    expect(compareLww({ clientWrittenAt: b }, { clientWrittenAt: a })).toBe('apply');
    expect(compareLww({ clientWrittenAt: c }, { clientWrittenAt: b })).toBe('apply');
    expect(compareLww({ clientWrittenAt: d }, { clientWrittenAt: c })).toBe('apply');

    expect(compareLww({ clientWrittenAt: a }, { clientWrittenAt: b })).toBe('drop');
    expect(compareLww({ clientWrittenAt: b }, { clientWrittenAt: c })).toBe('drop');
    expect(compareLww({ clientWrittenAt: c }, { clientWrittenAt: d })).toBe('drop');
  });
});
