import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
 *   sk      = SETLIST#<setlistId>
 *   gsi1pk  = BAND#<bandId>#SETLIST_BY_DATE
 *   gsi1sk  = <gigMeta.date>#<setlistId>
 *
 * The date lives only in gsi1sk, so changing a gig's date overwrites the
 * same item and can't leave a stale copy behind (Story 7.13).
 */
const GSI1_INDEX_NAME = 'GSI1';

function setlistKey(bandId: string, setlistId: string) {
  return { pk: `BAND#${bandId}`, sk: `SETLIST#${setlistId}` };
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
  const result = await getDocClient().send(
    new GetCommand({ TableName: getTableName(), Key: setlistKey(bandId, setlistId) }),
  );
  return result.Item ? stripKeyAttrs(result.Item) : undefined;
}

export async function putSetlist(record: Setlist): Promise<void> {
  const { date } = record.gigMeta;
  await getDocClient().send(
    new PutCommand({
      TableName: getTableName(),
      Item: {
        ...setlistKey(record.bandId, record.setlistId),
        ...setlistGsi1Key(record.bandId, date, record.setlistId),
        ...record,
      },
    }),
  );
}

export async function deleteSetlist(bandId: string, setlistId: string): Promise<void> {
  // Deleting a missing key is a DDB no-op, so a missing gig succeeds quietly.
  await getDocClient().send(
    new DeleteCommand({ TableName: getTableName(), Key: setlistKey(bandId, setlistId) }),
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
