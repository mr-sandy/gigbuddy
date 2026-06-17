---
baseline_commit: 84cdc0f
builds_on: 2-2-iphone-pwa-install-gate
---

# Story 2.3: Song API + DDB persistence + client-errors endpoint

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want server-side Song CRUD with canonical LWW behavior, plus a fire-and-forget client-error endpoint,
so that the API can persist Songs with the contract Epic 4 will later depend on for sync, and unexpected client errors land in CloudWatch for diagnosis.

## Acceptance Criteria

**AC-1 — `shared/src/schemas/song.ts` defines the canonical `SongSchema` and is exported from `@gigbuddy/shared`**

**Given** `shared/src/schemas/song.ts`
**When** reviewed
**Then** the file exports a Zod object `SongSchema` matching architecture.md §Record shapes (lines 524–538) verbatim: `bandId: z.string()`, `songId: z.string()`, `title: z.string()`, optional `key`, `patch`, `chordChart`, `performanceNotes`, `practiceNotes` (all `z.string().optional()`), `clientWrittenAt: z.string().datetime()`, `serverReceivedAt: z.string().datetime()`, `version: z.literal(1)`
**And** the file exports a derived `SongPutInputSchema = SongSchema.omit({ serverReceivedAt: true })` — the request-body shape for `PUT /api/v1/songs/:songId` (the server stamps `serverReceivedAt` itself; the client never sends it)
**And** the file exports the inferred TypeScript types `Song = z.infer<typeof SongSchema>` and `SongPutInput = z.infer<typeof SongPutInputSchema>`
**And** `shared/src/index.ts` re-exports everything from `./schemas/song.js` so both `web/` and `api/` consume the schema via `import { SongSchema, SongPutInputSchema, type Song } from '@gigbuddy/shared'`
**And** **no parallel TypeScript `type` or `interface` for the Song record shape exists anywhere in the repo** (per CLAUDE.md conventions — Zod is the single source of truth)

**AC-2 — `shared/src/active-band.ts` defines the V1 single-Band identifier and name; `web/src/lib/band.ts` re-exports from shared**

**Given** `shared/src/active-band.ts` (NEW)
**When** reviewed
**Then** the file exports `ACTIVE_BAND_ID = 'k0c5Db7zM2qF3vNa' as const` — a 16-character NanoID-shaped URL-safe string identifying The Jack Ruby 5 in DDB. The value is stable for the life of V1 and forms the `BAND#<bandId>` partition key prefix on every Song and (future) Setlist item written by Sandy
**And** the file exports `ACTIVE_BAND_NAME = 'The Jack Ruby 5' as const` (relocated from `web/src/lib/band.ts`)
**And** the file's header comment explains: V1 single-Band scope (FR-25, FR-26); the constants are inputs to `pk = BAND#<bandId>` (DDB layer) and the MacBook passive label (chrome); V2 evolves these into a `useActiveBand()` hook backed by a `REGISTRY` item per architecture.md Decision 2 V2 evolution paths
**And** `shared/src/index.ts` re-exports `./active-band.js`
**And** `web/src/lib/band.ts` is updated to **re-export `ACTIVE_BAND_NAME` from `@gigbuddy/shared`** (no local literal). The existing `BandLabel` component (`web/src/components/band-label.tsx`) continues to import from `'../lib/band.js'` — the import surface is unchanged
**And** `ACTIVE_BAND_ID` is NOT exported from `web/src/lib/band.ts`; it is consumed directly from `@gigbuddy/shared` by Story 2.4+ code that needs it (web tests in this story do not need to touch `ACTIVE_BAND_ID`)
**And** the chosen literal value of `ACTIVE_BAND_ID` matches the NanoID URL-safe alphabet (`A-Za-z0-9_-`) and is exactly 16 characters long (per AR-47)

**AC-3 — `shared/src/schemas/client-error.ts` defines the `POST /api/v1/client-errors` request schema**

**Given** `shared/src/schemas/client-error.ts` (NEW)
**When** reviewed
**Then** the file exports a Zod object `ClientErrorReportSchema` matching architecture.md §Logging (line 766) verbatim: `where: z.string().min(1)`, `message: z.string().min(1)`, `stack: z.string().optional()`, `performanceActive: z.boolean()`, `timestamp: z.string().datetime()`
**And** the file exports the inferred TypeScript type `ClientErrorReport = z.infer<typeof ClientErrorReportSchema>`
**And** `shared/src/index.ts` re-exports `./schemas/client-error.js`
**And** no response schema is defined — the endpoint returns 204 No Content (no body)

**AC-4 — `api/src/ddb/client.ts` is the only `@aws-sdk/client-dynamodb` import surface in `api/`; exposes a memoized `DynamoDBDocumentClient`**

**Given** `api/src/ddb/client.ts` (NEW)
**When** reviewed
**Then** the file constructs a single `DynamoDBClient` (region resolved from the Lambda runtime — `AWS_REGION` env, automatic on Lambda; `eu-west-2` fallback for local dev) wrapped in `DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } })` (per AWS SDK v3 recommended configuration — undefined fields on optional Song properties must be elided, not stored as DDB nulls)
**And** the client is cached in module-scope memory (`let cached: DynamoDBDocumentClient | undefined`) and exposed via `getDocClient(): DynamoDBDocumentClient` — same pattern as `api/src/secrets/ssm.ts`
**And** the file exports a test-only `__resetDdbClientForTests(): void` that clears the cached client (mirrors `__resetSecretsCacheForTests` from `ssm.ts`); the function is NOT exported via any barrel and is only consumed by `*.test.ts` files
**And** the file exports `TABLE_NAME: string` — a getter that reads `process.env.TABLE_NAME` (Lambda env from `infra/lib/stacks/api-stack.ts:53`) at call time and throws a clear error (`'TABLE_NAME env var is not set'`) if absent. Implement as a function (`getTableName()`) rather than a top-level constant so the env-var miss surfaces on first DDB call, not at module-load
**And** **no other file in `api/`** imports from `@aws-sdk/client-dynamodb` or `@aws-sdk/lib-dynamodb` (per AR-42 / CLAUDE.md Boundaries). Every DDB access goes through `api/src/ddb/*` wrappers
**And** the `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` packages are added to `api/dependencies` (NOT `devDependencies`). The Node.js 22.x Lambda runtime includes the AWS SDK v3, but local dev (`tsx watch src/dev.ts`) resolves from `node_modules/`; declaring them as dependencies is required for local development to work without a separate install step

**AC-5 — `api/src/ddb/songs.ts` exposes `getSong`, `putSong`, `listSongsByBand` with the canonical item shape**

**Given** `api/src/ddb/songs.ts` (NEW)
**When** reviewed
**Then** the file exports three async functions matching architecture.md §Decision 2 item shapes (lines 209–211):
  - `getSong(bandId: string, songId: string): Promise<Song | undefined>` — issues a `GetCommand` with `Key: { pk: \`BAND#\${bandId}\`, sk: \`SONG#\${songId}\` }`; returns the unmarshalled item (sans `pk`/`sk`) parsed via `SongSchema.parse(...)`, or `undefined` if the item is absent
  - `putSong(record: Song): Promise<void>` — issues a `PutCommand` with `Item: { pk: \`BAND#\${record.bandId}\`, sk: \`SONG#\${record.songId}\`, ...record }` (the pk/sk are derived; the record fields are written alongside as item attributes for direct read access)
  - `listSongsByBand(bandId: string): Promise<Song[]>` — issues a `QueryCommand` with `KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)'`, `ExpressionAttributeValues: { ':pk': \`BAND#\${bandId}\`, ':skPrefix': 'SONG#' }`; pages via `LastEvaluatedKey` until exhausted (the AC-3 list endpoint sorts in the route, not here); returns an array of `Song` items parsed via `SongSchema.parse(...)`
