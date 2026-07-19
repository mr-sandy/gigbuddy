import { ACTIVE_BAND_ID, ACTIVE_BAND_NAME, ExportSchema } from '@gigbuddy/shared';
import { Hono } from 'hono';
import { londonIsoDate } from '../ddb/gigs.js';
import { listSetlistsByBand } from '../ddb/setlists.js';
import { listSongsByBand } from '../ddb/songs.js';

/*
 * `/api/v1/export` — Story 5.1 (FR-33, AR-38). One-tap JSON archive of the
 * active Band's full Library and Setlist history. Assembled in-Lambda (no
 * streaming) — Sandy's realistic volume is ~MB-scale, well under the
 * 512MB Lambda budget (see architecture.md "Export endpoint").
 *
 * Auth is enforced by the global `authMiddleware` registered in `app.ts` —
 * no route-level check required. `x-server-now` is stamped by the global
 * `serverNowMiddleware`.
 *
 * Response envelope: the body is the raw archive shape (`exportedAt` /
 * `schemaVersion` / `bands`), NOT the standard `{status, data}` read
 * envelope. This is an intentional, documented deviation for the single
 * download endpoint (architecture.md "Export endpoint"). `Content-
 * Disposition: attachment` drives the browser's native save-dialog on a
 * plain `<a>` navigation from the MacBook Library footer link.
 *
 * V1 has no Band DDB item — `ACTIVE_BAND_ID` / `ACTIVE_BAND_NAME` are
 * hardcoded constants in `shared/src/active-band.ts` (V2 will replace this
 * with a REGISTRY read). Build the `band` field from those two constants;
 * do NOT introduce a `ddb/bands.ts` read path.
 */
export const exportRoute = new Hono().get('/', async (c) => {
  const [songs, setlists] = await Promise.all([
    listSongsByBand(ACTIVE_BAND_ID),
    listSetlistsByBand(ACTIVE_BAND_ID),
  ]);
  const payload = ExportSchema.parse({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    bands: [
      {
        band: { bandId: ACTIVE_BAND_ID, name: ACTIVE_BAND_NAME },
        songs,
        setlists,
      },
    ],
  });
  const filename = `gigbuddy-${londonIsoDate(new Date())}.json`;
  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  return c.json(payload);
});
