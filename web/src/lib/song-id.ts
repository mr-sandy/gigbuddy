import { customAlphabet } from 'nanoid';

/*
 * NanoID generator for songIds (AR-47 — 16-char URL-safe). The alphabet is
 * shared with the outbox's entry IDs (sync/outbox.ts), which is why it
 * lives here as an exported constant — one source of truth for both
 * surfaces. Story 2.6's `/songs/new` flow consumes `generateSongId()` to
 * mint the URL before the first write lands.
 */
export const URL_SAFE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

const generate = customAlphabet(URL_SAFE_ALPHABET, 16);

export function generateSongId(): string {
  return generate();
}
