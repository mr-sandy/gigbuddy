import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Song } from '@gigbuddy/shared';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDocClient } from './client.js';
import { getSong, listSongsByBand, putSong } from './songs.js';

// aws-sdk-client-mock patches the cached DocClient instance in place; we
// keep the cache for the lifetime of the test file (no __resetDdbClientForTests
// in afterEach, or the next getDocClient() would return a fresh, unpatched client).
const ddbMock = mockClient(getDocClient());

const BAND_ID = 'k0c5Db7zM2qF3vNa';
const SONG_ID = 'abcdef0123456789';

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    bandId: BAND_ID,
    songId: SONG_ID,
    title: 'Round Midnight',
    clientWrittenAt: '2026-06-16T12:00:00.000Z',
    serverReceivedAt: '2026-06-16T12:00:01.000Z',
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.TABLE_NAME = 'gigbuddy-data-test';
  ddbMock.reset();
});

describe('getSong', () => {
  it('returns undefined when DDB returns no Item', async () => {
    ddbMock.on(GetCommand).resolves({});
    const result = await getSong(BAND_ID, SONG_ID);
    expect(result).toBeUndefined();
  });

  it('returns a parsed Song when DDB returns a complete item (pk/sk stripped)', async () => {
    const song = makeSong();
    ddbMock.on(GetCommand).resolves({
      Item: { pk: `BAND#${BAND_ID}`, sk: `SONG#${SONG_ID}`, ...song },
    });
    const result = await getSong(BAND_ID, SONG_ID);
    expect(result).toEqual(song);
  });

  it('throws when DDB returns a malformed item (defends against schema drift)', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { pk: `BAND#${BAND_ID}`, sk: `SONG#${SONG_ID}`, title: 'missing rest' },
    });
    await expect(getSong(BAND_ID, SONG_ID)).rejects.toThrow();
  });

  it('issues GetCommand with the correct Key derivation', async () => {
    ddbMock.on(GetCommand).resolves({});
    await getSong(BAND_ID, SONG_ID);
    const calls = ddbMock.commandCalls(GetCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      Key: { pk: `BAND#${BAND_ID}`, sk: `SONG#${SONG_ID}` },
    });
  });
});

describe('putSong', () => {
  it('issues PutCommand with pk/sk derived from the record', async () => {
    ddbMock.on(PutCommand).resolves({});
    const song = makeSong();
    await putSong(song);
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      Item: { pk: `BAND#${BAND_ID}`, sk: `SONG#${SONG_ID}`, ...song },
    });
  });
});

describe('listSongsByBand', () => {
  it('issues QueryCommand with the correct KeyConditionExpression and values', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await listSongsByBand(BAND_ID);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: { ':pk': `BAND#${BAND_ID}`, ':skPrefix': 'SONG#' },
    });
  });

  it('pages through DDB when LastEvaluatedKey is returned and concatenates results', async () => {
    const song1 = makeSong({ songId: 'aaa1', title: 'Alpha' });
    const song2 = makeSong({ songId: 'bbb2', title: 'Bravo' });
    const cursor = { pk: `BAND#${BAND_ID}`, sk: 'SONG#aaa1' };
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [{ pk: `BAND#${BAND_ID}`, sk: `SONG#${song1.songId}`, ...song1 }],
        LastEvaluatedKey: cursor,
      })
      .resolvesOnce({
        Items: [{ pk: `BAND#${BAND_ID}`, sk: `SONG#${song2.songId}`, ...song2 }],
      });

    const result = await listSongsByBand(BAND_ID);
    expect(result).toEqual([song1, song2]);

    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args[0].input.ExclusiveStartKey).toEqual(cursor);
  });

  it('returns an empty array when the band has no Songs', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await listSongsByBand(BAND_ID);
    expect(result).toEqual([]);
  });
});
