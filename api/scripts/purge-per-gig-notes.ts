/*
 * One-off for Story 7.16 — not app code. Removes the retired `perGigAnnotation`
 * field from every song ref in the stored setlist items. Only items that have a
 * note are rewritten, and nothing else on them changes (clientWrittenAt and
 * serverReceivedAt included — this is housekeeping, not an edit).
 *
 * Dry run (default):  pnpm --filter api exec tsx scripts/purge-per-gig-notes.ts
 * Apply:              ... scripts/purge-per-gig-notes.ts --apply
 * Region is fixed to eu-west-2. Table: TABLE_NAME env, default gigbuddy-data.
 *
 * Re-running is harmless: items without notes are skipped.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ACTIVE_BAND_ID } from '@gigbuddy/shared';

type Ref = Record<string, unknown>;
type Section = { name?: string; songs?: Ref[] };
type Item = Record<string, unknown> & { setlistId: string };

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

function sectionsOf(item: Item): Section[] {
  return (item.sections as Section[] | undefined) ?? [];
}

function notesIn(item: Item): Array<{ section: string; title: string; note: string }> {
  const notes: Array<{ section: string; title: string; note: string }> = [];
  for (const section of sectionsOf(item)) {
    for (const ref of section.songs ?? []) {
      if ('perGigAnnotation' in ref) {
        notes.push({
          section: section.name ?? '',
          title: String(ref.titleSnapshot ?? '?'),
          note: String(ref.perGigAnnotation),
        });
      }
    }
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
  const meta = item.gigMeta as { venue?: string; date?: string };
  console.log(`${item.setlistId}  ${meta.venue ?? '?'}  ${meta.date ?? '?'}`);
  for (const n of notes) console.log(`    [${n.section || '(no section)'}] ${n.title}: ${n.note}`);

  if (!apply) continue;
  const sections = sectionsOf(item).map((section) => ({
    ...section,
    songs: (section.songs ?? []).map(({ perGigAnnotation: _note, ...ref }) => ref),
  }));
  await client.send(new PutCommand({ TableName: table, Item: { ...item, sections } }));
}
console.log(`\n${items.length} setlists, ${withNotes} with notes, ${total} notes in total.`);

if (apply) {
  const left = (await loadItems()).filter((item) => notesIn(item).length > 0);
  if (left.length === 0) console.log('OK — no notes left.');
  else for (const item of left) console.log(`STILL HAS NOTES: ${item.setlistId}`);
}
