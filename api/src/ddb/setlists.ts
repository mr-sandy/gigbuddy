import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { type Setlist, SetlistSchema } from '@gigbuddy/shared';
import { getDocClient, getTableName } from './client.js';

/*
 * Setlist DDB wrapper (AR-42 — only legal Setlist DDB surface). Items are
 * persisted as a single record per Setlist with embedded sections + song
 * refs + per-gig annotations (AR-9), keyed for both single-record reads
 * (main table) and date-ordered list reads (GSI1 — AR-10).
 *
 * Key derivation:
 *   pk      = BAND#<bandId>
 *   sk      = SETLIST#<gigMeta.date>#<setlistId>
 *   gsi1pk  = BAND#<bandId>#SETLIST_BY_DATE
 *   gsi1sk  = <gigMeta.date>#<setlistId>
 *
 * Trade-off — getSetlist uses Query not GetCommand:
 *   The sk includes <isoDate>. A GetCommand requires the full, exact sk,
 *   but `getSetlist(bandId, setlistId)` has no isoDate at call time (the
 *   route only receives :setlistId from the path). We query the partition
 *   `pk = BAND#<bandId>` with `begins_with(sk, 'SETLIST#')` and filter the
 *   returned Items by setlistId. At V1 single-tenant volume (≤ a few
 *   hundred setlists per band) this is comfortable. Future alternatives:
 *   add a SETLIST_META# item pointing to the canonical sk, or change the
 *   sk shape — both are infra changes outside Story 3.1's scope.
 */
const GSI1_INDEX_NAME = 'GSI1';

function setlistKey(bandId: string, isoDate: string, setlistId: string) {
  return { pk: `BAND#${bandId}`, sk: `SETLIST#${isoDate}#${setlistId}` };
}

function setlistGsi1Key(bandId: string, isoDate: string, setlistId: string) {
  return {
    gsi1pk: `BAND#${bandId}#SETLIST_BY_DATE`,
    gsi1sk: `${isoDate}#${setlistId}`,
  };
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

export async function getSetlist(bandId: string, setlistId: string): Promise<Setlist | undefined> {
  // Query the partition for items whose sk begins with 'SETLIST#', then
  // filter by setlistId in memory. See module-level comment for the
  // trade-off rationale (no isoDate at call time → cannot Get directly).
  const client = getDocClient();
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `BAND#${bandId}`, ':skPrefix': 'SETLIST#' },
        ExclusiveStartKey: cursor,
      }),
    );
    for (const item of result.Items ?? []) {
      if (typeof item.setlistId === 'string' && item.setlistId === setlistId) {
        return stripKeyAttrs(item);
      }
    }
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return undefined;
}

export async function putSetlist(record: Setlist): Promise<void> {
  const { date } = record.gigMeta;
  await getDocClient().send(
    new PutCommand({
      TableName: getTableName(),
      Item: {
        ...setlistKey(record.bandId, date, record.setlistId),
        ...setlistGsi1Key(record.bandId, date, record.setlistId),
        ...record,
      },
    }),
  );
}

export async function listSetlistsByBand(bandId: string): Promise<Setlist[]> {
  const client = getDocClient();
  const out: Setlist[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: getTableName(),
        IndexName: GSI1_INDEX_NAME,
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': `BAND#${bandId}#SETLIST_BY_DATE` },
        ScanIndexForward: true, // ascending gsi1sk (date)
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
