import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { type Setlist, SetlistSchema } from '@gigbuddy/shared';
import { getDocClient, getTableName } from './client.js';

/*
 * Gigs DDB wrapper — Story 4.5 (AR-40, AR-42). The "Tonight-Gig" pre-fetch
 * and the `/api/v1/upcoming-gigs` endpoint both consume this module: it
 * queries the GSI1 setlist-by-date index for Setlists whose `gigMeta.date`
 * falls inside a [todayIso, tomorrowIso] Europe/London window.
 *
 * `infra/scripts/blackout-check.ts` carries the same 24h Europe/London
 * semantics for the deploy guard (Story 1.6). We do NOT import the helper
 * across that boundary — `infra/` is CDK/deploy tooling, not a consumable
 * library — so the London-calendar window helper is replicated inline
 * here (and asserted to match by a co-located self-test, AC-9).
 *
 * Key shape (matches the GSI1 write in `ddb/setlists.ts`):
 *   gsi1pk = BAND#<bandId>#SETLIST_BY_DATE
 *   gsi1sk = <isoDate>#<setlistId>
 *
 * BETWEEN range:
 *   :from = "<todayIso>#"        (inclusive lower bound)
 *   :to   = "<tomorrowIso>#zzzz" (inclusive upper bound — the `zzzz`
 *                                 suffix ensures every setlistId value
 *                                 for that date is included; matches the
 *                                 `blackout-check.ts` scan pattern).
 */

const GSI1_INDEX_NAME = 'GSI1';

/**
 * Returns the calendar date in `Europe/London` as `YYYY-MM-DD`.
 *
 * Replicated from `infra/scripts/blackout-check.ts:londonIsoDate`. The
 * co-located self-test (`gigs.test.ts`) asserts the two helpers produce
 * the same output for representative inputs spanning BST/GMT and UTC
 * midnight rollover (AC-9, Story 1.6 self-test requirement).
 */
export function londonIsoDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

type RawSetlistItem = {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
} & Setlist;

function stripKeyAttrs(item: Record<string, unknown>): Setlist {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ...rest } = item as RawSetlistItem;
  return SetlistSchema.parse(rest);
}

export async function listUpcomingGigs(
  bandId: string,
  todayIso: string,
  tomorrowIso: string,
): Promise<Setlist[]> {
  const client = getDocClient();
  const out: Setlist[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: GSI1_INDEX_NAME,
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `BAND#${bandId}#SETLIST_BY_DATE`,
          ':from': `${todayIso}#`,
          ':to': `${tomorrowIso}#zzzz`,
        },
        ScanIndexForward: true,
        ExclusiveStartKey: cursor,
      }),
    );
    for (const item of result.Items ?? []) {
      out.push(stripKeyAttrs(item));
    }
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return out;
}
