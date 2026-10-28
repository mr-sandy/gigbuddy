/*
 * One-off for Story 7.31 — not app code. Removes the retired `performanceNotes`
 * and `practiceNotes` fields from every stored song item. Only items that have a
 * note are touched, and only those two attributes are removed (clientWrittenAt and
 * serverReceivedAt included — this is housekeeping, not an edit). A conditional
 * UpdateCommand rather than a whole-item Put, so an edit saved mid-run is kept
 * and a song deleted mid-run is not brought back.
 *
 * Dry run (default):  pnpm --filter api exec tsx scripts/purge-song-notes.ts
 * Apply:              ... scripts/purge-song-notes.ts --apply
 * Region is fixed to eu-west-2. Table: TABLE_NAME env, default gigbuddy-data.
 *
 * Re-running is harmless: items without notes are skipped.
 */
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ACTIVE_BAND_ID } from '@gigbuddy/shared';

type Item = Record<string, unknown> & { pk: string; sk: string; songId: string };

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
        ExpressionAttributeValues: { ':pk': `BAND#${bandId}`, ':skPrefix': 'SONG#' },
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
      }),
    );
    items.push(...((result.Items ?? []) as Item[]));
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return items;
}

function notesIn(item: Item): Array<{ label: string; note: string }> {
  const notes: Array<{ label: string; note: string }> = [];
  if ('performanceNotes' in item) {
    notes.push({ label: 'performance', note: String(item.performanceNotes) });
  }
  if ('practiceNotes' in item) {
    notes.push({ label: 'practice', note: String(item.practiceNotes) });
  }
  return notes;
}

const items = await loadItems();
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — table ${table}, band ${bandId}`);

let withNotes = 0;
let total = 0;
for (const item of items) {
  const notes = notesIn(item);
  if (notes.length === 0) continue;
  withNotes++;
  total += notes.length;
  console.log(`${item.songId}  ${String(item.title ?? '?')}`);
  for (const n of notes) console.log(`    ${n.label}: ${n.note}`);

  if (!apply) continue;
  try {
    await client.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression: 'REMOVE performanceNotes, practiceNotes',
        ConditionExpression: 'attribute_exists(pk)',
      }),
    );
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
    console.log('    skipped: deleted since it was read');
  }
}
console.log(`\n${items.length} songs, ${withNotes} with notes, ${total} notes in total.`);

if (apply) {
  const left = (await loadItems()).filter((item) => notesIn(item).length > 0);
  if (left.length === 0) console.log('OK — no notes left.');
  else for (const item of left) console.log(`STILL HAS NOTES: ${item.songId}`);
}
