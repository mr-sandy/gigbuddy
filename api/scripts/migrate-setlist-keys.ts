/*
 * One-off for Story 7.13 — not app code. Moves setlist items from
 * sk = SETLIST#<date>#<setlistId> to sk = SETLIST#<setlistId>, keeping only
 * the latest copy of each setlistId (latest clientWrittenAt, tie → latest
 * serverReceivedAt). Key strings mirror api/src/ddb/setlists.ts.
 *
 * Dry run (default):  pnpm --filter api exec tsx scripts/migrate-setlist-keys.ts
 * Apply:              ... scripts/migrate-setlist-keys.ts --apply
 * Region is fixed to eu-west-2. Table: TABLE_NAME env, default gigbuddy-data.
 *
 * Put-before-delete, so stopping halfway loses nothing; re-running is harmless.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ACTIVE_BAND_ID } from '@gigbuddy/shared';

type Item = Record<string, unknown> & { sk: string; setlistId: string };

const apply = process.argv.includes('--apply');
const table = process.env.TABLE_NAME ?? 'gigbuddy-data';
const bandId = ACTIVE_BAND_ID;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-west-2' }));

async function loadItems(): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `BAND#${bandId}`, ':skPrefix': 'SETLIST#' },
        ExclusiveStartKey: cursor,
      }),
    );
    items.push(...((result.Items ?? []) as Item[]));
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return items;
}

function isNewer(a: Item, b: Item): boolean {
  const aw = String(a.clientWrittenAt);
  const bw = String(b.clientWrittenAt);
  if (aw !== bw) return aw > bw;
  return String(a.serverReceivedAt) > String(b.serverReceivedAt);
}

const groups = new Map<string, Item[]>();
for (const item of await loadItems()) {
  groups.set(item.setlistId, [...(groups.get(item.setlistId) ?? []), item]);
}

console.log(`${apply ? 'APPLY' : 'DRY RUN'} — table ${table}, band ${bandId}`);
let multi = 0;
for (const [setlistId, items] of groups) {
  const winner = items.reduce((best, item) => (isNewer(item, best) ? item : best));
  const meta = winner.gigMeta as { venue?: string; date?: string };
  const flag = items.length > 1 ? '  <-- MULTIPLE' : '';
  if (items.length > 1) multi++;
  console.log(
    `${setlistId}  ${meta.venue ?? '?'}  ${meta.date ?? '?'}  items=${items.length}  [${items.map((i) => (i === winner ? `*${i.sk}` : i.sk)).join(', ')}]${flag}`,
  );

  if (!apply) continue;
  const newSk = `SETLIST#${setlistId}`;
  const { pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ...record } = winner;
  await client.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk,
        sk: newSk,
        gsi1pk: `BAND#${bandId}#SETLIST_BY_DATE`,
        gsi1sk: `${meta.date}#${setlistId}`,
        ...record,
      },
    }),
  );
  for (const item of items) {
    if (item.sk !== newSk) {
      await client.send(new DeleteCommand({ TableName: table, Key: { pk, sk: item.sk } }));
    }
  }
}
console.log(`\n${groups.size} setlists, ${multi} with more than one item (* = copy kept).`);

if (apply) {
  const after = new Map<string, string[]>();
  for (const item of await loadItems()) {
    after.set(item.setlistId, [...(after.get(item.setlistId) ?? []), item.sk]);
  }
  for (const [setlistId, sks] of after) {
    const ok = sks.length === 1 && sks[0] === `SETLIST#${setlistId}`;
    console.log(`${ok ? 'OK ' : 'BAD'} ${setlistId} → ${sks.join(', ')}`);
  }
}
