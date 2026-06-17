/*
 * V1 single-Band passive label (FR-25, FR-26). Re-exported from
 * @gigbuddy/shared so client and server agree on the same band identity
 * (the server resolves ACTIVE_BAND_ID for DDB scoping; the client renders
 * ACTIVE_BAND_NAME in the MacBook chrome).
 *
 * ACTIVE_BAND_ID is intentionally NOT re-exported here — Story 2.4+ code
 * that needs the id imports it directly from @gigbuddy/shared so the
 * single source of truth is unmistakable.
 */
export { ACTIVE_BAND_NAME } from '@gigbuddy/shared';
