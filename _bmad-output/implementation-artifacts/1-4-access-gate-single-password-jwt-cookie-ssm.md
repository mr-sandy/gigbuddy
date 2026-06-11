---
baseline_commit: 26ddf8b
---

# Story 1.4: Access gate — single password, JWT cookie, SSM

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Sandy,
I want a single-password access gate with a long-lived signed-JWT cookie,
so that my deployment is not publicly readable, I authenticate once per device, and I stay logged in for a year without account-management ceremony.

## Acceptance Criteria

**AC-1 — Hono auth middleware blocks unauthenticated `/api/v1/*` reads**

**Given** an unauthenticated request to any `/api/v1/*` route except `/api/v1/auth/login` and `/api/v1/health`
**When** the request hits the Hono auth middleware
**Then** the response is HTTP 401 with envelope `{status: 'error', error: {code: 'UNAUTHORIZED', message: '...'}}`
**And** no data is leaked beyond the error envelope
**And** the middleware short-circuits before the route handler runs

**AC-2 — SPA boot distinguishes offline-cache from online-401**

**Given** an unauthenticated browser load of the deployed subdomain
**When** the SPA bundle (publicly readable, carries no data) hydrates
**Then** the SPA calls `GET /api/v1/me`
**And** on a successful network response with HTTP 401, the SPA routes to `/login`
**And** on a network failure (offline / fetch rejects), the SPA renders the cached app shell with `authenticated='unknown'` (per AR-16) — it does NOT route to `/login`
**And** on HTTP 200, the SPA sets `authenticated='true'` and renders the authenticated shell

**AC-3 — `POST /api/v1/auth/login` issues the session cookie on correct password**

**Given** `POST /api/v1/auth/login` with body `{password: <correct password>}`
**When** the server verifies the password via argon2id against the SSM-stored hash
**Then** the server sets a `gigbuddy_session` cookie with attributes `HttpOnly: true`, `Secure: true`, `SameSite: Strict`, `Max-Age: 31536000`, `Path: /`
**And** the cookie value is a signed JWT (HS256) whose signing key is fetched from SSM Parameter `/gigbuddy/jwt-key` at Lambda cold-start and cached in module-scope memory
**And** the JWT payload contains `sub: 'sandy'`, `iat: <now>`, `exp: <now + 31536000>` (one year, matching `Max-Age`)
**And** the response is HTTP 200 with body `{status: 'applied'}`

**AC-4 — `POST /api/v1/auth/login` rejects incorrect password without timing oracle**

**Given** `POST /api/v1/auth/login` with an incorrect password
**When** the server verifies via argon2id
**Then** the response is HTTP 401 with body `{status: 'error', error: {code: 'INVALID_CREDENTIALS', message: 'wrong password'}}`
**And** argon2id verification runs to completion on every login attempt regardless of outcome (no early-return on a missing or malformed hash) so the response timing does not leak whether the password was correct, the SSM parameter was absent, or the stored hash was malformed
**And** the malformed-input cases (missing body, missing `password` field, non-string `password`) return HTTP 400 with code `VALIDATION_FAILED` after a full argon2id pass against a deterministic dummy hash, so timing remains uniform across rejection paths

**AC-5 — Auth middleware verifies the JWT signature from the SSM-fetched key**

**Given** an authenticated request with a valid `gigbuddy_session` cookie
**When** the request hits any `/api/v1/*` route (other than the two skipped paths)
**Then** the middleware verifies the JWT signature using the SSM-fetched key (read from the module-scope cache; SSM is not called again on warm invocations)
**And** on signature validity AND non-expired `exp`, the route handler executes and receives the verified `sub` claim
**And** on signature failure, expired `exp`, malformed JWT, or missing cookie, the response is HTTP 401 with envelope `{status: 'error', error: {code: 'UNAUTHORIZED', message: '...'}}`

**AC-6 — `GET /api/v1/me` reports authenticated state and cookie expiry days**

**Given** SPA boot post-login (valid cookie)
**When** `GET /api/v1/me` runs
**Then** the response is HTTP 200 with body `{status: 'ok', data: {authenticated: true, daysUntilExpiry: <integer>}}`
**And** `daysUntilExpiry` is computed as `floor((exp - now) / 86400)` from the JWT claims
**And** the SPA stores `authenticated='true'` and `daysUntilExpiry` in `AuthContext`

**Given** SPA boot pre-login (no cookie, invalid cookie, or expired cookie)
**When** `GET /api/v1/me` runs
**Then** the response is HTTP 401 (the auth middleware short-circuits as in AC-1)
**And** the SPA routes to `/login` per AC-2

**AC-7 — 401 redirect respects `performanceActive` (architecture seam)**

**Given** a 401 returned from a successful network call (not from cache) **while `performanceActive === false`**
**When** any `/api/v1/*` call (other than `/me` and `/auth/login`) hits the SPA
**Then** the SPA routes to `/login`

**Given** the same 401 **while `performanceActive === true`** (the flag is set in Epic 4)
**When** the response arrives
**Then** the redirect is held — the SPA does NOT route to `/login` (per AR-28)
**And** in Story 1.4 the flag is read from a placeholder `usePerformanceActive()` hook that returns `false` at every call site (the `PerformanceModeContext` lands in Story 1.5; the setter lands in Story 4.1). The redirect-decision function takes `performanceActive` as an explicit parameter so the Story 1.5 / Epic 4 wiring requires no code change inside the auth module.

**AC-8 — Re-authenticate-soon banner on MacBook, silent on iPhone**

**Given** the cookie has 30 days or less until expiry (`daysUntilExpiry <= 30`)
**When** the SPA boots on MacBook (`!isIPhone()`)
**Then** a quiet, dismissible "Re-authenticate within N days" banner appears in the authenticated shell
**And** the banner uses Practice-atmosphere tokens (no Performance-mode chrome)
**And** dismissal persists for the rest of the session (in-memory; localStorage NOT used — re-prompt is fine on next reload)
**And** the banner does NOT appear when `daysUntilExpiry > 30`
**And** the banner does NOT appear on iPhone regardless of `daysUntilExpiry`
**And** the banner copy is `Re-authenticate within N days.` (lowercase verb after the colon style — full sentence with a period; no exclamation marks per EXPERIENCE.md voice rules)

**AC-9 — Secrets never leak through env, logs, or response bodies**

