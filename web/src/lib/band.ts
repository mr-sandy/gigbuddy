/*
 * V1 single-Band scope (FR-25, FR-26). The Jack Ruby 5 is the only Band that
 * carries content in V1. The name appears in the MacBook top-nav passive
 * label only (per FR-26 — no switcher in V1; iPhone chrome shows no Band
 * label).
 *
 * V2 / Multi-Band: this constant becomes a `useActiveBand()` hook backed by
 * the REGISTRY item in DDB (architecture.md Decision 2 "V2 evolution paths").
 * Do NOT add band metadata fetching in this story.
 */
export const ACTIVE_BAND_NAME = 'The Jack Ruby 5' as const;
