import { clear, del, entries, set } from 'idb-keyval';
import { customAlphabet } from 'nanoid';
import { outboxStore } from '../cache/idb.js';
import { URL_SAFE_ALPHABET } from '../lib/id.js';

/*
 * IndexedDB-backed outbox for optimistic writes (architecture.md
 * "Outbox state machine"). Sole storage surface for sync mutations; the
 * UI never imports this module directly (AR-45) — mutation hooks landing
 * in Story 2.6 (`useSongMutation`) consume it.
 *
 * Coalesce contract (architecture.md lines 605–608):
 *   - At most two entries per recordKey: one `in-flight` + one `pending`.
 *   - A second `pending` enqueue for the same recordKey REPLACES the
 *     existing pending entry in place (preserves its NanoID — no external
 *     module can be holding a reference to a coalesced-away id).
 *   - The IDB write transaction serialises concurrent enqueues; rapid-fire
 *     enqueues collapse safely with last-write-wins semantics, which is the
 *     desired behaviour.
 */

const newId = customAlphabet(URL_SAFE_ALPHABET, 16);

export type OutboxEntry = {
  id: string;
  recordKey: string;
  op: 'PUT';
  payload: unknown;
  clientWrittenAt: string;
  status: 'pending' | 'in-flight';
  attempts: number;
};

async function all(): Promise<OutboxEntry[]> {
  const rows = (await entries(outboxStore)) as [IDBValidKey, OutboxEntry][];
  return rows.map(([, value]) => value);
}

function sortByClientWrittenAt(entriesList: OutboxEntry[]): OutboxEntry[] {
  return [...entriesList].sort((a, b) => a.clientWrittenAt.localeCompare(b.clientWrittenAt));
}

export async function enqueue(input: {
  recordKey: string;
  payload: unknown;
  clientWrittenAt: string;
}): Promise<OutboxEntry> {
  const existing = await all();
  const sameKey = existing.filter((e) => e.recordKey === input.recordKey);
  const pending = sameKey.find((e) => e.status === 'pending');
  if (pending) {
    // Rule 1 — replace pending in place, preserving id.
    const updated: OutboxEntry = {
      ...pending,
      payload: input.payload,
      clientWrittenAt: input.clientWrittenAt,
      attempts: 0,
    };
    await set(updated.id, updated, outboxStore);
    return updated;
  }
  // Rule 2 (append after in-flight) and Rule 3 (first-write) both create a
  // new entry. The max-2-per-recordKey invariant holds because we only fall
  // through here when there is no pending entry for this recordKey.
  const fresh: OutboxEntry = {
    id: newId(),
    recordKey: input.recordKey,
    op: 'PUT',
    payload: input.payload,
    clientWrittenAt: input.clientWrittenAt,
    status: 'pending',
    attempts: 0,
  };
  await set(fresh.id, fresh, outboxStore);
  return fresh;
}

export async function peek(): Promise<OutboxEntry | undefined> {
  const pending = (await all()).filter((e) => e.status === 'pending');
  return sortByClientWrittenAt(pending)[0];
}

async function getById(id: string): Promise<OutboxEntry | undefined> {
  const rows = (await entries(outboxStore)) as [IDBValidKey, OutboxEntry][];
  const match = rows.find(([key]) => key === id);
  return match ? match[1] : undefined;
}

export async function markInFlight(id: string): Promise<void> {
  const entry = await getById(id);
  if (!entry) {
    throw new Error(`outbox.markInFlight: entry ${id} not found`);
  }
  if (entry.status === 'in-flight') {
    throw new Error(`outbox.markInFlight: entry ${id} already in-flight`);
  }
  await set(id, { ...entry, status: 'in-flight' as const }, outboxStore);
}

export async function markPending(id: string, attempts: number): Promise<void> {
  const entry = await getById(id);
  if (!entry) {
    throw new Error(`outbox.markPending: entry ${id} not found`);
  }
  await set(id, { ...entry, status: 'pending' as const, attempts }, outboxStore);
}

export async function remove(id: string): Promise<void> {
  // Idempotent — a stale flusher tick may call remove after coalesce.
  await del(id, outboxStore);
}

export async function listAll(): Promise<OutboxEntry[]> {
  return sortByClientWrittenAt(await all());
}

/** Test-only — clears the outbox store between cases. */
export async function __resetOutboxForTests(): Promise<void> {
  await clear(outboxStore);
}