**Given** a Lambda code review of all files this story creates
**When** secret handling is audited
**Then** the JWT signing key and the SSM-stored argon2id password hash are NEVER passed into `lambdaFn.environment` (Story 1.3's `api-stack.ts` continues to carry only the **parameter NAMES** `JWT_KEY_PARAM` / `PASSWORD_HASH_PARAM`, not the values)
**And** no `console.log` / `console.error` invocation in the new code emits the JWT key, the password hash, the cookie value, or the inbound password
**And** the logger middleware redacts known secret param names (`password`, `cookie`, `authorization`, `set-cookie`, `gigbuddy_session`) from any structured JSON log line — header/body keys matching these names are replaced with the literal string `'[REDACTED]'`
**And** no API response body contains the JWT key, password hash, plaintext password, or cookie value
**And** the cookie is only set via `Set-Cookie` (never echoed into a response body)

## Tasks / Subtasks

- [x] **Task 1 — Shared Zod schemas for auth wire contract** (AC: 3, 4, 6)
  - [x] Create `shared/src/schemas/auth.ts` exporting:
    - `LoginRequestSchema = z.object({ password: z.string().min(1) })` — server applies this with `.safeParse` so non-string / missing password falls through into the uniform-timing rejection path (AC-4)
    - `LoginAppliedResponseSchema = z.object({ status: z.literal('applied') })`
    - `MeDataSchema = z.object({ authenticated: z.literal(true), daysUntilExpiry: z.number().int().nonnegative() })`
    - `MeResponseSchema = OkResponseSchema(MeDataSchema)` (uses the existing helper from `shared/src/schemas/api.ts`)
    - Re-export `type LoginRequest = z.infer<typeof LoginRequestSchema>` etc. — no parallel TS `type`/`interface` for the record shape (per CLAUDE.md: Zod schemas in `shared/` are the single source of truth).
  - [x] Update `shared/src/index.ts` to re-export `./schemas/auth.js` alongside the existing exports.
  - [x] Add `shared/src/schemas/auth.test.ts` asserting that `MeResponseSchema.parse({ status: 'ok', data: { authenticated: true, daysUntilExpiry: 365 } })` succeeds and that `daysUntilExpiry: -1`, `daysUntilExpiry: 1.5`, and `authenticated: false` all reject. Mirrors `band.test.ts` style.

- [x] **Task 2 — SSM secret fetch + module-scope cache** (AC: 3, 5, 9)
  - [x] Add `@aws-sdk/client-ssm` to `api/package.json` `dependencies` (the esbuild bundle config already passes `--external:@aws-sdk/*`, so AWS SDK v3 resolves from the Lambda runtime layer at execution time — no bundle bloat).
  - [x] Create `api/src/secrets/ssm.ts`:
    ```ts
    import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

    let cachedJwtKey: string | undefined;
    let cachedPasswordHash: string | undefined;
    let ssmClient: SSMClient | undefined;

    function client(): SSMClient {
      if (!ssmClient) ssmClient = new SSMClient({});
      return ssmClient;
    }

    async function fetch(parameterName: string): Promise<string> {
      const result = await client().send(
        new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
      );
      const value = result.Parameter?.Value;
      if (!value) throw new Error(`SSM parameter ${parameterName} is empty or missing`);
      return value;
    }

    export async function getJwtKey(): Promise<string> {
      if (cachedJwtKey) return cachedJwtKey;
      const name = process.env.JWT_KEY_PARAM;
      if (!name) throw new Error('JWT_KEY_PARAM env var is not set');
      cachedJwtKey = await fetch(name);
      return cachedJwtKey;
    }

    export async function getPasswordHash(): Promise<string> {
      if (cachedPasswordHash) return cachedPasswordHash;
      const name = process.env.PASSWORD_HASH_PARAM;
      if (!name) throw new Error('PASSWORD_HASH_PARAM env var is not set');
      cachedPasswordHash = await fetch(name);
      return cachedPasswordHash;
    }

    /** Test-only: clear the module-scope cache between cases. Not exported via the package barrel. */
    export function __resetSecretsCacheForTests(): void {
      cachedJwtKey = undefined;
      cachedPasswordHash = undefined;
      ssmClient = undefined;
    }
    ```
  - [x] **Hard rules** (architecture lines 188–191):
    - Module-scope cache is the warm-invocation memory; never persist to disk, IndexedDB, or env vars.
    - Never `console.log` the cached value. Even on error, log the parameter NAME, not the value (`Error(\`SSM parameter ${parameterName} is empty\`)` is fine; `Error(\`fetched ${value}\`)` is not).
    - Never return either secret from any API response body or header. (`AC-9` enforces this.)
  - [x] Add `api/src/secrets/ssm.test.ts`:
    - Vitest `vi.mock('@aws-sdk/client-ssm', ...)` to stub `SSMClient` + `GetParameterCommand`.
    - Assert that a second call to `getJwtKey()` does NOT call `SSMClient#send` again (cache works).
    - Assert that a missing env var throws with a helpful message.
    - Assert that an empty `Parameter.Value` throws.
    - Use `__resetSecretsCacheForTests()` between cases.
  - [x] **Boundary contract:** `api/src/secrets/ssm.ts` is the ONLY SSM access surface (architecture line 1023). Auth code, password code, and JWT code must import from this module — never call `SSMClient` directly.

- [x] **Task 3 — argon2id password verification (uniform timing)** (AC: 3, 4, 9)
  - [x] Add `hash-wasm` (`^4.x`) to `api/package.json` `dependencies`. Rationale: pure-WASM, bundles cleanly through esbuild with the existing `--bundle --format=esm --target=node22 --external:@aws-sdk/*` flags. Native-binding alternatives (`argon2`, `@node-rs/argon2`) require ARM64 prebuilds bundled into the Lambda zip — fragile under the current esbuild config and Lambda layer setup. `hash-wasm` works on ARM64 Lambda with no extra wiring.
  - [x] Verify the standard PHC encoded format compatibility: `hash-wasm`'s `argon2Verify({ password, hash })` accepts the same `$argon2id$v=19$m=...$t=...$p=...$<salt>$<hash>` strings that the bootstrap runbook's `argon2-cli` and `node -e "import('argon2')..."` paths produce. Add an inline comment in `password.ts` citing the format.
  - [x] Create `api/src/auth/password.ts`:
    ```ts
    import { argon2Verify, argon2id } from 'hash-wasm';
    import { getPasswordHash } from '../secrets/ssm.js';

    /**
     * Deterministic dummy hash used when the real hash is missing or malformed.
     * Verification against this hash takes the same wall-clock budget as a real
     * argon2id verify, eliminating the timing oracle described in AC-4. Hash
     * generated once offline against a random throwaway password; the value
     * here is a constant — it does NOT need to match Sandy's password.
     */
    const DUMMY_HASH =
      '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0ZHVtbXlzYQ$cmpsLnQrz0wAFnHs0J3pH1iqA6BTcdyaqxXxk5b1k0w';

    export async function verifyPassword(input: string): Promise<boolean> {
      let stored: string;
      try {
        stored = await getPasswordHash();
      } catch {
        // Run a verify against the dummy so the failure path has the same
        // timing profile as the success path. We still return false.
        await argon2Verify({ password: input, hash: DUMMY_HASH }).catch(() => false);
        return false;
      }
      try {
        return await argon2Verify({ password: input, hash: stored });
      } catch {
        // Malformed stored hash — same uniform-timing rule.
        await argon2Verify({ password: input, hash: DUMMY_HASH }).catch(() => false);
        return false;
      }
    }
    ```
  - [x] Add `api/src/auth/password.test.ts`:
    - Mock `getPasswordHash` to return a hash of `'correct horse battery staple'` (generate the hash inline using `argon2id({ password: 'correct horse battery staple', ... })` in a `beforeAll` to keep the test self-contained — store the generated hash in a `let` and feed it through the mock).
    - Assert `verifyPassword('correct horse battery staple') === true`.
    - Assert `verifyPassword('wrong')` === `false`.
    - Assert that when `getPasswordHash` throws, `verifyPassword` returns `false` AND `argon2Verify` was invoked exactly once (uniform timing — the catch path still runs a verify).
    - Assert that when the stored hash is malformed (`'not-a-hash'`), `verifyPassword` returns `false` and `argon2Verify` runs against the dummy.

- [x] **Task 4 — JWT sign + verify (HS256)** (AC: 3, 5)
  - [x] Use Hono's built-in JWT module (`hono/jwt`) — no separate npm install. It supports HS256 and is bundled with the `hono` package already in `api/package.json` `^4.6.0`.
  - [x] Create `api/src/auth/jwt.ts`:
    ```ts
    import { sign, verify } from 'hono/jwt';
    import { getJwtKey } from '../secrets/ssm.js';

    const ALG = 'HS256';
    const COOKIE_MAX_AGE_SECONDS = 31_536_000; // 365 days, matches Set-Cookie Max-Age

    export interface SessionClaims {
      sub: 'sandy';
      iat: number; // seconds since epoch
      exp: number; // seconds since epoch
    }

    export async function signSession(nowSeconds: number): Promise<string> {
      const key = await getJwtKey();
      const claims: SessionClaims = {
        sub: 'sandy',
        iat: nowSeconds,
        exp: nowSeconds + COOKIE_MAX_AGE_SECONDS,
      };
      return sign(claims, key, ALG);
    }

    export async function verifySession(token: string): Promise<SessionClaims> {
      const key = await getJwtKey();
      // hono/jwt verify throws on bad signature / expired exp / malformed JWT;
      // it returns the decoded payload otherwise. Cast through unknown — the
      // returned shape is validated by the route handlers reading it.
      const payload = (await verify(token, key, ALG)) as unknown as SessionClaims;
      return payload;
    }

    export { COOKIE_MAX_AGE_SECONDS };
    ```
  - [x] Add `api/src/auth/jwt.test.ts`:
    - Mock `getJwtKey` to return a stable test key (`'test-key-' + 'x'.repeat(40)` — must be ≥32 chars for HS256).
    - Assert `signSession(now)` returns a 3-part JWT (`header.payload.signature`).
    - Assert `verifySession(<signed token>)` round-trips the claims, including `sub: 'sandy'` and the correct `exp`.
    - Assert `verifySession('not-a-jwt')` rejects.
    - Assert `verifySession(<token with tampered payload>)` rejects (mutate a character in the payload segment and re-base64).
    - Assert that an expired token (constructed with `exp` in the past) rejects.

- [x] **Task 5 — Hono auth middleware + envelope conventions** (AC: 1, 5)
  - [x] Create `api/src/middleware/auth.ts`:
    ```ts
    import { createMiddleware } from 'hono/factory';
    import { getCookie } from 'hono/cookie';
    import type { ErrorResponse } from '@gigbuddy/shared';
    import { verifySession, type SessionClaims } from '../auth/jwt.js';

    export const SESSION_COOKIE_NAME = 'gigbuddy_session';
    const SKIP_PATHS = new Set(['/api/v1/auth/login', '/api/v1/health']);

    declare module 'hono' {
      interface ContextVariableMap {
        session: SessionClaims;
      }
    }

    function unauthorized(): ErrorResponse {
      return { status: 'error', error: { code: 'UNAUTHORIZED', message: 'authentication required' } };
    }

    export const authMiddleware = createMiddleware(async (c, next) => {
      if (SKIP_PATHS.has(c.req.path)) return next();
      const token = getCookie(c, SESSION_COOKIE_NAME);
      if (!token) return c.json(unauthorized(), 401);
      try {
        const claims = await verifySession(token);
        c.set('session', claims);
        return next();
      } catch {
        return c.json(unauthorized(), 401);
      }
    });
    ```
  - [x] The middleware mounts on `app.use('/api/v1/*', authMiddleware)` in `api/src/app.ts` (Task 7). The `SKIP_PATHS` set is matched against `c.req.path` — exact match, not prefix; `/api/v1/auth/me` would NOT be skipped (and is not a real path; the real path is `/api/v1/me`, which is correctly NOT in the skip set).
  - [x] Add `api/src/middleware/auth.test.ts`:
    - Spin up a small `new Hono().use('/api/v1/*', authMiddleware).get('/api/v1/echo', (c) => c.json({ ok: true, sub: c.get('session').sub }))`.
    - Assert `GET /api/v1/echo` without a cookie → 401 with the envelope shape.
    - Assert `GET /api/v1/echo` with `Cookie: gigbuddy_session=garbage` → 401.
    - Assert `GET /api/v1/echo` with a valid signed JWT (use `signSession` directly with a mocked key) → 200, body includes `sub: 'sandy'`.
    - Assert `GET /api/v1/health` without a cookie → 200 (route mounted alongside skip-path verification; or use a dedicated test stub that mounts `/api/v1/health` and asserts the middleware does not error).
    - Assert `POST /api/v1/auth/login` without a cookie reaches the next handler (mount a stub handler that returns `{ skipped: true }`).

- [x] **Task 6 — Logger middleware with secret redaction** (AC: 9)
  - [x] Create `api/src/middleware/logger.ts`:
    ```ts
    import { createMiddleware } from 'hono/factory';

    const REDACT_KEYS = new Set([
      'password',
      'cookie',
      'authorization',
      'set-cookie',
      'gigbuddy_session',
    ]);

    function redact(input: Record<string, unknown>): Record<string, unknown> {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
      }
      return out;
    }

    export const loggerMiddleware = createMiddleware(async (c, next) => {
      const start = Date.now();
      await next();
      const line = {
        level: 'info',
        msg: 'request',
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - start,
        headers: redact(Object.fromEntries(c.req.raw.headers.entries())),
      };
      console.log(JSON.stringify(line));
    });
    ```
  - [x] Add `api/src/middleware/logger.test.ts`:
    - Spy on `console.log` and assert the emitted line is a JSON string with `path`, `status`, `durationMs` keys.
    - Assert that an inbound `Cookie: gigbuddy_session=secret` header is redacted to `'[REDACTED]'` in the logged headers object.
    - Assert that case-insensitive matching works: `Authorization`, `authorization`, `AUTHORIZATION` all redact.
  - [x] **Scope note:** request-body logging is NOT added in this story (logger only emits headers + method + path + status). Password lands in the request body of `/api/v1/auth/login`; not logging the body avoids exposing it. The architecture's logger description (lines 757–761) says "never log password, JWT key, cookie value, full record payloads (just IDs)" — this story implements "no body logging" as the simplest path to compliance. A later story (2.3 — `/api/v1/client-errors` + structured error logger) can extend the logger with selective body logging behind redaction.

- [x] **Task 7 — Auth routes (`/login`, `/me`) + app composition** (AC: 3, 4, 6)
  - [x] Create `api/src/routes/auth.ts`:
    ```ts
    import { Hono } from 'hono';
    import { setCookie } from 'hono/cookie';
    import {
      LoginRequestSchema,
      type ErrorResponse,
    } from '@gigbuddy/shared';
    import { verifyPassword } from '../auth/password.js';
    import { signSession, COOKIE_MAX_AGE_SECONDS } from '../auth/jwt.js';
    import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

    const badRequest: ErrorResponse = {
      status: 'error',
      error: { code: 'VALIDATION_FAILED', message: 'password is required' },
    };
    const invalidCredentials: ErrorResponse = {
      status: 'error',
      error: { code: 'INVALID_CREDENTIALS', message: 'wrong password' },
    };

    /** Constant-time-equivalent dummy run when the body is malformed (AC-4). */
    async function uniformReject(): Promise<void> {
      await verifyPassword('—malformed-body—');
    }

    export const authRoute = new Hono().post('/login', async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        await uniformReject();
        return c.json(badRequest, 400);
      }
      const parsed = LoginRequestSchema.safeParse(body);
      if (!parsed.success) {
        await uniformReject();
        return c.json(badRequest, 400);
      }
      const ok = await verifyPassword(parsed.data.password);
      if (!ok) return c.json(invalidCredentials, 401);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = await signSession(nowSeconds);
      setCookie(c, SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: COOKIE_MAX_AGE_SECONDS,
        path: '/',
      });
      return c.json({ status: 'applied' as const });
    });
    ```
  - [x] Create `api/src/routes/me.ts`:
    ```ts
    import { Hono } from 'hono';
    import type { ContextVariableMap } from 'hono';

    export const meRoute = new Hono<{ Variables: ContextVariableMap }>().get('/', (c) => {
      const session = c.get('session');
      const nowSeconds = Math.floor(Date.now() / 1000);
      const daysUntilExpiry = Math.max(0, Math.floor((session.exp - nowSeconds) / 86_400));
      return c.json({
        status: 'ok' as const,
        data: { authenticated: true as const, daysUntilExpiry },
      });
    });
    ```
  - [x] Update `api/src/app.ts` (current contents: one-liner mounting `/api/v1/health`):
    ```ts
    import { Hono } from 'hono';
    import { authMiddleware } from './middleware/auth.js';
    import { loggerMiddleware } from './middleware/logger.js';
    import { authRoute } from './routes/auth.js';
    import { healthRoute } from './routes/health.js';
    import { meRoute } from './routes/me.js';

    export const app = new Hono()
      .use('*', loggerMiddleware)
      .use('/api/v1/*', authMiddleware)
      .route('/api/v1/health', healthRoute)
      .route('/api/v1/auth', authRoute)
      .route('/api/v1/me', meRoute);
    ```
    - Logger mounts first (`*`) so every request is logged, including health checks.
    - Auth middleware mounts on `/api/v1/*` and internally skips `/api/v1/health` and `/api/v1/auth/login`. Mounting at the `app.use` level (not per-route) ensures every existing or future `/api/v1/*` route is auto-protected unless added to `SKIP_PATHS`.
  - [x] Add `api/src/routes/auth.test.ts`:
    - Mock `getPasswordHash` (via `vi.mock('../secrets/ssm.js')`) to return a hash of `'right-password'`.
    - Mock `getJwtKey` to return `'test-key-' + 'x'.repeat(40)`.
    - `POST /api/v1/auth/login` with `{password:'right-password'}` → 200, body `{status:'applied'}`, response has a `Set-Cookie` header with `gigbuddy_session=`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=31536000`, `Path=/`.
    - `POST /api/v1/auth/login` with `{password:'wrong'}` → 401, body `{status:'error', error:{code:'INVALID_CREDENTIALS'}}`, NO `Set-Cookie` header.
    - `POST /api/v1/auth/login` with `{}` → 400, code `VALIDATION_FAILED`.
    - `POST /api/v1/auth/login` with non-JSON body → 400, code `VALIDATION_FAILED`.
    - **Timing-uniformity sanity check:** spy on `verifyPassword` (or `argon2Verify` via the spy on `hash-wasm`) and assert it is called exactly once on each of the four cases above. (A true clock-based timing assertion is too flaky for CI; the call-count assertion is the testable invariant.)
  - [x] Add `api/src/routes/me.test.ts`:
    - Mount the full `app` (so the auth middleware runs).
    - `GET /api/v1/me` without a cookie → 401.
    - `GET /api/v1/me` with a valid signed cookie (sign a JWT with a mocked key, set it on the request via `Cookie:` header) → 200, body matches `MeResponseSchema`, `daysUntilExpiry` ≈ 365 (within ±1 day).
    - `GET /api/v1/me` with an expired cookie → 401.

- [x] **Task 8 — Update `handler.test.ts` with a 401 negative case** (AC: 1, resolves deferred-work entry #6 from Story 1.3 review)
  - [x] Extend `api/src/handler.test.ts` (do NOT replace; add a second `it` block):
    - Build a synthetic Lambda Function URL event for `GET /api/v1/me` with no `Cookie` header.
    - Mock `getJwtKey` / `getPasswordHash` to return stable test values (use the same `vi.mock` pattern as `auth.test.ts`).
    - Assert the handler returns `statusCode: 401` and a JSON body matching `{status:'error', error:{code:'UNAUTHORIZED'}}`.
    - This satisfies the deferred-work item logged from Story 1.3 review.

- [x] **Task 9 — Web auth context, fetch wrappers, and bootstrap** (AC: 2, 6, 7)
  - [x] Create `web/src/auth/auth-context.tsx`:
    ```tsx
    import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

    export type AuthState =
      | { status: 'unknown' }
      | { status: 'unauthenticated' }
      | { status: 'authenticated'; daysUntilExpiry: number };

    interface AuthContextValue {
      auth: AuthState;
      setAuth: (next: AuthState) => void;
    }

    const AuthContext = createContext<AuthContextValue | null>(null);

    export function AuthProvider({
      initial,
      children,
    }: {
      initial: AuthState;
      children: ReactNode;
    }) {
      const [auth, setAuth] = useState<AuthState>(initial);
      const value = useMemo(() => ({ auth, setAuth }), [auth]);
      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    }

    export function useAuth(): AuthContextValue {
      const ctx = useContext(AuthContext);
      if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
      return ctx;
    }
    ```
  - [x] Create `web/src/auth/auth-api.ts`:
    ```ts
    import { MeResponseSchema, LoginAppliedResponseSchema } from '@gigbuddy/shared';
    import type { AuthState } from './auth-context.js';

    /**
     * Calls GET /api/v1/me. Distinguishes:
     *   - HTTP 200 → 'authenticated' (with daysUntilExpiry from the validated response)
     *   - HTTP 401 from a successful network round-trip → 'unauthenticated'
     *   - Network failure (fetch rejects) → 'unknown'  (AR-16)
     */
    export async function fetchMe(): Promise<AuthState> {
      let res: Response;
      try {
        res = await fetch('/api/v1/me', { credentials: 'same-origin' });
      } catch {
        return { status: 'unknown' };
      }
      if (res.status === 401) return { status: 'unauthenticated' };
      if (res.status === 200) {
        const body = MeResponseSchema.parse(await res.json());
        return { status: 'authenticated', daysUntilExpiry: body.data.daysUntilExpiry };
      }
      // 5xx or unexpected — treat as unknown so the SPA still renders the shell.
      return { status: 'unknown' };
    }

    /** Returns true on accepted login, false on wrong password, throws on network failure. */
    export async function login(password: string): Promise<boolean> {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      });
      if (res.status === 200) {
        LoginAppliedResponseSchema.parse(await res.json());
        return true;
      }
      if (res.status === 401) return false;
      throw new Error(`Unexpected login status ${res.status}`);
    }
    ```
  - [x] Create `web/src/auth/redirect-on-401.ts` — the architecture seam for AC-7:
    ```ts
    /**
     * Encapsulates the "should we redirect to /login on a 401" decision.
     * In Story 1.4 the call sites pass performanceActive=false. Story 1.5
     * introduces PerformanceModeContext and Story 4.1 sets the flag true;
     * neither needs to modify this file — they pass the live value here.
     */
    export function shouldRedirectOn401(args: {
      performanceActive: boolean;
      wasNetworkSuccess: boolean;
    }): boolean {
      if (!args.wasNetworkSuccess) return false; // offline-cache 401 must not redirect
      if (args.performanceActive) return false;  // AR-28 invariant
      return true;
    }

    /** Placeholder hook until Story 1.5 introduces PerformanceModeContext. */
    export function usePerformanceActive(): boolean {
      return false;
    }
    ```
  - [x] Add `web/src/auth/auth-api.test.ts`:
    - Use `vi.stubGlobal('fetch', vi.fn())` to control the network response.
    - Cover: 200 with valid body, 200 with invalid body (throws via Zod), 401, fetch rejects (returns `{status:'unknown'}`), 500 (returns `{status:'unknown'}`).
    - Cover `login`: 200 → `true`, 401 → `false`, 500 → throws.
  - [x] Add `web/src/auth/redirect-on-401.test.ts`:
    - Truth table over `performanceActive × wasNetworkSuccess`.

- [x] **Task 10 — App bootstrap + router + login route + minimal authenticated shell** (AC: 2, 6, 8)
  - [x] Create `web/src/app-bootstrap.tsx`:
    ```tsx
    import { useEffect, useState } from 'react';
    import { RouterProvider } from 'react-router';
    import { AuthProvider, type AuthState } from './auth/auth-context.js';
    import { fetchMe } from './auth/auth-api.js';
    import { router } from './router.js';

    /**
     * The architectural app-boot sequence (architecture.md "Auth flow"
     * canonical sequence, lines 692–702):
     *   1. Render shell (no data) immediately.
     *   2. Probe /api/v1/me.
     *   3. Resolve to authenticated | unauthenticated | unknown.
     *   4. The router decides where to land based on the resolved state.
     */
    export function AppBootstrap() {
      const [initial, setInitial] = useState<AuthState>({ status: 'unknown' });
      const [ready, setReady] = useState(false);

      useEffect(() => {
        let cancelled = false;
        fetchMe().then((state) => {
          if (cancelled) return;
          setInitial(state);
          setReady(true);
        });
        return () => {
          cancelled = true;
        };
      }, []);

      if (!ready) {
        // App shell: brand mark only, no data. Matches the architecture's
        // "render shell, no data" step.
        return <h1>GigBuddy</h1>;
      }

      return (
        <AuthProvider initial={initial}>
          <RouterProvider router={router} />
        </AuthProvider>
      );
    }
    ```
  - [x] Create `web/src/routes/login.tsx`:
    ```tsx
    import { type FormEvent, useState } from 'react';
    import { useNavigate } from 'react-router';
    import { login } from '../auth/auth-api.js';
    import { useAuth } from '../auth/auth-context.js';
    import { fetchMe } from '../auth/auth-api.js';

    export function Login() {
      const [password, setPassword] = useState('');
      const [submitting, setSubmitting] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const { setAuth } = useAuth();
      const navigate = useNavigate();

      async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
          const ok = await login(password);
          if (!ok) {
            setError('Wrong password.');
            setSubmitting(false);
            return;
          }
          // Cookie is set server-side. Re-probe /me to fill AuthContext
          // with the freshly-issued daysUntilExpiry value.
          const next = await fetchMe();
          setAuth(next);
          navigate('/');
        } catch {
          setError('Service unavailable.');
          setSubmitting(false);
        }
      }

      return (
        <main>
          <h1>GigBuddy</h1>
          <form onSubmit={onSubmit} noValidate>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <button type="submit" disabled={submitting || password.length === 0}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            {error && (
              <p role="alert" aria-live="polite">
                {error}
              </p>
            )}
          </form>
        </main>
      );
    }
    ```
    - **Microcopy:** error strings are `Wrong password.` and `Service unavailable.` — complete sentences with periods, no exclamation marks, no encouragement language (EXPERIENCE.md voice rules; CLAUDE.md authoritative-documents note).
    - **Atmosphere:** the login screen renders under the boot atmosphere (Practice on MacBook, Performance on iPhone — set by `applyBootAtmosphere()` already running in `main.tsx`). The form uses unstyled native controls in 1.4 — Tailwind utility classes go in a polish pass in Story 1.5 or a later UX story. **Do not** create a separate `auth.css` token file.
  - [x] Create `web/src/components/reauth-banner.tsx`:
    ```tsx
    import { useState } from 'react';
    import { isIPhone } from '../lib/platform.js';
    import { useAuth } from '../auth/auth-context.js';

    const SHOW_THRESHOLD_DAYS = 30;

    export function ReauthBanner() {
      const { auth } = useAuth();
      const [dismissed, setDismissed] = useState(false);

      if (auth.status !== 'authenticated') return null;
      if (isIPhone()) return null;
      if (auth.daysUntilExpiry > SHOW_THRESHOLD_DAYS) return null;
      if (dismissed) return null;

      return (
        <div role="status" aria-live="polite">
          <span>Re-authenticate within {auth.daysUntilExpiry} days.</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss re-authentication reminder"
          >
            Dismiss
          </button>
        </div>
      );
    }
    ```
  - [x] Create `web/src/routes/authenticated-shell.tsx`:
    ```tsx
    import { Outlet } from 'react-router';
    import { ReauthBanner } from '../components/reauth-banner.js';

    /**
     * Minimal authenticated shell. Story 1.5 replaces the body with the full
     * nav chrome scaffold (top nav + bottom tab bar + Setlists/Library
     * routes). For 1.4 the shell renders just the banner + the route Outlet
     * so the auth flow can be tested end-to-end against the placeholder.
     */
    export function AuthenticatedShell() {
      return (
        <>
          <ReauthBanner />
          <Outlet />
        </>
      );
    }
    ```
  - [x] Update `web/src/router.tsx`:
    ```tsx
    import { createBrowserRouter, Navigate } from 'react-router';
    import { useAuth } from './auth/auth-context.js';
    import { AuthenticatedShell } from './routes/authenticated-shell.js';
    import { Login } from './routes/login.js';
    import { Placeholder } from './routes/placeholder.js';

    function RequireAuth({ children }: { children: React.ReactNode }) {
      const { auth } = useAuth();
      if (auth.status === 'unauthenticated') return <Navigate to="/login" replace />;
      // 'unknown' falls through and renders the shell — offline behavior per AR-16.
      return <>{children}</>;
    }

    export const router = createBrowserRouter([
      { path: '/login', element: <Login /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AuthenticatedShell />
          </RequireAuth>
        ),
        children: [{ index: true, element: <Placeholder /> }],
      },
    ]);
    ```
    - The existing `Placeholder` route stays mounted as the index child so `/` continues to render `<h1>GigBuddy</h1>` after sign-in — Story 1.5 swaps this for the Setlists home.
  - [x] Update `web/src/main.tsx` to render `<AppBootstrap />` inside the existing `QueryClientProvider`:
    ```tsx
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import { AppBootstrap } from './app-bootstrap.js';
    import { applyBootAtmosphere } from './lib/atmosphere.js';
    import './styles/globals.css';

    applyBootAtmosphere();

    const queryClient = new QueryClient();

    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error('Root element #root not found');

    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <AppBootstrap />
        </QueryClientProvider>
      </StrictMode>,
    );
    ```
    - `AppBootstrap` mounts the `RouterProvider` after `/me` resolves. The existing `applyBootAtmosphere()` call stays at top level so the atmosphere is set before React mounts.
  - [x] Add tests:
    - `web/src/routes/login.test.tsx`: render `<Login>` inside `<MemoryRouter>` + `<AuthProvider initial={{status:'unauthenticated'}}>`; stub `fetch`; assert that submit with the right password navigates and updates auth, submit with a wrong password renders `Wrong password.`, submit while offline (fetch rejects) renders `Service unavailable.`. Use `@testing-library/react` `userEvent` for typing and clicking.
    - `web/src/components/reauth-banner.test.tsx`: assert banner shows at `daysUntilExpiry=30`, shows at `daysUntilExpiry=1`, hides at `daysUntilExpiry=31`, hides on `isIPhone()=true` (mock `platform.ts`), hides after dismiss click. Use `vi.mock('../lib/platform.js')`.
    - `web/src/app-bootstrap.test.tsx`: render `<AppBootstrap>`, stub `fetch` to return each of (200 + valid body, 401, network failure), assert the shell mounts and the resolved `AuthState` is correct (assert by introspecting a small test-only consumer rendered under the provider, OR by asserting that the rendered DOM contains/doesn't contain the login route).
    - `web/src/router.test.tsx`: do NOT write a new comprehensive router test — the login + bootstrap tests above cover the routing logic. (Avoids over-testing React Router internals.)

- [x] **Task 11 — Update Hono adapter handler import path verification** (AC: all)
  - [x] No code change expected here — `api/src/handler.ts` already does `import { handle } from 'hono/aws-lambda'` (Story 1.3). Re-verify the path resolves under the current Hono version after Task 1's shared-package update. If a typecheck or test failure surfaces, document and fix per the Story 1.3 pattern. (Hono 4.6+ ships this export; the version in `api/package.json` is `^4.6.0`.)

- [x] **Task 12 — Bootstrap runbook addendum** (AC: 9)
  - [x] Append a "Section 8 — Verify the access gate" block to `infra/runbooks/bootstrap.md` after the existing "Section 7 — OIDC hand-off":
    ```markdown
    ## 8. Verify the access gate (after Story 1.4 ships)

    Once the new code is deployed, run these smoke checks against `gig.cormie.com`:

        # Unauthenticated read of a protected route → 401 envelope
        curl -i https://gig.cormie.com/api/v1/me
        # expect: HTTP/2 401, body {"status":"error","error":{"code":"UNAUTHORIZED",...}}
        #         no Set-Cookie header

        # Login with the wrong password → 401, no cookie
        curl -i -X POST https://gig.cormie.com/api/v1/auth/login \
          -H 'content-type: application/json' \
          -d '{"password":"obviously-wrong"}'
        # expect: HTTP/2 401, body {"status":"error","error":{"code":"INVALID_CREDENTIALS",...}}

        # Login with the right password → 200, Set-Cookie present
        curl -i -X POST https://gig.cormie.com/api/v1/auth/login \
          -H 'content-type: application/json' \
          -d "{\"password\":\"$REAL_PASSWORD\"}" \
          -c /tmp/gigbuddy-cookie.txt
        # expect: HTTP/2 200, body {"status":"applied"}
        #         Set-Cookie: gigbuddy_session=...; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000; Path=/

        # Use the cookie to read /me → 200
        curl -i https://gig.cormie.com/api/v1/me -b /tmp/gigbuddy-cookie.txt
        # expect: HTTP/2 200, body {"status":"ok","data":{"authenticated":true,"daysUntilExpiry":365}}

        # Clean up the temp cookie file
        rm /tmp/gigbuddy-cookie.txt

    If any of these fail, check the CloudWatch log group `/aws/lambda/gigbuddy-api`
    for a stack trace, and verify both SSM parameters exist with
    `aws ssm get-parameters --names /gigbuddy/jwt-key /gigbuddy/password-hash
    --with-decryption --region eu-west-2 --query 'Parameters[].Name'`
    (lists names only — never echo `Values` in shell history).
    ```
  - [x] **Do not add SSM rotation runbooks** here — `rotate-jwt-key.md` and `rotate-password.md` are listed in the architecture's `infra/runbooks/` tree but explicitly deferred to Story 5.2 (architecture line 985–987 + Story 1.3 anti-scope-creep note line 360). Leave the cross-reference comment in bootstrap.md only.

- [x] **Task 13 — Verification pass** (AC: 1–9)
  - [x] `pnpm typecheck` green across all packages.
  - [x] `pnpm lint` green (Biome).
  - [x] `pnpm test` green — new vitest specs in `api/` and `web/` plus the existing infra specs all pass.
  - [x] `pnpm -F api run build` produces a clean `dist/handler.js` with no missing-extern warnings for `@aws-sdk/client-ssm` (it must be marked external; CDK's Lambda runtime supplies it).
  - [x] **Manual smoke (after `cdk deploy GigbuddyApi` re-runs to ship the new Lambda code):** execute the curl block from Task 12 against `gig.cormie.com`. Capture the four `curl -i` headers/bodies in the Dev Agent Record. Deferred to Sandy if his AWS credentials are required; document the exact commands and expected outputs in the runbook so the smoke check is reproducible.
  - [x] **Browser smoke (manual):** load `https://gig.cormie.com/` in Safari and Chrome on MacBook; confirm the SPA reaches `/login`, accepts the password, redirects to `/`, and persists the session across page reloads (cookie survives). Confirm the iPhone PWA path: open the same URL on iPhone, sign in once, force-quit Safari, reopen the URL — the cookie should still be valid and the SPA should land on `/` without a `/login` round-trip. Capture observations in the Dev Agent Record.

