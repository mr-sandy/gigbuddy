import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Setlist } from '@gigbuddy/shared';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDocClient } from './client.js';
import { getSetlist, listSetlistsByBand, putSetlist } from './setlists.js';

// aws-sdk-client-mock patches the cached DocClient instance in place; we
// keep the cache for the lifetime of the test file (no __resetDdbClientForTests
// in afterEach, or the next getDocClient() would return a fresh, unpatched client).
const ddbMock = mockClient(getDocClient());

const BAND_ID = 'k0c5Db7zM2qF3vNa';
const SETLIST_ID = 'abc123setlist001';
const ISO_DATE = '2026-06-21';

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: BAND_ID,
    setlistId: SETLIST_ID,
    gigMeta: { venue: 'The Jazz Cafe', date: ISO_DATE, time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          { songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' },
          {
            songId: 'song0000000002cd',
            titleSnapshot: 'Autumn Leaves',
            perGigAnnotation: 'start slow',
          },
        ],
      },
    ],
    clientWrittenAt: '2026-06-19T10:00:00.000Z',
    serverReceivedAt: '2026-06-19T10:00:01.000Z',
    version: 1,
    ...overrides,
  };
}

function rawItem(setlist: Setlist) {
  const { bandId, setlistId, gigMeta } = setlist;
  return {
    pk: `BAND#${bandId}`,
    sk: `SETLIST#${gigMeta.date}#${setlistId}`,
    gsi1pk: `BAND#${bandId}#SETLIST_BY_DATE`,
    gsi1sk: `${gigMeta.date}#${setlistId}`,
    ...setlist,
  };
}

beforeEach(() => {
  process.env.TABLE_NAME = 'gigbuddy-data-test';
  ddbMock.reset();
});

describe('getSetlist', () => {
  it('returns undefined when DDB returns no Items', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await getSetlist(BAND_ID, SETLIST_ID);
    expect(result).toBeUndefined();
  });

  it('returns a parsed Setlist when DDB returns a matching item (pk/sk/gsi attrs stripped)', async () => {
    const setlist = makeSetlist();
    ddbMock.on(QueryCommand).resolves({ Items: [rawItem(setlist)] });
    const result = await getSetlist(BAND_ID, SETLIST_ID);
    expect(result).toEqual(setlist);
  });

  it('returns undefined when no Item matches the setlistId (multiple setlists in partition)', async () => {
    const other = makeSetlist({
      setlistId: 'differentSetlistI',
      gigMeta: { venue: 'X', date: '2026-07-01' },
    });
    ddbMock.on(QueryCommand).resolves({ Items: [rawItem(other)] });
    const result = await getSetlist(BAND_ID, SETLIST_ID);
    expect(result).toBeUndefined();
  });

  it('throws when DDB returns a malformed item (defends against schema drift)', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          pk: `BAND#${BAND_ID}`,
          sk: `SETLIST#${ISO_DATE}#${SETLIST_ID}`,
          setlistId: SETLIST_ID,
          // missing required bandId / gigMeta / sections / etc.
        },
      ],
    });
    await expect(getSetlist(BAND_ID, SETLIST_ID)).rejects.toThrow();
  });

  it('issues a QueryCommand on the main table with pk + begins_with(sk, "SETLIST#")', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await getSetlist(BAND_ID, SETLIST_ID);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input;
    expect(input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: { ':pk': `BAND#${BAND_ID}`, ':skPrefix': 'SETLIST#' },
    });
    // confirms the Query approach not GetCommand: no IndexName on this main-table query
    expect(input?.IndexName).toBeUndefined();
  });

  it('pages through DDB when LastEvaluatedKey is returned', async () => {
    const target = makeSetlist();
    const cursor = { pk: `BAND#${BAND_ID}`, sk: `SETLIST#${ISO_DATE}#zzz` };
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [], LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [rawItem(target)] });
    const result = await getSetlist(BAND_ID, SETLIST_ID);
    expect(result).toEqual(target);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args[0].input.ExclusiveStartKey).toEqual(cursor);
  });
});

describe('putSetlist', () => {
  it('issues a PutCommand with pk, sk, gsi1pk, gsi1sk all derived from the record', async () => {
    ddbMock.on(PutCommand).resolves({});
    const setlist = makeSetlist();
    await putSetlist(setlist);
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      Item: {
        pk: `BAND#${BAND_ID}`,
        sk: `SETLIST#${ISO_DATE}#${SETLIST_ID}`,
        gsi1pk: `BAND#${BAND_ID}#SETLIST_BY_DATE`,
        gsi1sk: `${ISO_DATE}#${SETLIST_ID}`,
        ...setlist,
      },
    });
  });
});

describe('listSetlistsByBand', () => {
  it('issues a QueryCommand on the GSI1 index with gsi1pk and ScanIndexForward true', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await listSetlistsByBand(BAND_ID);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `BAND#${BAND_ID}#SETLIST_BY_DATE` },
      ScanIndexForward: true,
    });
  });

  it('returns an empty array when the band has no Setlists', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await listSetlistsByBand(BAND_ID);
    expect(result).toEqual([]);
  });

  it('returns Setlists in DDB order (ascending gsi1sk)', async () => {
    const earlier = makeSetlist({
      setlistId: 'aaaaaaaaaaaaaaaa',
      gigMeta: { venue: 'A', date: '2026-06-01', time: '20:00' },
    });
    const later = makeSetlist({
      setlistId: 'bbbbbbbbbbbbbbbb',
      gigMeta: { venue: 'B', date: '2026-07-01', time: '21:00' },
    });
    ddbMock.on(QueryCommand).resolves({ Items: [rawItem(earlier), rawItem(later)] });
    const result = await listSetlistsByBand(BAND_ID);
    expect(result).toEqual([earlier, later]);
  });

  it('pages through DDB when LastEvaluatedKey is returned and concatenates results', async () => {
    const s1 = makeSetlist({
      setlistId: 'aaaa1111aaaa1111',
      gigMeta: { venue: 'A', date: '2026-06-01' },
    });
    const s2 = makeSetlist({
      setlistId: 'bbbb2222bbbb2222',
      gigMeta: { venue: 'B', date: '2026-07-01' },
    });
    const cursor = { gsi1pk: 'X', gsi1sk: 'Y', pk: 'A', sk: 'B' };
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [rawItem(s1)], LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [rawItem(s2)] });
    const result = await listSetlistsByBand(BAND_ID);
    expect(result).toEqual([s1, s2]);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args[0].input.ExclusiveStartKey).toEqual(cursor);
  });

  it('throws when DDB returns a malformed item (defends against schema drift)', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          pk: `BAND#${BAND_ID}`,
          sk: `SETLIST#${ISO_DATE}#${SETLIST_ID}`,
          gsi1pk: `BAND#${BAND_ID}#SETLIST_BY_DATE`,
          gsi1sk: `${ISO_DATE}#${SETLIST_ID}`,
          setlistId: SETLIST_ID,
          // missing required fields
        },
      ],
    });
    await expect(listSetlistsByBand(BAND_ID)).rejects.toThrow();
  });
});
