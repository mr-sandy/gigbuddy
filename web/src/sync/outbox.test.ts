import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetOutboxForTests,
  enqueue,
  listAll,
  markInFlight,
  markPending,
  peek,
  remove,
} from './outbox.js';

function isoOffset(ms: number): string {
  return new Date(Date.UTC(2026, 5, 17, 12, 0, 0, ms)).toISOString();
}

beforeEach(async () => {
  await __resetOutboxForTests();
});

describe('outbox.enqueue / coalesce rules', () => {
  it('appends a fresh entry when no entry exists for the recordKey (Rule 3)', async () => {
    const a = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 1 },
      clientWrittenAt: isoOffset(1),
    });
    expect(a.status).toBe('pending');
    expect(a.attempts).toBe(0);
    expect(a.op).toBe('PUT');
    expect(a.id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const all = await listAll();
    expect(all).toHaveLength(1);
  });

  it('REPLACES the pending entry in place when a same-recordKey enqueue arrives (Rule 1)', async () => {
    const a = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 1 },
      clientWrittenAt: isoOffset(1),
    });
    const b = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 2 },
      clientWrittenAt: isoOffset(2),
    });
    expect(b.id).toBe(a.id); // id preserved
    expect(b.payload).toEqual({ v: 2 });
    const all = await listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.payload).toEqual({ v: 2 });
  });

  it('appends a SECOND entry when the existing entry is in-flight (Rule 2)', async () => {
    const a = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 1 },
      clientWrittenAt: isoOffset(1),
    });
    await markInFlight(a.id);
    const c = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 3 },
      clientWrittenAt: isoOffset(3),
    });
    expect(c.id).not.toBe(a.id);
    const all = await listAll();
    expect(all).toHaveLength(2);
    const inFlight = all.find((e) => e.status === 'in-flight');
    const pending = all.find((e) => e.status === 'pending');
    expect(inFlight?.id).toBe(a.id);
    expect(pending?.id).toBe(c.id);
    expect(pending?.payload).toEqual({ v: 3 });
  });

  it('with an in-flight + pending pair, a third same-key enqueue REPLACES the pending only', async () => {
    const a = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 1 },
      clientWrittenAt: isoOffset(1),
    });
    await markInFlight(a.id);
    const c = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 3 },
      clientWrittenAt: isoOffset(3),
    });
    const d = await enqueue({
      recordKey: 'song:b:1',
      payload: { v: 4 },
      clientWrittenAt: isoOffset(4),
    });
    expect(d.id).toBe(c.id);
    const all = await listAll();
    expect(all).toHaveLength(2);
    const inFlight = all.find((e) => e.status === 'in-flight');
    const pending = all.find((e) => e.status === 'pending');
    expect(inFlight?.id).toBe(a.id);
    expect(pending?.payload).toEqual({ v: 4 });
  });

  it('isolates coalescing by recordKey (cross-recordKey enqueues do not collide)', async () => {
    const a = await enqueue({
      recordKey: 'song:b:X',
      payload: { v: 'a' },
      clientWrittenAt: isoOffset(1),
    });
    await enqueue({ recordKey: 'song:b:Y', payload: { v: 'b' }, clientWrittenAt: isoOffset(2) });
    const c = await enqueue({
      recordKey: 'song:b:X',
      payload: { v: 'c' },
      clientWrittenAt: isoOffset(3),
    });
    expect(c.id).toBe(a.id);
    const all = await listAll();
    expect(all).toHaveLength(2);
    const x = all.find((e) => e.recordKey === 'song:b:X');
    const y = all.find((e) => e.recordKey === 'song:b:Y');
    expect(x?.payload).toEqual({ v: 'c' });
    expect(y?.payload).toEqual({ v: 'b' });
  });
});

describe('outbox.peek / markInFlight / markPending / remove', () => {
  it('peek returns the oldest pending by clientWrittenAt', async () => {
    await enqueue({ recordKey: 'song:b:1', payload: 1, clientWrittenAt: isoOffset(2) });
    const older = await enqueue({
      recordKey: 'song:b:2',
      payload: 2,
      clientWrittenAt: isoOffset(1),
    });
    const peeked = await peek();
    expect(peeked?.id).toBe(older.id);
  });

  it('peek skips in-flight entries (only pending are eligible)', async () => {
    const a = await enqueue({ recordKey: 'song:b:1', payload: 1, clientWrittenAt: isoOffset(1) });
    await markInFlight(a.id);
    const b = await enqueue({ recordKey: 'song:b:2', payload: 2, clientWrittenAt: isoOffset(2) });
    const peeked = await peek();
    expect(peeked?.id).toBe(b.id);
  });

  it('markInFlight throws if the entry does not exist', async () => {
    await expect(markInFlight('does-not-exist')).rejects.toThrow(/not found/);
  });

  it('markInFlight throws if the entry is already in-flight', async () => {
    const a = await enqueue({ recordKey: 'song:b:1', payload: 1, clientWrittenAt: isoOffset(1) });
    await markInFlight(a.id);
    await expect(markInFlight(a.id)).rejects.toThrow(/already in-flight/);
  });

  it('markPending flips status back and updates attempts', async () => {
    const a = await enqueue({ recordKey: 'song:b:1', payload: 1, clientWrittenAt: isoOffset(1) });
    await markInFlight(a.id);
    await markPending(a.id, 1);
    const all = await listAll();
    expect(all[0]?.status).toBe('pending');
    expect(all[0]?.attempts).toBe(1);
  });

  it('remove is idempotent (removing an absent id is a no-op)', async () => {
    await expect(remove('nonexistent-id')).resolves.toBeUndefined();
  });

  it('round-trips: enqueue → markInFlight → markPending → peek returns the same entry', async () => {
    const a = await enqueue({ recordKey: 'song:b:1', payload: 'x', clientWrittenAt: isoOffset(1) });
    await markInFlight(a.id);
    expect(await peek()).toBeUndefined();
    await markPending(a.id, 1);
    const peeked = await peek();
    expect(peeked?.id).toBe(a.id);
    expect(peeked?.attempts).toBe(1);
  });
});

describe('outbox.listAll', () => {
  it('returns every entry ordered by clientWrittenAt ascending', async () => {
    const a = await enqueue({ recordKey: 'song:b:X', payload: 1, clientWrittenAt: isoOffset(3) });
    const b = await enqueue({ recordKey: 'song:b:Y', payload: 2, clientWrittenAt: isoOffset(1) });
    const c = await enqueue({ recordKey: 'song:b:Z', payload: 3, clientWrittenAt: isoOffset(2) });
    const all = await listAll();
    expect(all.map((e) => e.id)).toEqual([b.id, c.id, a.id]);
  });
});
