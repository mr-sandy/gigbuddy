import { customAlphabet } from 'nanoid';

/*
 * NanoID generator for opaque 16-char URL-safe IDs (AR-47). Used for every
 * persisted record kind — songIds, setlistIds, outbox entry IDs — because
 * NanoIDs are general-purpose. The alphabet is exported so the outbox can
 * reuse it without duplicating the constant.
 */
export const URL_SAFE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

const generate = customAlphabet(URL_SAFE_ALPHABET, 16);

export function generateId(): string {
  return generate();
}