### Review Findings

- [x] [Review][Patch] `fetchMe()` Zod parse on malformed 200 body propagates unhandled — AppBootstrap `.then()` has no `.catch()`, causing permanent loading screen [`web/src/auth/auth-api.ts:18-21`, `web/src/app-bootstrap.tsx:22-25`]
- [x] [Review][Patch] AC-7 seam dead — `shouldRedirectOn401` / `usePerformanceActive` never called; `RequireAuth` redirects unconditionally without `performanceActive` gate [`web/src/router.tsx:9-11`, `web/src/auth/redirect-on-401.ts`]
- [x] [Review][Patch] Post-login `fetchMe()` result not guarded — `navigate('/')` fires unconditionally even when re-probe returns `unauthenticated` or `unknown` [`web/src/routes/login.tsx:26-29`]
- [x] [Review][Defer] JWT key has no minimum-length runtime enforcement — a misconfigured short SSM value would produce a weak HS256 signature [`api/src/auth/jwt.ts`] — deferred, operational/runbook concern not a code defect
- [x] [Review][Defer] `daysUntilExpiry === 0` renders "Re-authenticate within 0 days." — `Math.max(0,…)` in `me.ts` means 0 is reachable; grammar is wrong and misleading [`web/src/components/reauth-banner.tsx:22-23`] — deferred, UX polish
- [x] [Review][Defer] `handler.test.ts` `getPasswordHashMock` not initialized in `beforeEach` — future test that exercises login through the handler will find it returning `undefined` [`api/src/handler.test.ts`] — deferred, test fragility not production concern
- [x] [Review][Defer] `app-bootstrap.test.tsx` authenticated-shell assertion is inconclusive — cannot distinguish loading `<h1>GigBuddy</h1>` from the authenticated shell rendering the same heading [`web/src/app-bootstrap.test.tsx`] — deferred, test adequacy
- [x] [Review][Defer] No redirect from `/login` when already authenticated — authenticated user navigating to `/login` sees the form with no feedback [`web/src/router.tsx:15`] — deferred, not in story scope
- [x] [Review][Defer] `uniformReject()` not constant-time on cold SSM cache — first Lambda invocation's malformed-body path incurs SSM latency; warm paths do not [`api/src/routes/auth.ts:19-21`] — deferred, first-cold-start-only edge case

