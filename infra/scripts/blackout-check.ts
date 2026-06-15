import { DescribeTableCommand, DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = 'gigbuddy-data';
const REGION = 'eu-west-2';
export const FAIL_CLOSED_MESSAGE =
  'blackout check could not run reliably; use deploy-force.yml after confirming no Gig in 24h';

export type Gig = {
  gigMeta: { venue: string; date: string; time?: string };
};

export type BlackoutDecision =
  | { exit: 0; stdout: string; blockingGigs: [] }
  | { exit: 1; stderr: string; blockingGigs: Gig[] };

export type Deps = {
  now: Date;
  describeTable: () => Promise<unknown>;
  scanGigs: (londonIsoDateToday: string, londonIsoDateTomorrow: string) => Promise<Gig[]>;
};

export function londonIsoDate(at: Date): string {
  // en-CA formats dates as YYYY-MM-DD natively
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function londonWeekday(at: Date): 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(at);
  return weekday as 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
}

export function londonHour(at: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    hour12: false,
  }).format(at);
  // Some engines return '24' for midnight; normalize to [0..23]
  return Number(hourStr) % 24;
}

function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatGig({ gigMeta }: Gig): string {
  const tail = gigMeta.time ? ` ${gigMeta.time}` : '';
  return `BLOCKED: ${gigMeta.venue} @ ${gigMeta.date}${tail}`;
}

function compareGigs(a: Gig, b: Gig): number {
  if (a.gigMeta.date !== b.gigMeta.date) {
    return a.gigMeta.date < b.gigMeta.date ? -1 : 1;
  }
  const at = a.gigMeta.time ?? '';
  const bt = b.gigMeta.time ?? '';
  if (at === bt) return 0;
  return at < bt ? -1 : 1;
}

export async function decideBlackout(deps: Deps): Promise<BlackoutDecision> {
  // Stage 1: DescribeTable — proves IAM + network connectivity to DDB.
  try {
    await deps.describeTable();
  } catch {
    return { exit: 1, stderr: FAIL_CLOSED_MESSAGE, blockingGigs: [] };
  }

  // Stage 2: Scan GSI1 for setlists with a gigDate in [today, tomorrow] Europe/London.
  const todayKey = `${londonIsoDate(deps.now)}#`;
  const tomorrowKey = `${londonIsoDate(addDays(deps.now, 1))}#`;
  let gigs: Gig[];
  try {
    gigs = await deps.scanGigs(todayKey, tomorrowKey);
  } catch {
    return { exit: 1, stderr: FAIL_CLOSED_MESSAGE, blockingGigs: [] };
  }

  if (gigs.length > 0) {
    const sorted = [...gigs].sort(compareGigs);
    return {
      exit: 1,
      stderr: sorted.map(formatGig).join('\n'),
      blockingGigs: sorted,
    };
  }

  // Static fallback: refuse Fri/Sat/Sun 18:00–23:59 Europe/London when no Gig data exists.
  const weekday = londonWeekday(deps.now);
  const hour = londonHour(deps.now);
  if ((weekday === 'Fri' || weekday === 'Sat' || weekday === 'Sun') && hour >= 18 && hour < 24) {
    const hh = String(hour).padStart(2, '0');
    const mm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      minute: '2-digit',
    })
      .format(deps.now)
      .padStart(2, '0');
    return {
      exit: 1,
      stderr: `BLOCKED: weekend evening static fallback (${weekday} ${hh}:${mm} Europe/London)`,
      blockingGigs: [],
    };
  }

  return {
    exit: 0,
    stdout: 'blackout check passed (no upcoming gigs; outside weekend-evening fallback window)',
    blockingGigs: [],
  };
}

async function buildRealDeps(): Promise<Deps> {
  const ddb = new DynamoDBClient({ region: REGION });
  return {
    now: new Date(),
    describeTable: () => ddb.send(new DescribeTableCommand({ TableName: TABLE_NAME })),
    scanGigs: async (todayKey, tomorrowKey) => {
      const results: Gig[] = [];
      let exclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const resp = await ddb.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI1',
            FilterExpression: 'gsi1sk BETWEEN :todayKey AND :tomorrowKey',
            ExpressionAttributeValues: {
              ':todayKey': { S: todayKey },
              ':tomorrowKey': { S: `${tomorrowKey}zzzz` },
            },
            ExclusiveStartKey: exclusiveStartKey as never,
          }),
        );
        for (const item of resp.Items ?? []) {
          const meta = item.gigMeta?.M;
          if (!meta) continue;
          const venue = meta.venue?.S;
          const date = meta.date?.S;
          if (!venue || !date) continue;
          const time = meta.time?.S;
          const gig: Gig = time ? { gigMeta: { venue, date, time } } : { gigMeta: { venue, date } };
          results.push(gig);
        }
        exclusiveStartKey = resp.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (exclusiveStartKey);
      return results;
    },
  };
}

async function main(args: string[]): Promise<never> {
  const reportOnly = args.includes('--report-only');
  const deps = await buildRealDeps();
  const decision = await decideBlackout(deps);

  if (reportOnly) {
    if (decision.exit === 1 && decision.blockingGigs.length === 0) {
      // Fail-closed: DDB unreachable — propagate the error so force-deploy does not proceed blind
      process.stderr.write(`${decision.stderr}\n`);
      process.exit(1);
    }
    for (const gig of decision.blockingGigs) {
      process.stdout.write(`${JSON.stringify(gig.gigMeta)}\n`);
    }
    process.exit(0);
  }

  if (decision.exit === 0) {
    process.stdout.write(`${decision.stdout}\n`);
    process.exit(0);
  }
  process.stderr.write(`${decision.stderr}\n`);
  process.exit(1);
}

const argv1 = process.argv[1] ?? '';
const isDirectInvocation = import.meta.url === `file://${argv1}` || import.meta.url.endsWith(argv1);
if (isDirectInvocation) {
  void main(process.argv.slice(2));
}