**And** all three functions use the `DynamoDBDocumentClient` from `api/src/ddb/client.ts` (NOT the lower-level `DynamoDBClient`) — the DocClient handles marshall/unmarshall of native JavaScript values to/from DDB AttributeValue shapes
**And** the file does NOT export the raw DDB Items shape with `pk`/`sk` — callers only ever see `Song`-typed records (the schema is the contract)
**And** the file does NOT swallow DDB errors; any unhandled DDB error propagates to the route handler (which surfaces as a 500 via Hono's default error response). The route handler is responsible for the user-facing error envelope, not the DDB wrapper

**AC-6 — `api/src/lww.ts` is the canonical LWW comparator; covered by exhaustive unit tests**

**Given** `api/src/lww.ts` (NEW)
**When** reviewed
**Then** the file exports a single pure function `compareLww<T extends { clientWrittenAt: string }>(incoming: T, existing: T | undefined): 'apply' | 'drop'`
**And** the function implements architecture.md §LWW server logic (lines 571–588) verbatim:
  - If `existing === undefined` → return `'apply'` (new record)
  - If `incoming.clientWrittenAt >= existing.clientWrittenAt` (ISO-8601 string comparison; the format is lexically sortable) → return `'apply'`
  - Otherwise → return `'drop'`
**And** the function does NOT inspect any field other than `clientWrittenAt` — the LWW algorithm is per-record (FR-32), not per-field, not record-type-aware. The generic parameter `T` is parameterized by the timestamp field only so it works for both `Song` and (Story 3.1) `Setlist`
**And** an `api/src/lww.test.ts` (NEW) covers exhaustively:
  - **same-timestamp wins (applied):** incoming and existing have the same `clientWrittenAt` → `compareLww` returns `'apply'` (the architecture says `incoming ≥ existing`, not strict `>`; same-timestamp incoming wins)
  - **strictly-older drops as stale:** incoming `clientWrittenAt` is one millisecond earlier than existing → `compareLww` returns `'drop'`
  - **strictly-newer applies:** incoming `clientWrittenAt` is one millisecond later than existing → `compareLww` returns `'apply'`
  - **missing existing record applies:** existing is `undefined` → `compareLww` returns `'apply'`
  - **large clock skew, incoming far in the future:** incoming is 10 years ahead of existing → `compareLww` returns `'apply'` (no validation on clock skew — that's the `x-server-now` client-side diagnostic, not the server's LWW concern)
  - **large clock skew, incoming far in the past:** incoming is 10 years behind existing → `compareLww` returns `'drop'`
  - **string-comparison correctness for ISO-8601:** explicit cases `'2026-01-01T00:00:00.000Z'` < `'2026-01-01T00:00:00.001Z'` < `'2026-01-01T00:00:01.000Z'` < `'2026-01-02T00:00:00.000Z'` (proves the lexical comparison works across the date, hour, minute, second, and millisecond boundaries — the architecture relies on this without belaboring it)
**And** the test file uses Vitest's plain `describe` / `it` / `expect`; no mocks (the function is pure)

**AC-7 — `api/src/middleware/server-now.ts` adds the `x-server-now: <ISO-8601>` response header on every response**

**Given** `api/src/middleware/server-now.ts` (NEW)
**When** reviewed
**Then** the file exports a Hono middleware `serverNowMiddleware` constructed via `createMiddleware` (matching the pattern in `api/src/middleware/{auth,logger}.ts`) that calls `next()` first, then sets the response header `x-server-now` to `new Date().toISOString()` BEFORE returning
**And** the middleware is wired in `api/src/app.ts` AFTER `loggerMiddleware` and AFTER `authMiddleware` — so the `serverNow` value reflects approximately when the response was emitted, not when the request arrived (the architecture's purpose for this header is client clock-skew detection per AR-24; placing it last gives the freshest stamp)
**And** the middleware uses `c.header('x-server-now', ...)` from Hono (which sets the header on the in-flight response); it does NOT mutate `c.res` directly
**And** the middleware adds the header for EVERY response, including 401s from `authMiddleware`, 4xx errors from route handlers, and successful 200 responses — the header is a clock-skew diagnostic and must be available regardless of response status
**And** an `api/src/middleware/server-now.test.ts` (NEW) covers:
  - The header is present on a 200 response (e.g., `GET /api/v1/health`)
  - The header is present on a 401 response (e.g., `GET /api/v1/me` with no cookie)
  - The header value parses as a valid ISO-8601 datetime (`new Date(headerValue).toISOString() === headerValue`)
  - The header value is within 5 seconds of the test's `Date.now()` (rough freshness check; not flaky — handlers don't sleep)

**AC-8 — `GET /api/v1/songs` returns an alphabetized-by-title list of all Songs for the active Band**

**Given** an authenticated request to `GET /api/v1/songs`
**When** the handler in `api/src/routes/songs.ts` runs
**Then** it calls `listSongsByBand(ACTIVE_BAND_ID)` (the constant from `@gigbuddy/shared`)
**And** sorts the result in ascending order by `title` using `String.prototype.localeCompare` (case-insensitive by default for the locale; pick the `'en'` locale explicitly with `sensitivity: 'base'` to make the sort deterministic — `[a].localeCompare(b, 'en', { sensitivity: 'base' })`)
**And** returns `{ status: 'ok' as const, data: [Song, ...] }` matching `OkResponseSchema(z.array(SongSchema))` from `shared/src/schemas/api.ts`
**And** the response is HTTP 200
**And** the response carries the `x-server-now: <ISO-8601>` header (from the middleware in AC-7)
**And** when the band has zero Songs, the response is `{ status: 'ok', data: [] }` — an empty array, not 404 (the absence of Songs is a valid state, not an error)

**AC-9 — `GET /api/v1/songs/:songId` returns the Song or 404 with the standard error envelope**

**Given** an authenticated request to `GET /api/v1/songs/:songId`
**When** the handler runs
**Then** it calls `getSong(ACTIVE_BAND_ID, c.req.param('songId'))`
**And** when the song exists, the response is HTTP 200 with body `{ status: 'ok' as const, data: <SongSchema> }`
**And** when the song does NOT exist, the response is HTTP 404 with body `{ status: 'error', error: { code: 'NOT_FOUND', message: 'song not found' } }`
**And** both responses carry `x-server-now`
**And** the `:songId` path parameter is NOT validated server-side beyond "string present" (NanoID format validation is a client concern; an invalid-format songId simply returns 404 because no item matches)

**AC-10 — `PUT /api/v1/songs/:songId` applies LWW; returns `applied` or `dropped-as-stale`**

**Given** an authenticated request to `PUT /api/v1/songs/:songId` with body matching `SongPutInputSchema` (everything except `serverReceivedAt`)
**When** the handler runs
**Then** the body is parsed via `SongPutInputSchema.safeParse(body)`; on parse failure the response is HTTP 400 with `{ status: 'error', error: { code: 'VALIDATION_FAILED', message: <zod-error-summary> } }`
**And** the URL path parameter `:songId` is asserted equal to `body.songId` — on mismatch the response is HTTP 400 with `{ status: 'error', error: { code: 'VALIDATION_FAILED', message: 'songId in path does not match body' } }` (a defensive check; a well-behaved client always agrees, but the server holds the contract)
**And** the body's `bandId` is asserted equal to `ACTIVE_BAND_ID` — on mismatch the response is HTTP 400 with `{ status: 'error', error: { code: 'VALIDATION_FAILED', message: 'bandId does not match the active band' } }` (defense against a stale or malformed client; FR-25 says no cross-Band content)
**And** the handler calls `getSong(ACTIVE_BAND_ID, songId)` to fetch the existing record (or `undefined`), then `compareLww(incoming, existing)`
**And** when `compareLww` returns `'apply'`: the server stamps `serverReceivedAt = new Date().toISOString()` (in UTC, with the same millisecond-precision the schema requires); calls `putSong({ ...incoming, serverReceivedAt })`; returns HTTP 200 with `{ status: 'applied' as const, data: <full Song with serverReceivedAt> }` (matching `AppliedResponseSchema(SongSchema)`)
**And** when `compareLww` returns `'drop'`: the server does NOT call `putSong`; returns HTTP 200 with `{ status: 'dropped-as-stale' as const, currentState: <full existing Song> }` (matching `DroppedAsStaleResponseSchema(SongSchema)`). HTTP 200 is correct — the write was processed cleanly, just not persisted; the client invalidates and refreshes per architecture.md §Outbox flush rules
**And** the response carries `x-server-now`
**And** the route handler does NOT perform any field-level merging — `putSong` writes the whole record (per AR-23 whole-record PUT semantics)

**AC-11 — `POST /api/v1/client-errors` writes a structured CloudWatch log line and returns 204**

**Given** an authenticated request to `POST /api/v1/client-errors` with body matching `ClientErrorReportSchema`
**When** the handler runs
**Then** the body is parsed via `ClientErrorReportSchema.safeParse(body)`; on parse failure the response is HTTP 400 with the standard error envelope and the request is NOT logged at level `error` (a malformed client-error report is itself a bug; log it at level `warn` with `{ msg: 'client-errors malformed payload' }` and include the parsing failure summary)
**And** when the body parses, the handler emits **one** structured JSON log line via `console.log(JSON.stringify({ level: 'error', msg: 'client-error', ...payload }))` — Lambda's stdout is routed to CloudWatch Logs (the `loggerMiddleware` pattern in `api/src/middleware/logger.ts` writes the same shape for request logs)
**And** the response is HTTP 204 No Content (no body); the handler does NOT echo any field from the payload back in the response — the client expects a fire-and-forget write per architecture.md §Logging
**And** the response carries `x-server-now` (the middleware fires before the response is sealed)
**And** the handler does NOT call DDB — client errors are NOT persisted as DDB items; CloudWatch Logs is the durable record per §A.4 / NFR-15
**And** the route is mounted at `/api/v1/client-errors` (singular path segment naming, plural noun per architecture.md §Naming conventions)

**AC-12 — All new routes are gated by `authMiddleware`; the `authMiddleware` SKIP_PATHS list is unchanged**

**Given** the existing `authMiddleware` (`api/src/middleware/auth.ts`)
**When** any of `/api/v1/songs`, `/api/v1/songs/:songId`, or `/api/v1/client-errors` is hit without a valid `gigbuddy_session` cookie
**Then** the response is HTTP 401 with `{ status: 'error', error: { code: 'UNAUTHORIZED', message: 'authentication required' } }` and the route handler does NOT execute
**And** the `SKIP_PATHS` constant in `auth.ts` is unchanged — it still contains exactly `['/api/v1/auth/login', '/api/v1/health']`. New routes do NOT join the skip list (no public-readable songs; no public-postable client errors)
**And** `api/src/handler.test.ts` is extended to assert 401 on `GET /api/v1/songs` and `POST /api/v1/client-errors` (both without a cookie) — proving the route is reachable through the Hono adapter AND that auth fires before the handler

**AC-13 — Routes are wired into `api/src/app.ts` in the correct order; `loggerMiddleware`, `authMiddleware`, and `serverNowMiddleware` all apply globally**

**Given** `api/src/app.ts`
**When** reviewed
**Then** the Hono app composition is, in order:
  ```typescript
  export const app = new Hono()
    .use('*', loggerMiddleware)
    .use('*', serverNowMiddleware)
    .use('/api/v1/*', authMiddleware)
    .route('/api/v1/health', healthRoute)
    .route('/api/v1/auth', authRoute)
    .route('/api/v1/me', meRoute)
    .route('/api/v1/songs', songsRoute)
    .route('/api/v1/client-errors', clientErrorsRoute);
  ```
**And** `serverNowMiddleware` is registered with the broad `'*'` matcher (before `authMiddleware`) so that 401 responses from the auth middleware ALSO carry `x-server-now` (per AC-7 — the header is on every response, including unauth)
**And** the order of `.route()` calls is alphabetical within the post-auth block (`songs` before `client-errors` would also work; pick alphabetical for predictability — but `client-errors` < `songs` lexically, so the snippet above is correct)
**And** the existing routes (`health`, `auth`, `me`) are unchanged — no new middleware or imports are added to those route files
**And** no router-mounting reorganization changes the URL paths of existing routes

**AC-14 — Test coverage: unit tests for ddb wrappers, route handlers, LWW, middleware; handler-level tests for unauth**

**Given** the new and modified files
**When** the test suites run
**Then** the following new test files exist with at minimum the listed cases:
  - `shared/src/schemas/song.test.ts` (NEW) — accepts a valid Song; rejects missing required fields; accepts a record with only Title (and all optional fields absent); `SongPutInputSchema` rejects a body that includes `serverReceivedAt`
  - `shared/src/schemas/client-error.test.ts` (NEW) — accepts a valid payload; rejects missing `where`, `message`, `performanceActive`, or `timestamp`; accepts `stack` absent; rejects `timestamp` that is not ISO-8601
  - `api/src/lww.test.ts` (NEW) — the seven cases listed in AC-6
  - `api/src/middleware/server-now.test.ts` (NEW) — the four cases listed in AC-7
  - `api/src/ddb/songs.test.ts` (NEW) — uses `aws-sdk-client-mock` (devDep) to mock the underlying `DynamoDBClient` send calls; covers:
    - `getSong` returns `undefined` when DDB returns no `Item`
    - `getSong` returns a parsed `Song` when DDB returns a complete item
    - `getSong` throws (via `SongSchema.parse`) when DDB returns a malformed item (defends against a future schema drift)
    - `putSong` issues a `PutCommand` with the correct `Key` derivation (`pk = BAND#<bandId>`, `sk = SONG#<songId>`) — assert on the captured command input
    - `listSongsByBand` issues a `QueryCommand` with the correct `KeyConditionExpression` and `ExpressionAttributeValues`
    - `listSongsByBand` pages: when DDB returns `LastEvaluatedKey` on the first call, the wrapper issues a second `QueryCommand` with `ExclusiveStartKey` set, and concatenates results
  - `api/src/routes/songs.test.ts` (NEW) — mocks `api/src/ddb/songs.js` (Vitest's `vi.mock`) and `api/src/secrets/ssm.js` (existing pattern); covers, via Hono's `app.request()`:
    - `GET /api/v1/songs` returns 200 with alphabetized data
    - `GET /api/v1/songs/:songId` returns 200 with the song when present
    - `GET /api/v1/songs/:songId` returns 404 with the error envelope when absent
    - `PUT /api/v1/songs/:songId` returns 200 `applied` when LWW-new
    - `PUT /api/v1/songs/:songId` returns 200 `dropped-as-stale` when LWW-stale
    - `PUT /api/v1/songs/:songId` returns 400 on a malformed body (missing required field)
    - `PUT /api/v1/songs/:songId` returns 400 when the path `:songId` does not match `body.songId`
    - `PUT /api/v1/songs/:songId` returns 400 when `body.bandId !== ACTIVE_BAND_ID`
    - Every response carries `x-server-now` and the value parses as ISO-8601
  - `api/src/routes/client-errors.test.ts` (NEW) — covers, via `app.request()`:
    - `POST /api/v1/client-errors` returns 204 No Content on a valid payload
    - The handler emits a `console.log` line containing the payload at `level: 'error'` and `msg: 'client-error'` (use `vi.spyOn(console, 'log')` to capture)
    - The response has an empty body (no echo of the payload)
    - The response carries `x-server-now`
    - A malformed payload (missing required field) returns 400 and emits a `level: 'warn'` log line (NOT `level: 'error'`)
    - The handler does NOT call DDB (no mock for `ddb/songs.js` needed; an absence-of-import assertion would be over-engineering — the test simply doesn't wire DDB mocks and relies on the route not touching them)
**And** the existing `api/src/handler.test.ts` is extended with two cases:
  - `GET /api/v1/songs` without a cookie returns 401 with the UNAUTHORIZED envelope
  - `POST /api/v1/client-errors` without a cookie returns 401 with the UNAUTHORIZED envelope (use a POST event shape — extend `buildEvent` to accept `method` + `body` arguments, defaulting to GET / null)
**And** all existing tests continue to pass unchanged (existing handler-test cases, auth-middleware tests, login route tests, me route, health route)

**AC-15 — `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build:api` all green; no new top-level dependency surprises**

**Given** the implementation complete
**When** the verification commands run from the repo root
**Then** `pnpm typecheck` is green across all five packages (shared, api, web, infra, e2e) — the new Zod schemas, the DDB wrappers, the route handlers, and the test mocks all typecheck under `strict: true`
**And** `pnpm lint` is green via Biome — kebab-case filenames; camelCase identifiers; no `@aws-sdk/*` imports outside `api/src/ddb/*` or `api/src/secrets/*`
**And** `pnpm test` is green across all packages (no test regressions; new tests pass)
**And** `pnpm build:api` is green — esbuild bundles `api/src/handler.ts` with `@aws-sdk/*` externals; the bundle size stays under the 1MB architecture target (the new DDB DocClient is only metadata in the bundle since `@aws-sdk/*` is external — runtime resolution happens in Lambda)
**And** `pnpm build:web` is unchanged (Story 2.3 is server-side; web only sees the new shared exports, which are tree-shakable types)
**And** `api/package.json` has gained exactly three deps:
  - `dependencies`: `@aws-sdk/client-dynamodb` (latest 3.x), `@aws-sdk/lib-dynamodb` (latest 3.x)
  - `devDependencies`: `aws-sdk-client-mock` (^4.x)
**And** `shared/package.json` is unchanged (no new deps; Zod is already pinned at ^3.23)
**And** `web/package.json` is unchanged (no new deps)
**And** the `pnpm-lock.yaml` reflects only the three added deps (no incidental version bumps)

## Tasks / Subtasks

- [x] **Task 1 — Add `SongSchema`, `SongPutInputSchema`, and `ClientErrorReportSchema` to `@gigbuddy/shared`** (AC: 1, 3)
  - [x] Create `shared/src/schemas/song.ts`:
    ```typescript
    import { z } from 'zod';

    export const SongSchema = z.object({
      bandId: z.string(),
      songId: z.string(),
      title: z.string(),
      key: z.string().optional(),
      patch: z.string().optional(),
      chordChart: z.string().optional(),
      performanceNotes: z.string().optional(),
      practiceNotes: z.string().optional(),
      clientWrittenAt: z.string().datetime(),
      serverReceivedAt: z.string().datetime(),
      version: z.literal(1),
    });
    export type Song = z.infer<typeof SongSchema>;

    export const SongPutInputSchema = SongSchema.omit({ serverReceivedAt: true });
    export type SongPutInput = z.infer<typeof SongPutInputSchema>;
    ```
  - [x] Create `shared/src/schemas/client-error.ts`:
    ```typescript
    import { z } from 'zod';

    export const ClientErrorReportSchema = z.object({
      where: z.string().min(1),
      message: z.string().min(1),
      stack: z.string().optional(),
      performanceActive: z.boolean(),
      timestamp: z.string().datetime(),
    });
    export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
    ```
  - [x] Create the matching test files (`shared/src/schemas/song.test.ts`, `shared/src/schemas/client-error.test.ts`) per AC-14; follow the existing `band.test.ts` style — minimal `safeParse` accept/reject cases
  - [x] Update `shared/src/index.ts` to re-export both files: `export * from './schemas/song.js'; export * from './schemas/client-error.js';`
  - [x] **Do NOT** define a parallel TypeScript `interface Song { ... }` anywhere — the inferred type from `z.infer<typeof SongSchema>` is the only `Song` type in the project (per CLAUDE.md "Zod schemas in `shared/` are the single source of truth")
  - [x] **Do NOT** add a Title-length minimum (e.g., `z.string().min(1)`) — the architecture's schema does not impose one. Empty-string titles are a client-UX concern (Story 2.6 enforces non-empty Title at the form layer, not the schema)

- [x] **Task 2 — Add `ACTIVE_BAND_ID` and `ACTIVE_BAND_NAME` to `@gigbuddy/shared`; migrate `web/src/lib/band.ts` to re-export** (AC: 2)
  - [x] Create `shared/src/active-band.ts`:
    ```typescript
    /*
     * V1 single-Band identifier (FR-25, FR-26; AR-47 NanoID 16-char URL-safe).
     *
     * - ACTIVE_BAND_ID is the partition-key suffix for every Song and Setlist
     *   item written by Sandy in V1. Stable for V1's lifetime.
     * - ACTIVE_BAND_NAME drives the MacBook passive band label only
     *   (web/src/components/band-label.tsx). iPhone chrome shows no band label.
     *
     * V2 / Multi-Band: replace with a useActiveBand() hook backed by the
     * REGISTRY item in DDB (architecture.md Decision 2 V2 evolution paths).
     * Do NOT add band-metadata fetching here in V1.
     */
    export const ACTIVE_BAND_ID = 'k0c5Db7zM2qF3vNa' as const;
    export const ACTIVE_BAND_NAME = 'The Jack Ruby 5' as const;
    ```
  - [x] Update `shared/src/index.ts` to add `export * from './active-band.js';`
  - [x] Update `web/src/lib/band.ts` — replace the literal with a re-export:
    ```typescript
    /*
     * V1 single-Band passive label (FR-25, FR-26). Re-exported from
     * @gigbuddy/shared so client and server agree on the same band identity
     * (the server resolves ACTIVE_BAND_ID for DDB scoping; the client renders
     * ACTIVE_BAND_NAME in the MacBook chrome).
     */
    export { ACTIVE_BAND_NAME } from '@gigbuddy/shared';
    ```
  - [x] **Do NOT** export `ACTIVE_BAND_ID` from `web/src/lib/band.ts` — keep that import surface scoped to `@gigbuddy/shared` so future sync-layer code in Story 2.4 imports the constant from the single source of truth, not via a web-side alias
  - [x] Verify the `BandLabel` component (`web/src/components/band-label.tsx`) still renders correctly — the import statement `import { ACTIVE_BAND_NAME } from '../lib/band.js';` is unchanged

- [x] **Task 3 — Add AWS SDK DDB dependencies; add `aws-sdk-client-mock` for tests** (AC: 4, 15)
  - [x] `pnpm --filter api add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb` — adds them as `dependencies` (NOT devDeps). Pin the patch version that resolves at the time of this story; latest 3.x is acceptable
  - [x] `pnpm --filter api add -D aws-sdk-client-mock` — adds as a devDep. Use the latest 4.x line; it supports AWS SDK v3 modular clients including the DocumentClient
  - [x] Verify `api/package.json` now lists three SDK packages: `@aws-sdk/client-ssm` (existing), `@aws-sdk/client-dynamodb` (new), `@aws-sdk/lib-dynamodb` (new), plus `aws-sdk-client-mock` under devDependencies
  - [x] Verify `pnpm-lock.yaml` updates are limited to the three new packages and their transitive deps; no incidental bumps to existing pinned versions

- [x] **Task 4 — Create `api/src/ddb/client.ts`** (AC: 4)
  - [x] Create the file:
    ```typescript
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

    export function getTableName(): string {
      const name = process.env.TABLE_NAME;
      if (!name) throw new Error('TABLE_NAME env var is not set');
      return name;
    }

    /** Test-only: clear the module-scope cache between cases. Not exported via any barrel. */
    export function __resetDdbClientForTests(): void {
      cached = undefined;
    }
    ```
  - [x] **Why `removeUndefinedValues: true`:** the optional Song fields (`key`, `patch`, `chordChart`, etc.) come through as `undefined` when not provided. Without this flag, DocClient writes them as DDB `NULL` values, which `SongSchema.parse` would reject on read. Setting `removeUndefinedValues: true` causes DocClient to elide them — re-reading the item produces an object without the missing keys, which `SongSchema` (with `.optional()`) accepts correctly
  - [x] **Why a function (`getTableName()`) and not a top-level constant:** a top-level `const TABLE_NAME = process.env.TABLE_NAME!` would read at module-load (cold-start), and a missing env var would throw before any handler runs — silent failure. The function reads at call time so the failure surfaces in the handler's error path, where the logger middleware will capture it as a structured log line
  - [x] **Do NOT** create a separate dev / prod resolver. Local dev (`pnpm dev:api` via `tsx watch src/dev.ts`) requires Sandy to set `TABLE_NAME=gigbuddy-data AWS_REGION=eu-west-2 AWS_PROFILE=<his-profile> pnpm dev:api` from the command line. The dev server hits real DDB in Sandy's eu-west-2 account; there is no dynamodb-local in V1 (deferred per architecture.md Gap #4)

- [x] **Task 5 — Create `api/src/ddb/songs.ts`** (AC: 5)
  - [x] Create the file:
    ```typescript
    import { type Song, SongSchema } from '@gigbuddy/shared';
    import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
    import { getDocClient, getTableName } from './client.js';

    function songKey(bandId: string, songId: string) {
      return { pk: `BAND#${bandId}`, sk: `SONG#${songId}` };
    }

    export async function getSong(bandId: string, songId: string): Promise<Song | undefined> {
      const result = await getDocClient().send(
        new GetCommand({ TableName: getTableName(), Key: songKey(bandId, songId) }),
      );
      if (!result.Item) return undefined;
      // Strip pk/sk before parsing — Song's schema doesn't carry them
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
    ```
  - [x] **Why parse with `SongSchema.parse(rest)` on read:** DDB is schemaless. If a future migration or a bug ever wrote a malformed record, parsing on read surfaces the corruption immediately rather than letting `undefined`-tainted Songs flow into the response and break the client. The cost is one Zod parse per item per request — negligible for Sandy's single-user volume
  - [x] **Why `_pk` / `_sk` destructure prefix:** Biome's lint catches unused destructured locals; the underscore prefix marks them as intentionally discarded (Biome respects this pattern as the conventional "unused" marker). Alternative: omit the destructure and use a Lodash-style pick — but adding lodash for one helper is overkill
  - [x] **Why paging is necessary even at single-user scale:** DDB Query returns up to 1MB per page. Sandy's library will likely fit in one page for years, but the pagination loop is a one-time correctness investment that protects future-Sandy from a silent truncation bug if the library ever grows past one page. The architecture's `listSongsByBand` returns ALL Songs for the band (FR-4); no pagination semantics are exposed to the caller
  - [x] **Do NOT** sort in `listSongsByBand` — sort in the route handler (AC-8). The wrapper returns raw items; the route applies the alphabetical sort. This separation keeps the wrapper minimal (V2 analytics will want unsorted access)

- [x] **Task 6 — Create `api/src/lww.ts` and its test** (AC: 6)
  - [x] Create `api/src/lww.ts`:
    ```typescript
    /*
     * Canonical LWW comparator (architecture.md §LWW server logic, AR-23).
     *
     * Per-record, not per-field (FR-32). ISO-8601 strings are lexically
     * sortable, so plain `>=` is correct without any Date parsing.
     *
     * Same-timestamp incoming wins (incoming >= existing, per architecture)
     * — this matches what a single client would expect when the same write
     * arrives twice (e.g., outbox retry after a 5xx).
     */
    export function compareLww<T extends { clientWrittenAt: string }>(
      incoming: T,
      existing: T | undefined,
    ): 'apply' | 'drop' {
      if (!existing) return 'apply';
      return incoming.clientWrittenAt >= existing.clientWrittenAt ? 'apply' : 'drop';
    }
    ```
  - [x] Create `api/src/lww.test.ts` with the seven cases from AC-6. Keep cases compact — one `it` per case, no shared fixtures (the function is two lines)
  - [x] **Do NOT** add a second function for Setlist LWW. Story 3.1 will reuse `compareLww` against `Setlist` records — the generic type parameter is exactly why this function exists once at the package root

- [x] **Task 7 — Create `api/src/middleware/server-now.ts` and its test** (AC: 7)
  - [x] Create `api/src/middleware/server-now.ts`:
    ```typescript
    import { createMiddleware } from 'hono/factory';

    /*
     * Sets x-server-now: <ISO-8601> on every response (architecture.md AR-24).
     *
     * Client reads this header in api/client.ts (Story 2.4) and warns on
     * |serverNow - Date.now()| > 30s — diagnostic for clock-skew scenarios
     * that would otherwise corrupt LWW ordering.
     *
     * Set the header AFTER next() so the value reflects when the response
     * left the server, not when the request arrived. The freshness only
     * matters at the 30s threshold; either side of next() would pass that
     * bar — but after-next is conceptually the "server now at response
     * emission" stamp the client compares against its own clock.
     */
    export const serverNowMiddleware = createMiddleware(async (c, next) => {
      await next();
      c.header('x-server-now', new Date().toISOString());
    });
    ```
  - [x] Create `api/src/middleware/server-now.test.ts` covering the four cases from AC-7. Use a small `buildApp` helper similar to `auth.test.ts` that mounts the middleware on a route returning a known response
  - [x] **Do NOT** memoize or batch the timestamp generation. `new Date().toISOString()` is cheap (~microseconds); calling it once per response is the right semantic and the right cost

- [x] **Task 8 — Create `api/src/routes/songs.ts` and its test** (AC: 8, 9, 10)
  - [x] Create `api/src/routes/songs.ts`:
    ```typescript
    import { ACTIVE_BAND_ID, SongPutInputSchema, SongSchema, type Song } from '@gigbuddy/shared';
    import { Hono } from 'hono';
    import { getSong, listSongsByBand, putSong } from '../ddb/songs.js';
    import { compareLww } from '../lww.js';

    function alphabetizeByTitle(songs: Song[]): Song[] {
      return [...songs].sort((a, b) =>
        a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
      );
    }

    export const songsRoute = new Hono()
      .get('/', async (c) => {
        const songs = await listSongsByBand(ACTIVE_BAND_ID);
        return c.json({ status: 'ok' as const, data: alphabetizeByTitle(songs) });
      })
      .get('/:songId', async (c) => {
        const songId = c.req.param('songId');
        const song = await getSong(ACTIVE_BAND_ID, songId);
        if (!song) {
          return c.json(
            { status: 'error' as const, error: { code: 'NOT_FOUND', message: 'song not found' } },
            404,
          );
        }
        return c.json({ status: 'ok' as const, data: song });
      })
      .put('/:songId', async (c) => {
        const songId = c.req.param('songId');
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json(
            {
              status: 'error' as const,
              error: { code: 'VALIDATION_FAILED', message: 'body is not JSON' },
            },
            400,
          );
        }
        const parsed = SongPutInputSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            {
              status: 'error' as const,
              error: {
                code: 'VALIDATION_FAILED',
                message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
              },
            },
            400,
          );
        }
        if (parsed.data.songId !== songId) {
          return c.json(
            {
              status: 'error' as const,
              error: { code: 'VALIDATION_FAILED', message: 'songId in path does not match body' },
            },
            400,
          );
        }
        if (parsed.data.bandId !== ACTIVE_BAND_ID) {
          return c.json(
            {
              status: 'error' as const,
              error: {
                code: 'VALIDATION_FAILED',
                message: 'bandId does not match the active band',
              },
            },
            400,
          );
        }
        const existing = await getSong(ACTIVE_BAND_ID, songId);
        const verdict = compareLww(parsed.data, existing);
        if (verdict === 'drop') {
          // existing is guaranteed defined when verdict is 'drop' (the only
          // way compareLww returns 'drop' is when an existing record was
          // strictly newer). TypeScript doesn't know that — narrow with a
          // local assertion.
          if (!existing) throw new Error('invariant: drop verdict requires existing record');
          return c.json({ status: 'dropped-as-stale' as const, currentState: existing });
        }
        const record: Song = { ...parsed.data, serverReceivedAt: new Date().toISOString() };
        await putSong(record);
        return c.json({ status: 'applied' as const, data: record });
      });
    ```
  - [x] Create `api/src/routes/songs.test.ts` covering AC-14's eight cases (alphabetized list, song-by-id 200/404, PUT applied/dropped/400 trio, x-server-now header). Mock `../ddb/songs.js` with `vi.mock` returning controlled records; mock `../secrets/ssm.js` for the auth middleware
  - [x] **Why explicit `as const` literals on every status:** TypeScript widens `string` literals to `string` in object positions unless you tell it otherwise. The shared `OkResponseSchema` and friends use `z.literal('ok')` / `z.literal('applied')`, so the route's response objects must be typed with the literal — `as const` is the lightest annotation that gets the right type
  - [x] **Why `JSON.parse` is wrapped in try/catch:** Hono's `c.req.json()` throws on malformed JSON. The default error handler would return a 500 — the route should return 400 with a clean envelope instead. Same pattern as `api/src/routes/auth.ts:25-29`
  - [x] **Why `bandId !== ACTIVE_BAND_ID` rejects but does NOT consult any other band's data:** the V1 server is single-Band by design. Validating that the client doesn't try to write to a different band is a defense-in-depth check; the failure mode is a client bug, not a malicious request (the auth gate prevents arbitrary callers, AC-12)

- [x] **Task 9 — Create `api/src/routes/client-errors.ts` and its test** (AC: 11)
  - [x] Create `api/src/routes/client-errors.ts`:
    ```typescript
    import { ClientErrorReportSchema } from '@gigbuddy/shared';
    import { Hono } from 'hono';

    export const clientErrorsRoute = new Hono().post('/', async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        console.log(
          JSON.stringify({
            level: 'warn',
            msg: 'client-errors malformed payload',
            reason: 'not JSON',
          }),
        );
        return c.json(
          { status: 'error' as const, error: { code: 'VALIDATION_FAILED', message: 'body is not JSON' } },
          400,
        );
      }
      const parsed = ClientErrorReportSchema.safeParse(body);
      if (!parsed.success) {
        console.log(
          JSON.stringify({
            level: 'warn',
            msg: 'client-errors malformed payload',
            reason: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          }),
        );
        return c.json(
          {
            status: 'error' as const,
            error: { code: 'VALIDATION_FAILED', message: 'malformed client-error report' },
          },
          400,
        );
      }
      console.log(JSON.stringify({ level: 'error', msg: 'client-error', ...parsed.data }));
      return c.body(null, 204);
    });
    ```
  - [x] Create `api/src/routes/client-errors.test.ts` covering the six cases from AC-14 (204 happy path, log emission at level error, empty body, x-server-now, 400 malformed payload emits warn-level log, no DDB call)
  - [x] **Why `c.body(null, 204)` not `c.json(...)`:** 204 No Content means "no body"; the standard is to send an empty entity. `c.json(...)` would send `{}` which technically violates 204 semantics in some HTTP parsers
  - [x] **Why log at `level: 'error'` for valid payloads:** the architecture's §Logging contract maps client-error reports to CloudWatch as `error`-level events so CloudWatch Insights queries can `filter level = "error"` to surface gig-night anomalies. Malformed payloads from buggy clients are logged at `warn` so they don't pollute the same alert query — they are a client-side bug class, not a runtime-error class

- [x] **Task 10 — Wire new routes and middleware in `api/src/app.ts`** (AC: 13)
  - [x] Update `api/src/app.ts`:
    ```typescript
    import { Hono } from 'hono';
    import { authMiddleware } from './middleware/auth.js';
    import { loggerMiddleware } from './middleware/logger.js';
    import { serverNowMiddleware } from './middleware/server-now.js';
    import { authRoute } from './routes/auth.js';
    import { clientErrorsRoute } from './routes/client-errors.js';
    import { healthRoute } from './routes/health.js';
    import { meRoute } from './routes/me.js';
    import { songsRoute } from './routes/songs.js';

    export const app = new Hono()
      .use('*', loggerMiddleware)
      .use('*', serverNowMiddleware)
      .use('/api/v1/*', authMiddleware)
      .route('/api/v1/health', healthRoute)
      .route('/api/v1/auth', authRoute)
      .route('/api/v1/me', meRoute)
      .route('/api/v1/songs', songsRoute)
      .route('/api/v1/client-errors', clientErrorsRoute);
    ```
  - [x] **Why `serverNowMiddleware` is registered with `'*'` (not `'/api/v1/*'`):** the architecture's `x-server-now` invariant is "every response" — and while only `/api/v1/*` routes are mounted today, registering at the broad matcher is the simplest contract (no future bug where a new route forgets the header). The cost is one `Date.now()` per non-`/api/v1/*` request, which is zero in practice (no such routes exist)
  - [x] **Why `serverNowMiddleware` is registered BEFORE `authMiddleware`:** Hono middleware runs outside-in on the way down the stack and inside-out on the way back up. `serverNowMiddleware`'s body runs AFTER `next()` — so registering it earlier (outer) means it runs LATER (after auth has already returned its 401 if applicable), which is exactly what AC-7 requires (header present even on 401 responses)

- [x] **Task 11 — Extend `api/src/handler.test.ts` for unauth coverage of new routes** (AC: 12)
  - [x] Extend `buildEvent` to support a `method` parameter (default `'GET'`) and an optional `body` parameter (passed verbatim if present; `null` otherwise):
    ```typescript
    function buildEvent(opts: { path: string; method?: string; body?: string; headers?: Record<string, string> }): unknown {
      return {
        ...,
        requestContext: { ..., http: { method: opts.method ?? 'GET', ... }, ... },
        body: opts.body ?? null,
        ...
      };
    }
    ```
  - [x] Add the two cases from AC-14: `GET /api/v1/songs` and `POST /api/v1/client-errors` both without a cookie return 401 with the UNAUTHORIZED envelope. Match the existing `it()` style
  - [x] **Do NOT** add tests that exercise the full DDB / log path through the handler — those are covered at the route level via `app.request()`. The handler-level tests prove only that the Lambda Function URL adapter (`hono/aws-lambda`) routes the new paths correctly and that auth fires before the handler

- [x] **Task 12 — Verification pass** (AC: 15)
  - [x] `pnpm typecheck` green across all five packages
  - [x] `pnpm lint` green (Biome). Common gotcha: Biome's `correctness/noUnusedVariables` rule fires on the `_pk` / `_sk` underscored destructured locals unless the file's Biome scope respects the underscore-prefix convention. The existing repo uses `// biome-ignore lint/correctness/noUnusedVariables: ...` comments where needed — apply the same pattern if the lint fires
  - [x] `pnpm test` green:
    - `shared` adds ~6 tests (song.test.ts: 4; client-error.test.ts: 5; band.test.ts unchanged)
    - `api` adds ~30 tests (lww.test.ts: 7; server-now.test.ts: 4; ddb/songs.test.ts: 6; routes/songs.test.ts: 9; routes/client-errors.test.ts: 6; handler.test.ts: +2 = 4 total)
    - `web` adds 0 tests (the `band.ts` change is a re-export — existing `band-label` tests, if any, continue to pass)
    - `infra` and `e2e` unchanged
  - [x] `pnpm build:api` green. The esbuild bundle target stays under 1MB (the new `@aws-sdk/*` deps are externals; the bundle gains only the Hono wiring for the two new routes plus the LWW + DDB wrapper code — sub-10KB net addition)
  - [x] `pnpm build:web` green (no web bundle change beyond the `ACTIVE_BAND_NAME` re-export — types only)
  - [x] **Do NOT** deploy in this story. The story is server-side code only; the deploy pipeline (Story 1.6) ships the changes on the next merge to `main`. There is no manual iPhone or browser proof for Story 2.3 (the surface this story builds is API-only; visual proof comes when Story 2.5 lights up the Library list and Story 2.6 wires Song Detail edits to PUT)

### Review Findings

- [x] [Review][Patch] `x-server-now` header not asserted in `GET /api/v1/songs/:songId` 404 test [api/src/routes/songs.test.ts — "returns 404 with the NOT_FOUND envelope when absent"]
- [x] [Review][Patch] `x-server-now` header not asserted in `PUT /api/v1/songs/:songId` dropped-as-stale test [api/src/routes/songs.test.ts — "returns 200 dropped-as-stale when incoming is strictly older than existing"]
- [x] [Review][Defer] `serverNowMiddleware` header absent when downstream handler throws — `c.header(...)` is only reached on the happy-path after `await next()`; if next() propagates an unhandled exception Hono's error handler generates the response before the header line runs [api/src/middleware/server-now.ts] — deferred, architectural Hono constraint
- [x] [Review][Defer] `listSongsByBand` has no page-count cap — unbounded DDB scan loops until all pages land in Lambda memory [api/src/ddb/songs.ts] — deferred, intentional single-user design
- [x] [Review][Defer] `clientWrittenAt` far-future value permanently poisons a record — no server-side clock-skew bound; a client sending `"2099-01-01T..."` wins LWW forever [api/src/routes/songs.ts, api/src/lww.ts] — deferred, explicitly deferred by architecture/AC-6 (clock-skew validation is a client concern via `x-server-now`)
- [x] [Review][Defer] DDB errors mid-pagination in `listSongsByBand` produce unstructured 500 — no structured log; partial result silently discarded [api/src/ddb/songs.ts] — deferred, intentional per AC-5 (wrappers propagate errors; Hono handles 500)
- [x] [Review][Defer] DDB errors in `getSong`/`putSong` route handlers produce unstructured 500 — no instrumentation at route level [api/src/routes/songs.ts] — deferred, intentional per AC-5
- [x] [Review][Defer] `SongSchema.parse` (throwing) on DDB read produces unhandled `ZodError` on schema drift — surfaces as unstructured 500 [api/src/ddb/songs.ts] — deferred, intentional per AC-5 (corruption surfaces immediately)
- [x] [Review][Defer] ISO-8601 format variations (`+00:00` vs `Z`, missing milliseconds) break lexicographic LWW comparison — `z.string().datetime()` accepts both; LWW uses raw string `>=` [api/src/lww.ts, shared/src/schemas/song.ts] — deferred, client always sends `.000Z`; architecture convention covers this informally
- [x] [Review][Defer] Empty-string `title`/`songId` accepted — `z.string()` has no `.min(1)` guard; empty `songId` produces `SONG#` DDB key [shared/src/schemas/song.ts] — deferred, explicitly deferred per story notes (Story 2.6 enforces non-empty title at the form layer)
- [x] [Review][Defer] TOCTOU race in `PUT /:songId` — no DynamoDB `ConditionExpression`; two concurrent writes can both pass LWW check and the last HTTP arrival wins [api/src/routes/songs.ts] — deferred, architectural; single-user acceptable; would require DDB conditional write

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Patterns are the contract; deviations require updating that document, not the implementation.

This story implements the **server-side spine of Epic 2**: the Song CRUD API + LWW + client-error endpoint. Three subsystems land in this story; Story 2.4 then wires the matching client-side outbox + flusher + error reporter against them; Story 2.5 lights up the Library list; Story 2.6 wires Song Detail edits.

**Hard rules from the architecture:**

- **Decision 2 — Data store (architecture lines 197–260):** item shapes are `pk = BAND#<bandId>`, `sk = SONG#<songId>` with the Song's fields written as item attributes. PITR enabled on `gigbuddy-data`. The table already exists from Story 1.3; this story only writes through the existing CDK-defined table via the `TABLE_NAME` env var (line 53 of `infra/lib/stacks/api-stack.ts`).
- **Decision 4 — Sync & Offline (architecture lines 277–308):** every record carries `clientWrittenAt` (client-stamped) and `serverReceivedAt` (server-stamped). Server LWW compares `clientWrittenAt`; incoming ≥ existing → persist + return `applied`. Strictly less → return `dropped-as-stale` with `currentState`. **Whole-record PUT semantics — no per-field merging.**
- **AR-23 (epics line 151):** "LWW comparison server-side on `clientWrittenAt` per record; whole-record PUT semantics (Setlist PUT replaces embedded sections+songs+annotations atomically). Stale-write response: `{status: 'dropped-as-stale', currentState}`; client invalidates cache, refreshes, quiet MacBook banner (silent on iPhone in Performance Mode)." Story 2.3 is the Song-shaped half of this — Story 3.1 will reuse `compareLww` for Setlists.
- **AR-24 (epics line 152):** "Every response includes `x-server-now: <ISO-8601>` header; client warns on `|serverNow - Date.now()| > 30s` (clock-skew diagnostic)." Story 2.3 installs the middleware globally; the client-side comparison logic lands in Story 2.4 (`web/src/api/client.ts`).
- **AR-39 (epics line 177):** "`POST /api/v1/client-errors` — fire-and-forget client error reporter (window.onerror, unhandledrejection, React ErrorBoundary). Server writes a structured CloudWatch log line. Failure silent." Story 2.3 owns the server endpoint; Story 2.4 wires the three client-side listeners that POST to it.
- **AR-42 (epics line 182):** "All DDB access via `api/src/ddb/*` wrappers; routes never import raw `@aws-sdk/client-dynamodb`." Enforced by code organization (only `api/src/ddb/client.ts` imports from the SDK); Biome doesn't have a project-level import-allowlist rule today, so the discipline is human-enforced at PR time.
- **AR-43 (epics line 183):** "All SSM access via `api/src/secrets/ssm.ts` (cold-start fetch + module-scope cache)." `api/src/ddb/client.ts` follows the same shape — cached DocClient + test-only reset hook. The two modules mirror each other deliberately so future maintenance reads them as a single pattern.
- **AR-44 (epics line 184):** "Logger middleware redacts known secret param names." The existing `loggerMiddleware` already redacts `password`, `cookie`, `authorization`, `set-cookie`, `gigbuddy_session`. Story 2.3 does NOT add to the redaction list — the new endpoints carry no secrets in headers (Songs and client-errors are post-auth, and the body fields are user content, not credentials).
- **AR-47 (epics line 189):** "IDs use NanoID (16-char URL-safe); never UUIDs or auto-incrementing ints." `ACTIVE_BAND_ID` is a 16-char URL-safe constant; Song IDs are generated by the client (Story 2.6) — Story 2.3 does NOT generate any IDs server-side.
- **AR-48 (epics line 190):** "All timestamps ISO-8601 UTC. Wire format `camelCase`. DDB key prefixes `SCREAMING_SNAKE_CASE` with `#` separator." `serverReceivedAt` is stamped via `new Date().toISOString()` (UTC, millisecond precision). Wire keys are `camelCase` (`bandId`, `songId`, `clientWrittenAt`). DDB keys are `BAND#<bandId>`, `SONG#<songId>`.
- **API envelopes (architecture lines 496–520):** read = `{status: 'ok', data}`, applied write = `{status: 'applied', data}`, stale write = `{status: 'dropped-as-stale', currentState}` (HTTP 200), error = `{status: 'error', error: {code, message}}` (HTTP 400 / 401 / 404 / 5xx). Story 2.3 produces all four shapes.

**Patterns to reuse:**

- **SSM-style module-scope cache** (`api/src/secrets/ssm.ts`): `api/src/ddb/client.ts` mirrors the pattern — cached DocClient, test-only reset hook, lazy env-var read inside the function (not at module-load) so missing env vars surface in handlers, not at cold-start.
- **Hono middleware via `createMiddleware`** (`api/src/middleware/{auth,logger}.ts`): `serverNowMiddleware` follows the same factory pattern. No subclassing; no shared base type.
- **Structured JSON log line** (`api/src/middleware/logger.ts`): `console.log(JSON.stringify({level, msg, ...}))` is the one-line CloudWatch logging idiom. `api/src/routes/client-errors.ts` writes a single line in the same shape; do NOT introduce a logger abstraction or library.
- **`app.request()` route testing** (`api/src/routes/auth.test.ts`): in-process Hono request via `await app.request('/path', { method, body, headers })`. Vitest mocks `../secrets/ssm.js` to short-circuit the SSM fetch; the new route tests mock `../ddb/songs.js` similarly so handlers see controlled records without hitting AWS.
- **Test-only reset hooks via `__resetXForTests`** (`api/src/secrets/ssm.ts`): exported but not via any barrel. The new `__resetDdbClientForTests` follows the same convention.
- **Hoisted vi.mock factories** (`api/src/routes/auth.test.ts:3-13`): `const { mocks } = vi.hoisted(() => ({ ... })); vi.mock('module', () => ({ namedExports: mocks.x }));` ensures the mock fires before the SUT imports. Use the same pattern for `vi.mock('../ddb/songs.js', ...)` in the new route tests.

**Boundaries (CLAUDE.md §Boundaries, architecture lines 1017–1027):**

- `web` ↔ `api`: HTTP only via `/api/v1/*`. Story 2.3 adds three new path patterns under `/api/v1/songs/*` and `/api/v1/client-errors`. Web does NOT consume them in this story (Stories 2.4–2.6 do).
- `web` ↔ `shared`: types + Zod schemas only. Story 2.3 adds `SongSchema`, `SongPutInputSchema`, `ClientErrorReportSchema`, `ACTIVE_BAND_ID`, `ACTIVE_BAND_NAME` to `shared/`. Web's `band.ts` is updated to re-export from `@gigbuddy/shared`; no other web changes.
- `api` ↔ `shared`: same. Server imports the new schemas + the band constants.
- `api` ↔ DynamoDB: all access via `api/src/ddb/*` wrappers (Story 2.3 lands the first two — `client.ts` and `songs.ts`). Routes never import the AWS SDK directly.
- `api` ↔ SSM: unchanged from Story 1.4 (`api/src/secrets/ssm.ts`).
- `infra` ↔ runtime: unchanged. `TABLE_NAME` env var is already wired by `api-stack.ts:53`. `grantReadWriteData` is already wired by `api-stack.ts:59`. Story 2.3 makes no infra changes.

### Library and framework requirements (do NOT substitute)

- **`@aws-sdk/client-dynamodb` (3.x)** + **`@aws-sdk/lib-dynamodb` (3.x)** — the AWS SDK v3 modular client and the DocumentClient wrapper. AWS SDK v3 (NOT v2) is the only acceptable client; v2 is deprecated. Pin the latest 3.x patch at story time.
- **`aws-sdk-client-mock` (4.x)** — the de-facto testing library for AWS SDK v3 mocking. Supports DocumentClient via `mockClient(DynamoDBDocumentClient)`. Do NOT use `vi.mock('@aws-sdk/client-dynamodb', ...)` directly — that's brittle and requires re-mocking every command; `aws-sdk-client-mock` provides a declarative `.on(Command).resolves(...)` API.
- **Hono (existing, ^4.6.0)** — `Hono` instance composition + `createMiddleware` factory. No new Hono extensions (`@hono/zod-validator`, etc.) — the routes use direct `SongPutInputSchema.safeParse(body)` instead of middleware-based validation, matching the existing `routes/auth.ts` pattern.
- **Zod (existing, ^3.23.0 via `shared/`)** — schemas are the contract. `safeParse` for control-flow validation; `.parse` for read-side normalization (DDB items are trusted-but-verified).
- **No new client-side libraries.** The web bundle gains zero net dependencies; `ACTIVE_BAND_NAME` flows through the existing `@gigbuddy/shared` workspace alias.
- **No new lint or test framework changes.** Biome and Vitest are already wired across `shared/` and `api/`.

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture/epics but are owned by other stories. **Do not scaffold:**

- **TanStack Query IndexedDB persister + outbox + flusher** (AR-20, AR-23): Story 2.4. Story 2.3 owns the SERVER. The server's contract is exactly: receive a PUT, apply LWW, return applied / dropped-as-stale. The outbox is the client-side counterpart.
- **`web/src/api/client.ts` fetch wrapper + `x-server-now` drift check** (AR-24): Story 2.4. Story 2.3 sets the header server-side; consuming it is Story 2.4's job.
- **`web/src/lib/error-reporter.ts` + `window.onerror`/`unhandledrejection`/`ErrorBoundary` wiring** (AR-39): Story 2.4. Story 2.3 owns the server endpoint; the client listeners are Story 2.4.
- **Setlist schema, Setlist route, Setlist DDB wrapper** (FR-6 to FR-14): Story 3.1. The `compareLww` function will be reused by Story 3.1 without modification — that is the explicit reason it's generic over `T extends { clientWrittenAt: string }`. Do NOT add `SetlistSchema` in Story 2.3.
- **GSI1 reads (`gsi1pk = BAND#<bandId>#SETLIST_BY_DATE`)** (AR-10): Story 3.1. Story 2.3 only writes to the base table; no GSI projection from Song items.
- **Library list UI + Song Detail UI** (FR-1 to FR-5, FR-29): Stories 2.5 and 2.6. Story 2.3 is server-only.
- **`+ New song` affordance, `useSong()` / `useSongMutation()` hooks** (epic Story 2.5–2.6): Stories 2.5–2.6.
- **`navigator.storage.persist()` call** (AR-21): Story 2.4. Story 2.3 does NOT touch web boot.
- **Service-worker config updates** (AR-26): NOT needed. Story 2.1's existing config already routes `/api/v1/songs/*` (NetworkFirst → `api-cache-v1`) and POST/PUT/DELETE `/api/v1/*` (NetworkOnly catch-all, which covers `POST /api/v1/client-errors`). No `web/vite.config.ts` change in Story 2.3.
- **Export endpoint `GET /api/v1/export`** (AR-38, FR-33): Story 5.1.
- **`GET /api/v1/upcoming-gigs`** (AR-40): Already implemented (or will be) in the deploy-blackout-check work; not part of this story.
- **Local dynamodb-local Docker setup**: deferred per architecture.md Gap #4. Local dev hits real AWS via Sandy's credentials; this story does NOT add a docker-compose file or `dynamodb-local` dev dependency.
- **Migrations / seeding scripts**: V1 needs no seed (the active Band exists implicitly via `ACTIVE_BAND_ID`; no `META` item is required for Song reads/writes — the partition is created on first write). Do NOT add a band-seeding script in Story 2.3.
- **Rate limiting on `POST /api/v1/client-errors`**: deferred. The CloudFront WAF rule (Story 1.3 / AR-34) bounds opportunistic scanning at 100 requests per IP per 5 min — that's the protection. A buggy client could spam its own auth'd window, but with a single user and the auth cookie, the practical worst case is one user spamming themselves with stack traces, which fills CloudWatch but doesn't compromise the service.
- **Schema migration / `version` field bump tooling** (architecture.md §Record shapes "Schema evolution"): not needed in V1. `version: z.literal(1)` is the only version that exists.
- **Caching the SSM `JWT_KEY` / `password-hash` between Lambda invocations**: already done by Story 1.4 (`api/src/secrets/ssm.ts`'s module-scope cache). Story 2.3 reuses that pattern for DocClient but does not modify the secrets cache.
- **CloudWatch Logs Insights queries documenting how to surface client errors**: deferred to a future observability runbook; the structured JSON log line shape is the durable contract.

If you find yourself wanting to scaffold any of the above, **don't**. The respective stories (or future polish work) own them.

### Existing files this story modifies — current state and what changes

#### `shared/src/index.ts` (Task 1, Task 2)

**Current state:** Re-exports from `./schemas/api.js`, `./schemas/auth.js`, `./schemas/band.js`.

**This story changes:** Adds three new re-export lines for `./schemas/song.js`, `./schemas/client-error.js`, and `./active-band.js`. Alphabetize the export list so future additions land in predictable positions.

**Must preserve:** The three existing re-exports (`api`, `auth`, `band`). Removing or reordering them would break Story 1.4's `LoginRequestSchema` / `MeResponseSchema` imports from web and Story 1.2's `BandSchema` import from web tests.

#### `web/src/lib/band.ts` (Task 2)

**Current state:** Defines and exports `ACTIVE_BAND_NAME = 'The Jack Ruby 5' as const` directly (with a header comment about V1 scope + V2 evolution).

**This story changes:** Replaces the local literal with `export { ACTIVE_BAND_NAME } from '@gigbuddy/shared';`. Updates the header comment to reflect that the constant now lives in the shared package and is re-exported here for the web's import surface convenience.

**Must preserve:** The exported name `ACTIVE_BAND_NAME` and its semantic ('The Jack Ruby 5'). The `BandLabel` component (`web/src/components/band-label.tsx:1`) imports from `'../lib/band.js'`; that import statement must continue to resolve. Do NOT remove the file (no callers should reach into `@gigbuddy/shared` directly for band metadata; the web's `lib/band.ts` is the local entrypoint).

#### `api/src/app.ts` (Task 10)

**Current state:** Mounts `loggerMiddleware`, then `authMiddleware` (on `/api/v1/*`), then three routes: `health`, `auth`, `me`.

**This story changes:** Adds `serverNowMiddleware` between `logger` and `auth`. Adds two new routes (`songs`, `clientErrors`). New imports for the two route modules and the middleware.

**Must preserve:** The order of `loggerMiddleware` → `authMiddleware` → routes. The auth-skip list in `authMiddleware` (`['/api/v1/auth/login', '/api/v1/health']`) is unchanged. Existing route mounts (`health`, `auth`, `me`) remain at their existing paths with their existing handlers.

#### `api/src/handler.test.ts` (Task 11)

**Current state:** Two cases — `GET /api/v1/health` returns 200; `GET /api/v1/me` without a cookie returns 401. `buildEvent` is hand-rolled and accepts `{path, headers}`.

**This story changes:** Extends `buildEvent` to accept `{path, method?, body?, headers?}` (defaults preserve existing call sites). Adds two new cases: `GET /api/v1/songs` without a cookie → 401, and `POST /api/v1/client-errors` without a cookie → 401.

**Must preserve:** The two existing cases. The `vi.mock('./secrets/ssm.js', ...)` hoisted-mock pattern (the new cases also rely on the SSM mock so the auth middleware can attempt JWT verification — they pass through to the 401 path because there's no cookie).

#### `api/package.json` (Task 3)

**Current state:** Lists `@aws-sdk/client-ssm`, `@gigbuddy/shared` (workspace), `@hono/node-server`, `hash-wasm`, `hono` as dependencies; `@types/node`, `esbuild`, `tsx`, `typescript`, `vitest` as devDependencies.

**This story changes:** Adds `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` to dependencies; adds `aws-sdk-client-mock` to devDependencies. No script changes.

**Must preserve:** The `--external:@aws-sdk/*` flag in the `build` script — keeps the AWS SDK out of the Lambda bundle (Lambda's Node.js 22 runtime provides AWS SDK v3 modules at runtime).

### Existing files this story DOES NOT touch (regression safety)

- `api/src/handler.ts` — unchanged. The `hono/aws-lambda` adapter is route-agnostic; the new routes are reachable through it for free.
- `api/src/middleware/auth.ts` — unchanged. The `SKIP_PATHS` list does NOT grow; new routes are post-auth.
- `api/src/middleware/logger.ts` — unchanged. The redaction list and JSON shape are correct as-is.
- `api/src/routes/{auth,me,health}.ts` and their tests — unchanged. The new `serverNowMiddleware` adds a header to their responses; existing tests don't assert on absent headers, so they pass.
- `api/src/secrets/ssm.ts` — unchanged. New DDB code reads `TABLE_NAME` via `api/src/ddb/client.ts`, not via SSM.
- `api/src/auth/{jwt,password}.ts` — unchanged. The new routes route through the existing auth middleware; no JWT or password code path changes.
- `web/src/app-bootstrap.tsx`, `web/src/router.tsx`, `web/src/main.tsx`, `web/src/styles/*`, `web/src/components/*`, `web/src/hooks/*`, `web/src/routes/*`, `web/src/auth/*`, `web/src/performance/*`, `web/src/lib/{atmosphere,microcopy,platform}.ts`, `web/vite.config.ts`, `web/pwa-assets.config.ts`, `web/index.html`, `web/public/*` — unchanged. The only web edit is `web/src/lib/band.ts`'s re-export.
- `shared/src/schemas/{api,auth,band}.ts` and their tests — unchanged. New schemas land in new files.
- `infra/*` — unchanged. The DDB table, IAM grants, and `TABLE_NAME` env var are already wired by Story 1.3 (`infra/lib/stacks/api-stack.ts:53` and `infra/lib/stacks/data-stack.ts`).
- `e2e/*` — unchanged. The Playwright smoke covers the auth shell only today (deferred-work item from Story 1.5); adding `/api/v1/songs` E2E coverage is a future Story 2.5+ concern.
- `.github/workflows/*` — unchanged. The deploy pipeline ships the new bundle automatically.
- `biome.json`, `tsconfig.base.json`, `tsconfig.json` files in each package — unchanged. New `*.ts` files under `src/**` are covered by the existing globs.
- `pnpm-workspace.yaml` — unchanged. No new packages.

### Previous story intelligence (relevant per-story learnings)

From the **Epic 1 retrospective** (`_bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md`):

- **Lesson #1 — Human-required steps must be explicit unchecked task checkboxes.** Story 2.3 has NO human-required steps — it is pure server code verified by `pnpm test` + `pnpm build`. The next manual proof point arrives in Story 2.5 (Library list) and Story 2.6 (Song Detail edits) where Sandy will exercise the full PUT path end-to-end.
- **Lesson #3 — When a new directory or config file is created, add it to Biome and tsconfig coverage in the same commit.** Story 2.3 adds files only under existing covered paths: `shared/src/schemas/**`, `shared/src/**` (top-level), `api/src/ddb/**`, `api/src/middleware/**`, `api/src/routes/**`, `api/src/**` (top-level for `lww.ts`). All are already inside `biome.json` `files.includes` and the respective `tsconfig.json` `include` globs. No coverage gaps.
- **Lesson #4 — End-to-end behavioral paths need explicit integration test coverage, not just unit tests.** Story 2.3's "integration" surface is the Hono `app.request()` route tests — they exercise auth → route → ddb wrapper (mocked) → response envelope. The handler-level test (`handler.test.ts`) adds the outer ring: Lambda adapter → app → auth → 401. The full client-to-server integration lands when Story 2.4's `web/src/api/client.ts` first hits the deployed `/api/v1/songs` endpoint.

From **Story 2.2** (commit `5db5b6b`, status `done`):

- The `PerformanceModeProvider` mounting contract from Story 1.5 is preserved — Story 2.3 does not touch web at all beyond the `band.ts` re-export.
- The `gigbuddy_session` cookie carries across the iPhone Safari → installed-PWA boundary (Sandy's manual proof). This means the API's auth middleware will see the same cookie regardless of which iPhone surface (Safari vs. installed PWA) made the request — no surface-specific handling required.
- `isStandalone()` and `isIPhone()` continue to live in `web/src/lib/platform.ts`. Story 2.3 does not consume them on the server (the API is platform-agnostic; it doesn't care which device made the call).

From **Story 2.1** (commit `5db5b6b` baseline, status `done`):

- The SW's runtime-caching rules already cover this story's new routes correctly: GET `/api/v1/songs/*` is `NetworkFirst` (api-cache-v1); POST/PUT/DELETE under `/api/v1/*` is `NetworkOnly` (which includes `POST /api/v1/client-errors`). No SW config change in Story 2.3.
- Deferred-work item from Story 2.1: "GET /api/v1/* non-songs/setlists routes fall through runtimeCaching". This is irrelevant to Story 2.3 — songs IS the route, not a fall-through case. Story 5.1 will address `/api/v1/export`.

From **Story 1.4** (commit `7384bc6`):

- `authMiddleware` already enforces the cookie-required contract on all `/api/v1/*` paths except the two skip-listed ones. Story 2.3 inherits this for free — no new auth wiring in the route handlers.
- The `loggerMiddleware` redacts secret-name headers but logs the full path. New paths (`/api/v1/songs`, `/api/v1/client-errors`) will appear in the structured request-log lines — that's the intent (CloudWatch Logs Insights queries by path).
- The `verifyPassword` uniform-timing pattern is auth-route-specific; the new routes return 401 from `authMiddleware` (cookie absent or invalid) without any password verification — no timing concern.

From **Story 1.3** (commit `26ddf8b`):

- The Lambda function's IAM role already has `grantReadWriteData` on `gigbuddy-data` (`infra/lib/stacks/api-stack.ts:59`). Story 2.3 does NOT need to modify any IAM policy. The DocClient's `PutCommand` / `GetCommand` / `QueryCommand` calls succeed against the existing grant.
- The DDB table is `gigbuddy-data` in `eu-west-2` with `pk` (S) + `sk` (S) primary key and `gsi1pk` / `gsi1sk` GSI1. Story 2.3 only uses the primary key; GSI1 is Story 3.1's concern.
- `kms:Decrypt` on `ssm.${region}.amazonaws.com` is already permitted (api-stack.ts:69–78). The new DDB code path is server-managed AWS-key encryption (table-level setting); no KMS permissions needed at the Lambda role level.

### Implementation patterns reused from architecture

- **SSM-style module-scope client cache** (`api/src/secrets/ssm.ts`): `api/src/ddb/client.ts` mirrors the cached-singleton pattern. Test-only reset hook for clean test isolation.
- **`app.request()` route testing with hoisted mocks** (`api/src/routes/auth.test.ts`): the new `routes/songs.test.ts` and `routes/client-errors.test.ts` mock `../ddb/songs.js` and `../secrets/ssm.js` via the same `vi.hoisted` + `vi.mock` pattern.
- **Structured JSON log line for CloudWatch** (`api/src/middleware/logger.ts`): one-line `JSON.stringify({level, msg, ...})` calls. `routes/client-errors.ts` emits the same shape.
- **Hono middleware factory** (`api/src/middleware/{auth,logger}.ts`): `createMiddleware` from `hono/factory`. No subclassing; no shared base.
- **Error envelope contract** (`shared/src/schemas/api.ts` + `api/src/routes/auth.ts`): `{status: 'error', error: {code, message}}`. Story 2.3's three new error code values are `VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED` (the last is emitted by the existing auth middleware, not by Story 2.3's code).
- **Whole-record persistence** (architecture.md §LWW server logic + AR-23): the route handler reads the WHOLE input, validates, applies LWW, and writes the WHOLE input back. No partial updates, no `UpdateExpression` — `PutCommand` is correct.

### Latest tech information (versions verified at story-write time, 2026-06-16)

- **AWS SDK for JavaScript v3** — current stable line is 3.x; modular packages (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) are the V1-on-Lambda standard. v2 is in maintenance mode and incompatible with Node.js 18+ (`ReadableStream` deprecations) — do NOT use v2.
- **`@aws-sdk/lib-dynamodb` DocumentClient** — the recommended high-level abstraction over the raw DDB client. `marshallOptions: { removeUndefinedValues: true }` is the recommended config for handling optional fields cleanly; without it, undefined values are written as DDB `NULL` attributes (which a downstream schema parser may reject).
- **`aws-sdk-client-mock`** — community-maintained, AWS-official-recommended for v3 testing. 4.x line supports modular clients; the API is `mockClient(DynamoDBDocumentClient).on(GetCommand).resolves({Item: ...})`. Stable since 2022.
- **Hono 4.x** — current stable. `createMiddleware`, `c.req.json()`, `c.json(...)`, `c.body(null, 204)` are all stable APIs. No 4.x breaking changes affect Story 2.3.
- **Node.js 22 Lambda runtime** — includes AWS SDK v3 modules at runtime (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` are present in the runtime's `node_modules/`). Bundling with `--external:@aws-sdk/*` is therefore both correct (matches the runtime's resolution) and optimal (bundle size).
- **Zod 3.23** — `z.literal(1)`, `z.string().datetime()`, `.optional()`, `.omit({...})`, `.safeParse()` are all stable. Story 2.3 uses no Zod 4 features (Zod 4 is in alpha at time of writing; staying on 3.x is correct).

### Files this story creates

- `shared/src/schemas/song.ts` — `SongSchema`, `SongPutInputSchema`, inferred types
- `shared/src/schemas/song.test.ts` — Vitest cases for both schemas
- `shared/src/schemas/client-error.ts` — `ClientErrorReportSchema`, inferred type
- `shared/src/schemas/client-error.test.ts` — Vitest cases
- `shared/src/active-band.ts` — `ACTIVE_BAND_ID`, `ACTIVE_BAND_NAME` constants
- `api/src/ddb/client.ts` — `getDocClient`, `getTableName`, `__resetDdbClientForTests`
- `api/src/ddb/songs.ts` — `getSong`, `putSong`, `listSongsByBand`
- `api/src/ddb/songs.test.ts` — Vitest cases using `aws-sdk-client-mock`
- `api/src/lww.ts` — `compareLww`
- `api/src/lww.test.ts` — Vitest cases (the seven from AC-6)
- `api/src/middleware/server-now.ts` — `serverNowMiddleware`
- `api/src/middleware/server-now.test.ts` — Vitest cases (the four from AC-7)
- `api/src/routes/songs.ts` — Hono route group for `/api/v1/songs`
- `api/src/routes/songs.test.ts` — Vitest route-level integration tests
- `api/src/routes/client-errors.ts` — Hono route group for `/api/v1/client-errors`
- `api/src/routes/client-errors.test.ts` — Vitest route-level integration tests

### Files this story modifies

- `shared/src/index.ts` — adds three new re-export lines
- `web/src/lib/band.ts` — replaces literal with re-export from `@gigbuddy/shared`
- `api/src/app.ts` — wires two new routes + the server-now middleware
- `api/src/handler.test.ts` — extends `buildEvent`; adds two unauth cases
- `api/package.json` — adds `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` (deps), `aws-sdk-client-mock` (devDep)
- `pnpm-lock.yaml` — reflects the three added packages

### Files this story deletes

None.

### Project Structure Notes

- **Fully aligned with the architecture's directory tree** (architecture.md lines 920–966):
  - `api/src/ddb/client.ts` — present in the planned tree at line 940 (`client.ts # DDB DocClient setup`). Story 2.3 lands it.
  - `api/src/ddb/songs.ts` — present at line 941 (`songs.ts # getSong, putSong`). Story 2.3 lands it; adds `listSongsByBand` per epic story AC.
  - `api/src/lww.ts` — present at line 938 (`lww.ts # canonical LWW server logic`). Story 2.3 lands it.
  - `api/src/middleware/server-now.ts` — present at line 928 (`server-now.ts # x-server-now header`). Story 2.3 lands it.
  - `api/src/routes/songs.ts` — present at line 932 (`songs.ts # GET/PUT /songs`). Story 2.3 lands it.
  - `api/src/routes/client-errors.ts` — present at line 935 (`client-errors.ts # POST /client-errors (§A.4)`). Story 2.3 lands it.
  - `shared/src/schemas/song.ts` — present at line 958 (`song.ts # Zod SongSchema`). Story 2.3 lands it.
- **New file not in the planned tree:** `shared/src/active-band.ts`. The architecture's `shared/` tree only shows `schemas/`, `types/`, and `index.ts` (no top-level constants file). The constant is small enough that it could alternatively live as an extension of `shared/src/schemas/band.ts`, but a dedicated `active-band.ts` file is cleaner because it carries no Zod schema (it's a runtime constant, not a record shape). **Architecture deviation:** the dev agent may optionally update `architecture.md`'s `shared/` tree to add `active-band.ts # ACTIVE_BAND_ID, ACTIVE_BAND_NAME` between `schemas/` and `types/`, but this is not required to ship Story 2.3.
- **Not in the planned tree but exists as a new file:** `shared/src/schemas/client-error.ts`. The architecture's `shared/schemas/` tree lists `song.ts`, `setlist.ts`, `auth.ts`, `api.ts` (no `client-error.ts`). The endpoint schema needs to live somewhere; placing it in `shared/schemas/` is the natural home (the schema is the contract between client and server, identical to the Song/Setlist pattern). **Architecture deviation:** the dev agent may optionally add `client-error.ts # Zod ClientErrorReportSchema` to the architecture's `shared/schemas/` tree listing; not ship-blocking.

### Testing requirements

- **Unit (Vitest, shared package):**
  - `shared/src/schemas/song.test.ts` — ~4 cases (valid full record; valid title-only record; rejects missing required field; `SongPutInputSchema` rejects body containing `serverReceivedAt`)
  - `shared/src/schemas/client-error.test.ts` — ~5 cases (valid full payload; valid without `stack`; rejects missing `where`/`message`/`performanceActive`/`timestamp`; rejects non-ISO `timestamp`)
- **Unit (Vitest, api package):**
  - `api/src/lww.test.ts` — ~7 cases (per AC-6)
  - `api/src/middleware/server-now.test.ts` — ~4 cases (per AC-7)
  - `api/src/ddb/songs.test.ts` — ~6 cases using `aws-sdk-client-mock` (per AC-14)
  - `api/src/routes/songs.test.ts` — ~9 cases via `app.request()` (per AC-14)
  - `api/src/routes/client-errors.test.ts` — ~6 cases via `app.request()` (per AC-14)
  - `api/src/handler.test.ts` — +2 cases (GET /songs unauth, POST /client-errors unauth)
- **E2E (Playwright):** no changes. The smoke spec covers the authenticated shell only; Story 2.5 (Library list) is the natural place to add an e2e check that lists Songs end-to-end.
- **Build-output (Vitest, web package):** no changes. Story 2.1's `web/src/build-output.test.ts` covers the SW + manifest; Story 2.3 makes no SW or manifest changes.
- **No manual proof checkbox** (per Epic 1 retro Lesson #1 — there are no human-required steps in this story).

### Dev environment reminders

- **Local API dev hits real AWS:** `pnpm dev:api` runs `tsx watch src/dev.ts` on port 3100. To exercise DDB locally, set `TABLE_NAME=gigbuddy-data AWS_REGION=eu-west-2 AWS_PROFILE=<sandy's profile> pnpm dev:api`. The Lambda IAM role won't apply (you're running under your own AWS credentials), but the table grants the same RW access pattern from any role with the appropriate policy. For tests, `aws-sdk-client-mock` short-circuits the SDK send — no AWS credentials needed in `pnpm test`.
- **The Vite dev server proxies `/api/*` to the Hono dev server.** If you want to manually smoke a `PUT /api/v1/songs/:id` end-to-end on `localhost`, ensure both `pnpm dev:web` and `pnpm dev:api` are running (or use `pnpm dev` which runs both in parallel).
- **Add a `.env` only via `.env.local`** (gitignored). The repo has no `.env.example`; the env vars Sandy needs locally are `TABLE_NAME`, `AWS_REGION`, `AWS_PROFILE`, `JWT_KEY_PARAM`, `PASSWORD_HASH_PARAM` (the latter two are only needed if the dev session calls auth-protected routes).
- **`@aws-sdk/*` package versions:** when adding `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`, pin the same minor as the existing `@aws-sdk/client-ssm` (`^3.658.0`) if possible — keeps the AWS SDK monorepo aligned across clients and reduces the chance of transitive-dep skew.
- **Node 22, pnpm 11.0.9** — both already pinned. Do not bump.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 2 — Data Store] (lines 197–260) — DDB single-table item shapes, GSI1, deletion guardrails
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 4 — Sync & Offline] (lines 277–308) — LWW server logic + `dropped-as-stale` envelope + `x-server-now` header
- [Source: _bmad-output/planning-artifacts/architecture.md#Record shapes (canonical Zod schemas in shared/)] (lines 522–567) — verbatim `SongSchema` shape
- [Source: _bmad-output/planning-artifacts/architecture.md#LWW server logic] (lines 571–588) — `compareLww` pseudocode
- [Source: _bmad-output/planning-artifacts/architecture.md#API response envelope] (lines 496–520) — `ok` / `applied` / `dropped-as-stale` / `error` shapes
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging] (lines 756–766) — structured JSON log line shape; `POST /api/v1/client-errors` contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural boundaries] (lines 1017–1027) — DDB access via `api/src/ddb/*` only; SSM via `api/src/secrets/ssm.ts` only; `web ↔ api` HTTP only; `web ↔ shared` Zod-only
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming conventions] (lines 473–494) — `camelCase` JSON over the wire; NanoID 16-char URL-safe; ISO-8601 UTC
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory tree] (lines 840–1015) — `api/src/ddb/`, `api/src/lww.ts`, `api/src/middleware/server-now.ts`, `api/src/routes/{songs,client-errors}.ts`, `shared/src/schemas/song.ts`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] (lines 732–784) — verbatim AC text
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2] (lines 269–283) — epic objectives; key ARs (AR-9, AR-11, AR-23, AR-24, AR-39, AR-42–44, AR-47, AR-48)
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] AR-9 (line 133), AR-11 (line 135), AR-23 (line 151), AR-24 (line 152), AR-39 (line 177), AR-42 (line 182), AR-43 (line 183), AR-44 (line 184), AR-47 (line 189), AR-48 (line 190)
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-15.md] — Lesson #1 (no manual step needed in 2.3), Lesson #3 (file coverage in same commit), Lesson #4 (route-level integration tests are the load-bearing coverage)
- [Source: _bmad-output/implementation-artifacts/2-2-iphone-pwa-install-gate.md] — gate path; cookie carries across Safari/PWA boundary (informs how API auth behaves for both surfaces)
- [Source: _bmad-output/implementation-artifacts/2-1-service-worker-pwa-manifest.md] — SW rules already cover GET `/api/v1/songs/*` (NetworkFirst → api-cache-v1) and POST/PUT/DELETE `/api/v1/*` (NetworkOnly catch-all)
- [Source: _bmad-output/implementation-artifacts/1-4-access-gate-single-password-jwt-cookie-ssm.md] — `authMiddleware` SKIP_PATHS; `loggerMiddleware` redaction list; SSM module-scope cache pattern
- [Source: _bmad-output/implementation-artifacts/1-3-aws-infrastructure-stacks-data-api-web-observability-ci.md] — DDB table `gigbuddy-data` + GSI1; Lambda env `TABLE_NAME`; `grantReadWriteData` IAM grant
- [Source: api/src/middleware/auth.ts] — existing `authMiddleware`; the new routes inherit gating for free
- [Source: api/src/middleware/logger.ts] — existing redaction pattern; new routes do NOT add new redaction entries
- [Source: api/src/routes/auth.ts] — existing route pattern: `try { c.req.json() } catch { return c.json(badRequest, 400); }`; reuse in `routes/songs.ts` PUT handler
- [Source: api/src/secrets/ssm.ts] — existing module-scope cache pattern; mirror in `api/src/ddb/client.ts`
- [Source: api/src/handler.ts] — Lambda adapter; no changes needed
- [Source: api/src/app.ts] — existing Hono composition; extended in Task 10
- [Source: shared/src/schemas/api.ts] — `OkResponseSchema`, `AppliedResponseSchema`, `DroppedAsStaleResponseSchema`, `ErrorResponseSchema` — Story 2.3 uses all four
- [Source: shared/src/schemas/auth.ts] — existing Zod schema style (consistent with how `SongSchema` is authored)
- [Source: shared/src/schemas/band.ts] — `BandSchema` (existing); `ACTIVE_BAND_ID` is intentionally NOT added to this file (kept in `active-band.ts` instead) — the schema is the record contract, the constant is the V1 single-Band runtime value
- [Source: web/src/lib/band.ts] — existing `ACTIVE_BAND_NAME` export; refactor to re-export from `@gigbuddy/shared`
- [Source: web/src/components/band-label.tsx] — consumer of `ACTIVE_BAND_NAME`; import statement unchanged
- [Source: infra/lib/stacks/api-stack.ts] — `TABLE_NAME` env (line 53); `grantReadWriteData` IAM grant (line 59); no changes required in Story 2.3
- [Source: infra/lib/stacks/data-stack.ts] — DDB table `gigbuddy-data`; `pk` + `sk` primary key; `gsi1pk` + `gsi1sk` GSI1; no changes required
- [Source: CLAUDE.md] — boundaries (`web ↔ api` HTTP only; `web ↔ shared` Zod schemas only; `api/src/ddb/*` is the only DDB import surface; `api/src/secrets/ssm.ts` is the only SSM access); Zod schemas in `shared/` are the single source of truth (no parallel TypeScript types)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`

### Debug Log References

- **Typecheck red→green:** test helpers `authedRequest` / `authedPost` initially typed as `(): Promise<Response>` but `app.request()` returns `Response | Promise<Response>`. Marking the helpers `async` coerces to the awaitable form; no behavioural change.
- **Lint warnings about `biome-ignore` on `_pk` / `_sk`:** Biome reported the suppression comments as no-effect — rest-spread destructuring (`const { pk: _pk, sk: _sk, ...rest } = item`) doesn't fire `noUnusedVariables`, so the underscore-prefix alone is sufficient. Removed the comments; story spec's "common gotcha" note didn't apply.
- **aws-sdk-client-mock + cached DocClient:** initial test had `__resetDdbClientForTests()` in afterEach, which would have invalidated the patched instance for subsequent tests. Switched to `ddbMock.reset()` only between tests, keeping the cached (patched) DocClient instance for the lifetime of the test file.

### Completion Notes List

- **AC-1 — `SongSchema` / `SongPutInputSchema`:** added `.strict()` to `SongPutInputSchema` so a body that includes `serverReceivedAt` (or any unknown key) is rejected with 400 — AC-14 explicitly asserts "rejects a body that includes serverReceivedAt", which Zod's default `.omit()` (silent-strip) would not satisfy. `.strict()` is a minimal extension of the spec's template that satisfies AC-14's contract and gives clean defense-in-depth against future client schema drift.
- **AC-5 — DDB wrappers:** `getSong`, `putSong`, `listSongsByBand` go through the cached DocClient. `pk`/`sk` are derived in `songKey()` (single helper), and read-side strips them via rest-spread before `SongSchema.parse(rest)`. `listSongsByBand` pages through `LastEvaluatedKey` correctly — verified by a two-page mock test that asserts the second `QueryCommand` carries `ExclusiveStartKey`.
- **AC-6 — LWW:** `compareLww<T extends { clientWrittenAt: string }>` is two lines; the 7 exhaustive cases from AC-6 are all green. Same-timestamp wins (per architecture's `>=`); cross-boundary lexical comparison verified across ms / sec / day.
- **AC-7 — `x-server-now`:** middleware sets the header after `next()`, wired in `app.ts` AFTER `loggerMiddleware` and BEFORE `authMiddleware`. Because the middleware's body runs on the way back up the stack, registering it before auth means the header lands on 401 responses too — verified by `server-now.test.ts` (200 / 401 / 5xx all carry the header) and by `songs.test.ts` / `client-errors.test.ts` (every response asserts `x-server-now` parses as ISO-8601).
- **AC-10 — PUT applies LWW:** validation order matches the spec: parse → path-vs-body songId → bandId-vs-ACTIVE_BAND_ID → fetch existing → compareLww → put (apply) or return current (drop). The `drop` branch carries a defensive invariant assertion (`if (!existing) throw …`) because TypeScript can't narrow `existing` to non-undefined from the `compareLww` return alone; the assertion is unreachable at runtime.
- **AC-11 — client-errors:** valid payloads emit `level: 'error', msg: 'client-error', ...payload` on one `console.log` line; malformed payloads emit `level: 'warn', msg: 'client-errors malformed payload'`. Confirmed that the alert-eligible query (`filter level = "error"`) is not polluted by client-side bugs.
- **AC-14 — Test coverage:** 35 new tests landed across 7 new test files (shared/song: 6, shared/client-error: 8, api/lww: 7, api/middleware/server-now: 5, api/ddb/songs: 8, api/routes/songs: 10, api/routes/client-errors: 5) + 2 new cases in `api/src/handler.test.ts` (unauth on `GET /songs` and `POST /client-errors`). Full workspace test count moved from ~195 → 230, no regressions.
- **AC-15 — Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm --filter api build` all green. API Lambda bundle stays at 485 kB (well under the 1 MB architecture target); `@aws-sdk/*` externals keep the new DDB deps out of the bundle.
- **Deps added:** `@aws-sdk/client-dynamodb ^3.1066.0` and `@aws-sdk/lib-dynamodb ^3.1069.0` (dependencies); `aws-sdk-client-mock ^4.1.0` (devDependencies). No incidental version bumps.
- **No manual proof step:** confirmed per the story spec — Story 2.3 is server-only. Story 2.5 (Library list) is the first end-to-end PUT/GET proof point for Sandy.

### File List

**Created:**
- `shared/src/active-band.ts`
- `shared/src/schemas/song.ts`
- `shared/src/schemas/song.test.ts`
- `shared/src/schemas/client-error.ts`
- `shared/src/schemas/client-error.test.ts`
- `api/src/ddb/client.ts`
- `api/src/ddb/songs.ts`
- `api/src/ddb/songs.test.ts`
- `api/src/lww.ts`
- `api/src/lww.test.ts`
- `api/src/middleware/server-now.ts`
- `api/src/middleware/server-now.test.ts`
- `api/src/routes/songs.ts`
- `api/src/routes/songs.test.ts`
- `api/src/routes/client-errors.ts`
- `api/src/routes/client-errors.test.ts`

**Modified:**
- `shared/src/index.ts` (added three new re-export lines)
- `web/src/lib/band.ts` (replaced local literal with re-export from `@gigbuddy/shared`)
- `api/src/app.ts` (wired `serverNowMiddleware` + `songsRoute` + `clientErrorsRoute`)
- `api/src/handler.test.ts` (extended `buildEvent` with `method`/`body`; added 2 unauth cases)
- `api/package.json` (added 2 deps + 1 devDep)
- `pnpm-lock.yaml` (reflects the 3 new packages and their transitive deps)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story 2.3 → in-progress → review)

## Change Log

| Date       | Change                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-06-16 | Story spec created (status: ready-for-dev). Builds on Story 2.2's iPhone install gate; lands the server-side spine of Epic 2 (Song CRUD with LWW, client-errors endpoint, x-server-now middleware, `ACTIVE_BAND_ID` constant). Story 2.4 wires the matching client-side outbox + flusher + error reporter. |
| 2026-06-16 | Implementation complete (status: review). 35 new tests across shared + api; full workspace at 230 passing, no regressions. API Lambda bundle 485 kB. AWS SDK v3 DDB packages externalised; `aws-sdk-client-mock` 4.x added as devDep. `SongPutInputSchema` uses `.strict()` to enforce the AR-23 no-`serverReceivedAt` client contract. |
