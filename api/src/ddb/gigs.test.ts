import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Setlist } from '@gigbuddy/shared';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDocClient } from './client.js';
import { listUpcomingGigs, londonIsoDate } from './gigs.js';

// aws-sdk-client-mock patches the cached DocClient in place; we keep the
// cache across cases (same pattern as setlists.test.ts).
const ddbMock = mockClient(getDocClient());

const BAND_ID = 'k0c5Db7zM2qF3vNa';
const SETLIST_ID = 'abc123setlist001';
const TODAY = '2026-06-21';
const TOMORROW = '2026-06-22';

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    bandId: BAND_ID,
    setlistId: SETLIST_ID,
    gigMeta: { venue: 'The Jazz Cafe', date: TODAY, time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [{ songId: 'song0000000001ab', titleSnapshot: 'Round Midnight' }],
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

describe('listUpcomingGigs', () => {
  it('issues a QueryCommand on GSI1 with a BETWEEN range on gsi1sk', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await listUpcomingGigs(BAND_ID, TODAY, TOMORROW);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      TableName: 'gigbuddy-data-test',
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':pk': `BAND#${BAND_ID}#SETLIST_BY_DATE`,
        ':from': `${TODAY}#`,
        ':to': `${TOMORROW}#zzzz`,
      },
      ScanIndexForward: true,
    });
  });

  it('returns an empty array when no setlists fall in the window', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const result = await listUpcomingGigs(BAND_ID, TODAY, TOMORROW);
    expect(result).toEqual([]);
  });

  it('returns parsed Setlist records with pk/sk/gsi attrs stripped', async () => {
    const setlist = makeSetlist();
    ddbMock.on(QueryCommand).resolves({ Items: [rawItem(setlist)] });
    const result = await listUpcomingGigs(BAND_ID, TODAY, TOMORROW);
    expect(result).toEqual([setlist]);
  });

  it('pages through DDB when LastEvaluatedKey is returned and concatenates results', async () => {
    const s1 = makeSetlist({
      setlistId: 'aaaa1111aaaa1111',
      gigMeta: { venue: 'A', date: TODAY },
    });
    const s2 = makeSetlist({
      setlistId: 'bbbb2222bbbb2222',
      gigMeta: { venue: 'B', date: TOMORROW },
    });
    const cursor = { gsi1pk: 'X', gsi1sk: 'Y', pk: 'A', sk: 'B' };
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [rawItem(s1)], LastEvaluatedKey: cursor })
      .resolvesOnce({ Items: [rawItem(s2)] });
    const result = await listUpcomingGigs(BAND_ID, TODAY, TOMORROW);
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
          sk: `SETLIST#${TODAY}#${SETLIST_ID}`,
          gsi1pk: `BAND#${BAND_ID}#SETLIST_BY_DATE`,
          gsi1sk: `${TODAY}#${SETLIST_ID}`,
          setlistId: SETLIST_ID,
          // missing required fields
        },
      ],
    });
    await expect(listUpcomingGigs(BAND_ID, TODAY, TOMORROW)).rejects.toThrow();
  });
});

/*
 * AC-9 self-test: the inline `londonIsoDate` helper in `gigs.ts` MUST
 * produce the same value as the same-named helper in
 * `infra/scripts/blackout-check.ts`. The two are intentionally duplicated
 * (the `infra/` package is CDK/deploy tooling and not a consumable library
 * for the api package — cross-package import would violate the
 * architecture boundary table), so a self-test guards against semantic
 * drift. The expected values below are the verbatim outputs of the
 * blackout-check helper at the corresponding UTC instants (see
 * `infra/scripts/blackout-check.test.ts` for the matching test cases).
 */
describe('AC-9 — londonIsoDate matches blackout-check.ts semantics', () => {
  const cases: { label: string; at: Date; expected: string }[] = [
    {
      label: 'BST evening near midnight London (UTC 22:30 → 23:30 BST same day)',
      at: new Date('2026-07-01T22:30:00Z'),
      expected: '2026-07-01',
    },
    {
      label: 'GMT winter just before midnight London (UTC 22:30 == GMT 22:30 same day)',
      at: new Date('2026-01-15T22:30:00Z'),
      expected: '2026-01-15',
    },
    {
      label: 'DST spring-forward day (UTC 01:30 → BST 02:30 same day)',
      at: new Date('2026-03-29T01:30:00Z'),
      expected: '2026-03-29',
    },
    {
      label: 'UTC midnight Mon during GMT (== London midnight Mon)',
      at: new Date('2026-01-19T00:00:00Z'),
      expected: '2026-01-19',
    },
    {
      label: 'BST Sun late afternoon (UTC 16:59 → BST 17:59 same day)',
      at: new Date('2026-06-21T16:59:00Z'),
      expected: '2026-06-21',
    },
  ];
  for (const c of cases) {
    it(`${c.label}`, () => {
      expect(londonIsoDate(c.at)).toBe(c.expected);
    });
  }
});