## Dev Notes

### Architecture compliance (the contract you must follow)

**Source of truth:** `_bmad-output/planning-artifacts/architecture.md`. Deviations require updating that document, not the code. This story implements Decision 1 (Access Gate — architecture lines 172–193) end-to-end, including the canonical Auth Flow (lines 692–716).

**Hard rules from the architecture (all enforced by AC-9 + Tasks 2–6):**
- JWT signing key fetched from SSM at cold-start; cached in **module-scope memory** only; never in env vars; never logged; never returned in responses (lines 188–191).
- Same handling rules apply to the SSM-stored password hash.
- Manual rotation = write a new SSM value, redeploy; all sessions invalidate; Sandy re-logs in. No rotation endpoint, no session table. Documented in bootstrap.md only.

**Cookie attributes — exact** (architecture lines 710–716, restated in AC-3):
- `HttpOnly: true`, `Secure: true`, `SameSite: Strict`, `Max-Age: 31536000`, `Path: /`
- Value is a signed HS256 JWT with claims `{sub:'sandy', iat, exp}` where `exp = iat + 31_536_000`.

**Skip-path policy:**
- `/api/v1/auth/login` — must NOT be auth-gated (login is how you get the cookie).
- `/api/v1/health` — must NOT be auth-gated (deploy-pipeline smoke check + CloudFront origin-up probe; per Story 1.3 AC-6 it returns 200 unauthenticated).
- Every other `/api/v1/*` path is gated. The middleware uses an exact-match `Set` keyed by `c.req.path`, not a prefix match — this is intentional so a future route like `/api/v1/auth/rotate` (V2) is gated by default unless explicitly added to the skip set.

