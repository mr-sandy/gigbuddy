/*
 * V1 single-Band identifier (FR-25, FR-26; AR-47 NanoID 16-char URL-safe).
 *
 * - ACTIVE_BAND_ID is the partition-key suffix for every Song and Setlist
 *   item written by Sandy in V1. Stable for V1's lifetime.
 * - ACTIVE_BAND_NAME drives the MacBook passive band label only
 *   (web/src/components/band-label.tsx). iPhone chrome shows no band label.
 *
 * V2 / Multi-Band: replace with a useActiveBand() hook backed by the
 * REGISTRY item in DDB (architecture.md Decision 2 V2 evolution paths).
 * Do NOT add band-metadata fetching here in V1.
 */
export const ACTIVE_BAND_ID = 'k0c5Db7zM2qF3vNa' as const;
export const ACTIVE_BAND_NAME = 'The Jack Ruby 5' as const;
