import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/*
 * Single DocClient cached in module-scope memory for the warm Lambda
 * lifetime. AR-42: this is the ONLY @aws-sdk/client-dynamodb and
 * @aws-sdk/lib-dynamodb import in api/ outside this file. Route handlers
 * call getSong / putSong / listSongsByBand in api/src/ddb/songs.ts; those
 * call getDocClient() here.
 *
 * Region resolution: the Lambda runtime sets AWS_REGION automatically.
 * Local dev (tsx watch) falls back to eu-west-2 to match the deployed
 * region (architecture.md "Region: eu-west-2 (London)").
 *
 * marshallOptions.removeUndefinedValues: optional Song fields (key, patch,
 * chordChart, etc.) come through as `undefined` when not provided. Without
 * this flag the DocClient writes them as DDB NULL values, which
 * SongSchema.parse rejects on read. Eliding them is the correct shape:
 * re-reads return an object without the missing keys, matching .optional().
 */
let cached: DynamoDBDocumentClient | undefined;

export function getDocClient(): DynamoDBDocumentClient {
  if (cached) return cached;
  const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
  cached = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return cached;
}

/*
 * Read TABLE_NAME lazily at call time so a missing env var surfaces in the
 * handler's error path (where the logger middleware captures it as a
 * structured log line) rather than at module-load on cold start.
 */
export function getTableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME env var is not set');
  return name;
}

/** Test-only: clear the module-scope cache between cases. Not exported via any barrel. */
export function __resetDdbClientForTests(): void {
  cached = undefined;
}