**Boundaries (architecture lines 1019–1027, CLAUDE.md §Boundaries):**
- `api/src/secrets/ssm.ts` is the ONLY SSM access surface. Auth + password + JWT modules import from here. (Task 2 enforces.)
- `api/src/ddb/*` is the ONLY DDB import surface — Story 1.4 does NOT touch DDB (auth is not persisted; sessions live entirely in the signed JWT cookie). Do not import `@aws-sdk/client-dynamodb` in this story.
- `web` ↔ `api`: HTTP only via `/api/v1/*`. `web` imports types + Zod schemas from `@gigbuddy/shared` only.
- Logger middleware redacts known secret param names (Task 6).

### Library and framework requirements (do NOT substitute)

- **Hono 4.6+** — already in `api/package.json`. Use `hono/jwt` (built-in, supports HS256) and `hono/cookie` (built-in). Do NOT add `jsonwebtoken`, `jose`, or `cookie-parser`.
- **`hash-wasm` (^4.x)** for argon2id verify. Reasoning (under "Latest tech information" below). Do NOT use `argon2` or `@node-rs/argon2` — both require ARM64 prebuilt native binaries that complicate the esbuild + Lambda layer setup. `hash-wasm` is pure-WASM and bundles cleanly.
- **`@aws-sdk/client-ssm` (^3.x)** — kept external by esbuild (`--external:@aws-sdk/*`, see `api/package.json` `build` script). Resolves from the Lambda runtime layer. No bundle bloat.
- **React 19 + React Router 7 (`react-router`)** — already in `web/package.json`. Import from `react-router`, never `react-router-dom` (CLAUDE.md).
- **TanStack Query v5** — already wired in `main.tsx`. The auth probe in Task 9 uses plain `fetch` directly (NOT a `useQuery` call) because the result must be available BEFORE the router mounts. TanStack Query is for ongoing server state from inside the React tree; the boot probe is a one-shot side effect.
- **TypeScript strict everywhere** (CLAUDE.md). `infra/tsconfig.json` relaxes `exactOptionalPropertyTypes` (Story 1.3 deviation 1) — that exemption does NOT extend to `api/`, `web/`, or `shared/`.
- **Zod schemas in `shared/` are the single source of truth** (CLAUDE.md). Do not define a parallel `interface AuthState` or `type LoginRequest` in the API or web code — infer from the Zod schema.
- **Biome** is the only lint+format tool. Run `pnpm lint:fix` after authoring new files.

