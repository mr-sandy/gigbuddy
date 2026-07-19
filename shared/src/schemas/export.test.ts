import { describe, expect, it } from 'vitest';
import { ExportSchema } from './export.js';

function makeSong() {
  return {
    bandId: 'band000000000001',
    songId: 'song000000000001',
    title: 'Autumn Leaves',
    clientWrittenAt: '2026-07-19T10:00:00.000Z',
    serverReceivedAt: '2026-07-19T10:00:01.000Z',
    version: 1 as const,
  };
}

function makeSetlist() {
  return {
    bandId: 'band000000000001',
    setlistId: 'setl000000000001',
    gigMeta: { venue: 'The Jazz Cafe', date: '2026-07-20', time: '20:00' },
    sections: [
      {
        name: 'Set 1',
        songs: [
          {
            songId: 'song000000000001',
            titleSnapshot: 'Autumn Leaves',
            perGigAnnotation: 'half-time feel',
          },
        ],
      },
    ],
    clientWrittenAt: '2026-07-19T10:00:00.000Z',
    serverReceivedAt: '2026-07-19T10:00:01.000Z',
    version: 1 as const,
  };
}

describe('ExportSchema', () => {
  it('round-trips a minimal valid empty-library payload', () => {
    const payload = {
      exportedAt: '2026-07-19T10:00:00.000Z',
      schemaVersion: 1 as const,
      bands: [
        {
          band: { bandId: 'band000000000001', name: 'The Jack Ruby 5' },
          songs: [],
          setlists: [],
        },
      ],
    };
    const parsed = ExportSchema.parse(payload);
    expect(parsed).toEqual(payload);
  });

  it('round-trips a populated payload preserving Song and Setlist detail', () => {
    const song = makeSong();
    const setlist = makeSetlist();
    const payload = {
      exportedAt: '2026-07-19T10:00:00.000Z',
      schemaVersion: 1 as const,
      bands: [
        {
          band: { bandId: 'band000000000001', name: 'The Jack Ruby 5' },
          songs: [song],
          setlists: [setlist],
        },
      ],
    };
    const parsed = ExportSchema.parse(payload);
    expect(parsed.bands[0]?.songs[0]).toEqual(song);
    expect(parsed.bands[0]?.setlists[0]).toEqual(setlist);
    expect(parsed.bands[0]?.setlists[0]?.sections[0]?.songs[0]?.perGigAnnotation).toBe(
      'half-time feel',
    );
    expect(parsed.bands[0]?.setlists[0]?.sections[0]?.songs[0]?.titleSnapshot).toBe(
      'Autumn Leaves',
    );
  });

  it('rejects a payload whose schemaVersion is not the literal 1', () => {
    const payload = {
      exportedAt: '2026-07-19T10:00:00.000Z',
      schemaVersion: 2,
      bands: [],
    };
    const result = ExportSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a payload whose exportedAt is not ISO-8601', () => {
    const payload = {
      exportedAt: 'yesterday',
      schemaVersion: 1 as const,
      bands: [],
    };
    const result = ExportSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
