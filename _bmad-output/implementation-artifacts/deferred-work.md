# Deferred Work

## Deferred from: code review of 1-1-repo-scaffold-and-toolchain (2026-06-10)

- **API build bundles `src/dev.ts` instead of a Lambda handler** (`api/package.json`) — documented deviation #3 from Story 1.1; Story 1.3 owns the real handler entry and will retarget esbuild to `src/handler-entry.ts`.
- **E2E playwright config does not start the API server** (`e2e/playwright.config.ts`) — smoke test exercises the placeholder only; no API calls needed now. Becomes relevant when API-dependent E2E tests are added (Epic 2+).
- **`verbatimModuleSyntax: false` + `isolatedModules: true`** (`tsconfig.base.json`) — contradictory flags; `verbatimModuleSyntax` is the modern replacement for `isolatedModules`. Not causing failures today; clean up in a future toolchain pass.
- **Config files outside `src/` excluded from Biome lint and tsconfig typecheck** — `web/vite.config.ts`, `e2e/playwright.config.ts` fall outside `web/src/**` globs and `"include": ["src/**/*"]` paths. TypeScript errors in these files won't surface in `pnpm typecheck` or `pnpm lint`. Address when adding a config-wide lint pass.

## Deferred from: code review of 1-3-aws-infrastructure-stacks-data-api-web-observability-ci (2026-06-11)

- **`kms:Decrypt` on `resources: ['*']`** (`infra/lib/stacks/api-stack.ts`) — standard SSM `alias/aws/ssm` pattern; `kms:ViaService` condition scopes decryption to SSM calls only; the managed key ARN is not available at synth time so `*` is unavoidable here. Revisit if a customer-managed SSM key is introduced.
- **CloudTrail bucket missing object versioning** (`infra/lib/stacks/observability-stack.ts`) — beyond AC-4 scope; CloudTrail's native log file integrity validation (`enableLogFileValidation`) is the appropriate mechanism. Add both in a future observability hardening pass.
- **Budget alerts fire only at 100% threshold** (`infra/lib/stacks/observability-stack.ts`) — beyond AC-4 requirements. Add a FORECASTED 80% notification in a future infrastructure hardening story.
- **Function URL unprotected during bootstrap deploy window** (`infra/lib/stacks/web-stack.ts`) — short window between GigbuddyApi and GigbuddyWeb deploys; no secrets exposed until Story 1.4. Document the window in bootstrap.md.
- **Hard-coded Lambda/log-group names block second-environment deploy** (`infra/lib/stacks/api-stack.ts`) — intentional single-account design for a personal tool. Accept the constraint; document in Dev Notes.
- **handler.test.ts missing negative test coverage** (`api/src/handler.test.ts`) — story scope covers only `/api/v1/health`. Story 1.4 adds auth routes and is the appropriate place for negative/401 test cases.

## Deferred from: code review of 1-2-design-system-foundation-tokens-typography-atmospheres (2026-06-11)

- **`downloadIfMissing` leaves partial file on interrupted download** (`web/scripts/subset-fonts.ts`) — `existsSync` check skips re-download of a corrupt partial file, passing bad TTF to fonttools. Fix: write to a temp path and rename on success. Developer tooling only; font WOFF2s are already committed.
- **No `finally` cleanup for intermediate .ttf instance files on error** (`web/scripts/subset-fonts.ts`) — if `instance()` or `subset()` throws, `unlinkSync(instancePath)` is never called; stale `.ttf` files accumulate in `fonts-source/instances/`. Developer tooling only.
- **`hexToRgb` silent NaN on non-hex strings** (`web/scripts/contrast-report.ts`) — not triggered by current `PAIRS` / `COLOR_TOKEN_NAMES` (no non-hex color tokens are enumerated), but a future edit adding a non-hex value would silently write `NaN` to the report and bypass the contrast gate. Add a hex-format guard or explicit error.