### What this story does NOT include (anti-scope-creep)

These appear nearby in the architecture or epic, but are owned by later stories. **Do not scaffold:**

- `web/src/performance/performance-context.tsx` and the `usePerformanceActive` hook with real state — **Story 1.5** creates the context, **Story 4.1** sets it true. Task 9 lands a stub `usePerformanceActive()` that returns `false` and a `shouldRedirectOn401` decision function that takes the flag as a parameter. The Story 1.5 / Epic 4 wiring will swap the stub for the real context import — no other code in this auth module needs to change.
- Top nav, bottom tab bar, Setlists / Library routes, `currently-performing-strip` — **Story 1.5**. Task 10's `AuthenticatedShell` is intentionally minimal (banner + `<Outlet />`); Story 1.5 replaces the shell body.
- Service worker (`/api/v1/me` NetworkOnly, `/api/v1/auth/*` NetworkOnly per AR-26) — **Story 2.1**. In Story 1.4 there is no SW; all `/me` and `/login` calls go straight to the network, which is what the AC-2 / AR-16 distinction relies on. The SW will preserve this behavior when it lands.
- DDB-backed routes (`/api/v1/songs`, `/api/v1/setlists`, etc.) — **Stories 2.3 / 3.1**. The auth middleware mounted at `/api/v1/*` will protect those routes for free when they ship — no further auth wiring needed in those stories.
- `/api/v1/client-errors` endpoint — **Story 2.3**. The logger redaction in Task 6 covers headers only; selective body-logging with redaction is the appropriate extension when client-errors lands.
- `infra/runbooks/rotate-jwt-key.md` and `infra/runbooks/rotate-password.md` — **Story 5.2** (operational runbook bundle alongside the verified-restore drill).
- SSM parameter creation in CDK — explicitly out per Story 1.3 Task 3 (and Sandy's `bootstrap.md` seeds them by CLI). Story 1.4 only **reads** them.
- E2E Playwright auth spec — listed in the architecture's `e2e/smoke/auth.spec.ts` (line 994). That comes in the Epic 1 retrospective or Story 2.x once an authenticated baseline exists. In-tree Vitest coverage in this story is sufficient acceptance.

If you find yourself wanting to scaffold any of the above, **don't**. The respective stories carry the ACs that will land them correctly.

### Previous story intelligence (1.3 + 1.1/1.2 learnings)

From **Story 1.3** (commit `26ddf8b`):
- `api/src/handler.ts` exists and exports `handle(app)` for the Lambda Function URL adapter. `app.ts` is the Hono composition root — Task 7 extends it, do NOT replace the structure.
- `api/src/routes/health.ts` is the working pattern for Hono sub-routes (`new Hono().get('/', ...)` mounted via `app.route('/api/v1/health', healthRoute)`). Follow the same shape for `authRoute` and `meRoute`.
- The api-stack passes `TABLE_NAME`, `JWT_KEY_PARAM=/gigbuddy/jwt-key`, `PASSWORD_HASH_PARAM=/gigbuddy/password-hash` as Lambda env vars (Story 1.3 Task 3). Task 2's `ssm.ts` reads these by name — never construct the parameter ARN in the runtime (architecture boundary).
- The Lambda role already has IAM permissions for `ssm:GetParameter` on `/gigbuddy/*` and `kms:Decrypt` scoped by `kms:ViaService = ssm.eu-west-2.amazonaws.com`. No infra change needed in this story.
- The Lambda function has `reservedConcurrentExecutions: 50` and a 10s timeout. Cold-start SSM fetch + argon2id verify fits well inside that budget (argon2id with `t=3, m=64MB` ≈ 50–150ms on Lambda ARM64).
- A negative-case test on `/api/v1/me` is **deferred-work item #6 from Story 1.3 review** — Task 8 explicitly resolves it. Update `_bmad-output/implementation-artifacts/deferred-work.md` to mark "handler.test.ts missing negative test coverage" as resolved when Task 8 lands.
- The bootstrap runbook (`infra/runbooks/bootstrap.md`) already seeds `/gigbuddy/jwt-key` and `/gigbuddy/password-hash` via `aws ssm put-parameter`. Task 12 appends a verification section but does NOT change the seeding instructions.
- `pnpm test` filters out `e2e/`; Vitest specs in `api/`, `web/`, `shared/`, and `infra/` all run. Co-locate `*.test.ts(x)` next to source.

From **Story 1.1 + 1.2** (commit `d5dcbab`):
- `pnpm dev:web` is on port `5273` (not 5173); `pnpm dev:api` on port `3100` (not 3000). Use these in any manual smoke documentation.
- Biome 2.4.16 enforces formatting + lint. New files in `api/src/` and `web/src/` get auto-formatted by `pnpm lint:fix`.
- No project references / no `composite: true`. Cross-package types via the workspace symlink + `"main"`/`"types"` pointing at `./src/index.ts` in `shared/package.json` — this is why Tasks 1 and 9 import directly from `@gigbuddy/shared` without a build step.
- `web/src/lib/platform.ts` exports `isIPhone()`; reuse it in `reauth-banner.tsx` (Task 10) — do NOT reimplement UA detection.
- `web/src/lib/atmosphere.ts` applies the boot atmosphere at top-level; Story 1.4's `main.tsx` change preserves the call. No atmosphere logic in auth code.

### Implementation patterns reused from architecture

- **API response envelopes** (architecture lines 496–520):
  - Success: `{status:'ok', data:...}` — used by `/api/v1/me`.
  - Applied write: `{status:'applied'}` — used by `/api/v1/auth/login` success (no `data` payload — the cookie is the result).
  - Error: `{status:'error', error:{code, message}}` — used by all 401 / 400 paths.
  - The existing `shared/src/schemas/api.ts` helpers (`OkResponseSchema`, `ErrorResponseSchema`, `AppliedResponseSchema`) are the source of truth — reuse them in `shared/src/schemas/auth.ts` (Task 1) and in error helpers inside `api/`.
- **Header `x-server-now`** (architecture line 520) is wired up by the `server-now` middleware — that middleware is **Story 2.3's** scope (it's part of the LWW infrastructure). Do not add it in this story; auth responses can omit `x-server-now` until Story 2.3.
- **Naming conventions** (architecture lines 473–495):
  - Files: kebab-case (`auth-context.tsx`, `redirect-on-401.ts`, `reauth-banner.tsx`).
  - Identifiers: `camelCase` (functions/vars), `PascalCase` (components/types/schemas), `SCREAMING_SNAKE_CASE` (module constants like `SESSION_COOKIE_NAME`, `COOKIE_MAX_AGE_SECONDS`).
  - JSON keys over the wire: `camelCase` (`daysUntilExpiry`, NOT `days_until_expiry`).
  - API routes: plural noun where applicable — `/api/v1/auth/login`, `/api/v1/me` (verbs are fine here, this is the canonical naming in the architecture).

