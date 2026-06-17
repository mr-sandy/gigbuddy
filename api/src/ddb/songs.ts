import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { type Song, SongSchema } from '@gigbuddy/shared';
import { getDocClient, getTableName } from './client.js';

function songKey(bandId: string, songId: string) {
  return { pk: `BAND#${bandId}`, sk: `SONG#${songId}` };
}

export async function getSong(bandId: string, songId: string): Promise<Song | undefined> {
  const result = await getDocClient().send(
    new GetCommand({ TableName: getTableName(), Key: songKey(bandId, songId) }),
  );
  if (!result.Item) return undefined;
  // pk/sk are written by putSong as DDB key attributes; Song's schema doesn't carry them
  const { pk: _pk, sk: _sk, ...rest } = result.Item as { pk: string; sk: string } & Song;
  return SongSchema.parse(rest);
}

export async function putSong(record: Song): Promise<void> {
  await getDocClient().send(
    new PutCommand({
      TableName: getTableName(),
      Item: { ...songKey(record.bandId, record.songId), ...record },
    }),
  );
}

export async function listSongsByBand(bandId: string): Promise<Song[]> {
  const client = getDocClient();
  const out: Song[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `BAND#${bandId}`, ':skPrefix': 'SONG#' },
        ExclusiveStartKey: cursor,
      }),
    );
    for (const item of result.Items ?? []) {
      const { pk: _pk, sk: _sk, ...rest } = item as { pk: string; sk: string } & Song;
      out.push(SongSchema.parse(rest));
    }
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return out;
}