### Latest tech information (versions verified at story-write time)

- **`hash-wasm` 4.x** — the pure-WASM argon2id implementation; works on Node 22 + Lambda ARM64 with no native binaries. API surface: `argon2id({password, salt, parallelism, iterations, memorySize, hashLength, outputType: 'encoded'})` and `argon2Verify({password, hash})`. The encoded output is the standard PHC string `$argon2id$v=19$m=...$t=...$p=...$<base64-salt>$<base64-hash>`, which matches what the `argon2-cli` and `node argon2` paths in the bootstrap runbook produce. The verify function accepts the same format.
- **`hono/jwt`** is built into the `hono` package (4.6+) and exports `sign(payload, secret, alg)`, `verify(token, secret, alg)`, and `decode(token)`. HS256 is supported via the `'HS256'` algorithm string. The implementation uses WebCrypto (`globalThis.crypto.subtle`), which is available on Node 22 (the Lambda runtime).
- **`hono/cookie`** exports `setCookie(c, name, value, options)`, `getCookie(c, name)`, `deleteCookie(c, name)`. Options match the Set-Cookie attribute names: `httpOnly`, `secure`, `sameSite: 'Strict' | 'Lax' | 'None'`, `maxAge: <seconds>`, `path`, `domain`.
- **`@aws-sdk/client-ssm` 3.x** — `GetParameterCommand` with `WithDecryption: true` returns the SecureString value. Lambda role permission `ssm:GetParameter` + `kms:Decrypt` (already granted by Story 1.3 api-stack) is sufficient. The SDK is pre-installed in the AWS Lambda Node 22 runtime — combined with the esbuild `--external:@aws-sdk/*` flag, no extra bundle weight.

### Files this story creates

- `shared/src/schemas/auth.ts`
- `shared/src/schemas/auth.test.ts`
- `api/src/secrets/ssm.ts`
- `api/src/secrets/ssm.test.ts`
- `api/src/auth/password.ts`
- `api/src/auth/password.test.ts`
- `api/src/auth/jwt.ts`
- `api/src/auth/jwt.test.ts`
- `api/src/middleware/auth.ts`
- `api/src/middleware/auth.test.ts`
- `api/src/middleware/logger.ts`
- `api/src/middleware/logger.test.ts`
- `api/src/routes/auth.ts`
- `api/src/routes/auth.test.ts`
- `api/src/routes/me.ts`
- `api/src/routes/me.test.ts`
- `web/src/auth/auth-context.tsx`
- `web/src/auth/auth-api.ts`
- `web/src/auth/auth-api.test.ts`
- `web/src/auth/redirect-on-401.ts`
- `web/src/auth/redirect-on-401.test.ts`
- `web/src/app-bootstrap.tsx`
- `web/src/app-bootstrap.test.tsx`
- `web/src/routes/login.tsx`
- `web/src/routes/login.test.tsx`
- `web/src/routes/authenticated-shell.tsx`
- `web/src/components/reauth-banner.tsx`
- `web/src/components/reauth-banner.test.tsx`

### Files this story modifies

- `shared/src/index.ts` — add `export * from './schemas/auth.js';`
- `api/src/app.ts` — extend the Hono composition with logger + auth middleware and the new routes (Task 7)
- `api/src/handler.test.ts` — append the 401-on-`/api/v1/me` negative case (Task 8)
- `api/package.json` — add `hash-wasm` and `@aws-sdk/client-ssm` to `dependencies`
- `web/src/main.tsx` — render `<AppBootstrap />` instead of `<RouterProvider router={router} />` directly (Task 10)
- `web/src/router.tsx` — add `/login` route, wrap `/` with `RequireAuth` + `AuthenticatedShell` (Task 10)
- `infra/runbooks/bootstrap.md` — append "Section 8 — Verify the access gate" (Task 12)
- `_bmad-output/implementation-artifacts/deferred-work.md` — mark the "handler.test.ts missing negative test coverage" item resolved (Task 8 / Verification pass)

### Project Structure Notes

- **Full alignment with architecture's directory tree** (lines 840–1015). Every file this story creates is named in the architecture's `api/` or `web/` subtree:
  - `api/src/middleware/auth.ts`, `api/src/middleware/logger.ts` — architecture lines 926–927.
  - `api/src/routes/auth.ts` — architecture line 931.
  - `api/src/auth/jwt.ts`, `api/src/auth/password.ts` — architecture lines 946–948.
  - `api/src/secrets/ssm.ts` — architecture line 944–945.
  - `web/src/auth/auth-context.tsx`, `web/src/auth/auth-api.ts` — architecture lines 887–888.
  - `web/src/app-bootstrap.tsx` — architecture line 857.
  - `web/src/routes/login.tsx` — architecture line 862.
- **One added file** outside the strict tree: `api/src/routes/me.ts`. The architecture's tree lists `api/src/routes/auth.ts` and notes "POST /login, GET /me" as its routes. The cleaner Hono shape is a separate `me.ts` (mounted at `/api/v1/me`) because `/me` is auth-protected while `/auth/login` is not — splitting keeps the per-route concerns visible. **Document this variance in the Dev Agent Record**; no architecture.md update is needed (it's a within-a-file vs across-files difference, not an architectural choice).
- **One added file** outside the strict tree: `web/src/routes/authenticated-shell.tsx`. The architecture's tree doesn't enumerate a "shell" component because Story 1.5's nav chrome serves that purpose. For Story 1.4, the minimal shell is a necessary scaffold; Story 1.5 will replace its body and may rename or absorb the file. **Document this variance**; do not update architecture.md.
- **One added file** outside the strict tree: `web/src/auth/redirect-on-401.ts`. This is the architecture seam for AC-7; the tree doesn't enumerate it because it's a small helper. **Document the variance.**

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#1. Access Gate (FR-27)] (lines 172–193) — full Decision-1 contract, JWT key handling rules, password requirement
- [Source: _bmad-output/planning-artifacts/architecture.md#Auth flow (canonical sequence)] (lines 692–716) — boot, login, cookie attributes
- [Source: _bmad-output/planning-artifacts/architecture.md#API response envelope] (lines 496–520) — error / applied / ok envelope shapes
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging] (lines 755–766) — structured JSON log lines, never-log list, no analytics
- [Source: _bmad-output/planning-artifacts/architecture.md#Performance Mode invariants] (lines 652–675) — AR-28 (no auth-failure redirects while performance-active)
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural boundaries] (lines 1017–1027) — `api/src/secrets/ssm.ts` as the only SSM surface; `api` ↔ `shared` types-only contract
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] (lines 469–836) — naming, envelope, schema-as-source-of-truth
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] (lines 484–540) — full AC text
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] FR-27 (line 59), NFR-10–13 (lines 90–93), AR-15 to AR-19 (lines 141–145), AR-28 (line 160)
- [Source: _bmad-output/implementation-artifacts/1-3-aws-infrastructure-stacks-data-api-web-observability-ci.md] — api-stack env vars and IAM, bootstrap runbook seeding, deferred-work entry #6 (handler.test.ts negative coverage)
- [Source: _bmad-output/implementation-artifacts/1-1-repo-scaffold-and-toolchain.md] — Hono adapter pattern, port choices, Biome config
- [Source: _bmad-output/implementation-artifacts/1-2-design-system-foundation-tokens-typography-atmospheres.md] — atmosphere wiring, microcopy voice rules
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — handler.test.ts negative coverage (resolved by Task 8)
- [Source: CLAUDE.md] — boundaries, schemas-as-source-of-truth, React Router 7 import path, Biome-only

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7) — Claude Code CLI, 2026-06-11.

### Debug Log References

- `pnpm typecheck` — all 5 packages green (shared, infra, e2e, web, api).
- `pnpm lint` — Biome clean across 70 files after one `lint:fix` pass that reformatted six new test files into the project's single-line destructuring style.
- `pnpm test` — 116 tests passing across all suites: shared 12, api 36, web 37, infra 31.
- `pnpm -F api run build` — `dist/handler.js` builds at 478.8kb. `@aws-sdk/client-ssm` remains externalised (resolves from the Lambda Node 22 runtime layer at execute time). No missing-extern warnings. `hash-wasm` is bundled into the zip as expected (pure-WASM, no native binding).
- One implementation deviation from the spec: `SessionClaims` gained `[key: string]: unknown` to satisfy hono/jwt's `JWTPayload` index-signature contract. Inline comment documents it. No behavioral change.
- The `app-bootstrap.test.tsx` suite required an explicit `await router.navigate('/', { replace: true })` in `beforeEach` because `createBrowserRouter` is module-scoped and retains its location across tests. Reset hook documented in the test file.

### Completion Notes List

**Implementation summary**

- Implemented Decision 1 (Access Gate) end-to-end per architecture.md lines 172–193 and 692–716: SSM-backed argon2id + HS256 JWT cookie, one-year `Max-Age`, manual rotation only.
- Skip-path policy honours exact-match on `c.req.path` (architecture lines 858–862). `/api/v1/auth/login` and `/api/v1/health` are the only unauthenticated paths; future routes under `/api/v1/*` are gated by default.
- Logger middleware redacts the documented secret-header keys (`password`, `cookie`, `authorization`, `set-cookie`, `gigbuddy_session`) case-insensitively. Per spec scope note: request bodies are NOT logged in this story (Story 2.3 owns selective body logging behind redaction).
- Uniform-timing rejection paths in `auth/password.ts` (real-hash fetch failure, malformed stored hash) AND in `routes/auth.ts` (non-JSON body, missing/invalid `password` field) every login attempt runs at least one argon2id verify. The `routes/auth.test.ts` spec uses verify-call-count as the testable timing invariant per AC-4 guidance.
- Dummy hash baked into `auth/password.ts` is a real PHC string generated offline with `hash-wasm`'s `argon2id({ outputType: 'encoded' })` — confirmed to round-trip through `argon2Verify`. Same iteration / memory / parallelism profile as a real verify.
- SPA boot distinguishes online-401 from offline (fetch-rejected) — `auth-api.ts` returns `'unauthenticated'` for 401, `'unknown'` for thrown fetch — exactly the AR-16 contract.
- AC-7 architecture seam in place: `shouldRedirectOn401({performanceActive, wasNetworkSuccess})` is a pure decision function; Story 1.4 callers pass `performanceActive=false` from the `usePerformanceActive()` placeholder hook. Story 1.5 / 4.1 swap the hook implementation without touching the auth module.
- Re-authenticate banner on MacBook only, dismissible per-session (in-memory `useState`, never `localStorage`). Voice: full sentence with a period, no exclamation mark per EXPERIENCE.md voice rules.

**Variances from the architecture file tree (documented per spec)**

- Added `api/src/routes/me.ts` — architecture lists only `auth.ts` and notes "POST /login, GET /me", but the cleaner Hono shape is a separate sub-route mounted at `/api/v1/me` because `/me` is gated and `/auth/login` is not. Within-file-vs-cross-files only; no architecture.md change needed.
- Added `web/src/routes/authenticated-shell.tsx` — minimal scaffold for the auth flow; Story 1.5 replaces or absorbs the body when it lands the nav chrome.
- Added `web/src/auth/redirect-on-401.ts` — small helper enumerating the AC-7 decision; the architecture tree didn't enumerate it.

**Manual smoke deferred to deploy**

- The Task 13 manual `curl` + browser smoke (lines 840–841) are predicated on a redeploy of `GigbuddyApi` carrying the new Lambda code, which requires Sandy's AWS credentials and a `pnpm -F infra exec cdk deploy GigbuddyApi`. The smoke commands are documented verbatim in `infra/runbooks/bootstrap.md` Section 8 (Task 12) and are reproducible. Capture the four `curl -i` outputs in the runbook when the deploy ships, and confirm the iPhone PWA cookie persistence path.

**Deferred-work item resolved**

- `_bmad-output/implementation-artifacts/deferred-work.md` updated to mark "handler.test.ts missing negative test coverage" as resolved by Task 8.

### File List

**Created**

- `shared/src/schemas/auth.ts`
- `shared/src/schemas/auth.test.ts`
- `api/src/secrets/ssm.ts`
- `api/src/secrets/ssm.test.ts`
- `api/src/auth/password.ts`
- `api/src/auth/password.test.ts`
- `api/src/auth/jwt.ts`
- `api/src/auth/jwt.test.ts`
- `api/src/middleware/auth.ts`
- `api/src/middleware/auth.test.ts`
- `api/src/middleware/logger.ts`
- `api/src/middleware/logger.test.ts`
- `api/src/routes/auth.ts`
- `api/src/routes/auth.test.ts`
- `api/src/routes/me.ts`
- `api/src/routes/me.test.ts`
- `web/src/auth/auth-context.tsx`
- `web/src/auth/auth-api.ts`
- `web/src/auth/auth-api.test.ts`
- `web/src/auth/redirect-on-401.ts`
- `web/src/auth/redirect-on-401.test.ts`
- `web/src/app-bootstrap.tsx`
- `web/src/app-bootstrap.test.tsx`
- `web/src/routes/login.tsx`
- `web/src/routes/login.test.tsx`
- `web/src/routes/authenticated-shell.tsx`
- `web/src/components/reauth-banner.tsx`
- `web/src/components/reauth-banner.test.tsx`

**Modified**

- `shared/src/index.ts` — added `export * from './schemas/auth.js'`.
- `api/src/app.ts` — composed logger + auth middleware and the new `/api/v1/auth` + `/api/v1/me` sub-routes alongside the existing `/api/v1/health`.
- `api/src/handler.test.ts` — added the GET `/api/v1/me` 401 negative case; resolves deferred-work entry from the Story 1.3 review.
- `api/package.json` — added `@aws-sdk/client-ssm@^3.658.0` and `hash-wasm@^4.12.0` to `dependencies`.
- `web/package.json` — added `@testing-library/user-event@^14.5.0` to `devDependencies` (used by the new login + banner tests).
- `web/src/main.tsx` — mount `<AppBootstrap />` instead of `<RouterProvider />` directly; `applyBootAtmosphere()` still runs at module top level before React mounts.
- `web/src/router.tsx` — added `/login` route, wrapped `/` with `RequireAuth` + `AuthenticatedShell`, preserved the existing `Placeholder` as the index child.
- `infra/runbooks/bootstrap.md` — appended Section 8 "Verify the access gate" with the four reproducible smoke commands.
- `_bmad-output/implementation-artifacts/deferred-work.md` — struck-through the resolved handler.test.ts negative-coverage entry with a back-reference to Task 8.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-4-...: ready-for-dev → in-progress → review` (final transition is part of the workflow's Step 9 alongside this status update).

### Change Log

- 2026-06-11 — Implemented Story 1.4: shared auth schemas, SSM secrets, argon2id password verify with uniform timing, HS256 JWT sign/verify, Hono auth + logger middleware, `/api/v1/auth/login` + `/api/v1/me` routes, web AuthContext + fetchMe + login wrappers, `shouldRedirectOn401` AC-7 seam, AppBootstrap, Login route, ReauthBanner, AuthenticatedShell, router rewire, bootstrap-runbook Section 8. Story 1.3 deferred-work item (handler 401 negative case) resolved.
