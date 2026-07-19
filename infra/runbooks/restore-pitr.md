# Verified restore runbook — PITR + AWS Backup (V1 ship gate)

This runbook is the FR-34 / AR-14 verified-restore procedure. It exists so that
before V1 ships, Sandy has proof — not theory — that PITR restores the
`gigbuddy-data` table and that the deployed app reads correctly from a restored
copy. Every command below assumes `--region eu-west-2` and admin credentials
(see § 3 Prerequisites).

Cross-references:

- Bootstrap: `infra/runbooks/bootstrap.md`
- Architecture contract: `_bmad-output/planning-artifacts/architecture.md`
- Story spec: `_bmad-output/implementation-artifacts/5-2-verified-restore-drill-runbook-v1-ship-gate.md`

## 1. Purpose

FR-34 (Backup & Restore) obliges V1 to ship with:

- **Automated at-least-daily backup with reasonable retention, restorable to the
  live store.**
- **≤24h data-loss window (RPO).**
- **≤2h restore-to-operational target (RTO).**
- **A documented restore procedure exists and has been verified end-to-end at
  least once before V1 ships.**

This runbook discharges the "documented restore procedure ... verified
end-to-end" clause. It is a manual admin procedure — the CI OIDC deploy role
deliberately cannot execute the destructive AWS actions it uses (see § 3).
Running it end-to-end and appending a Sign-off entry (§ 8) is the ship gate.

AR-14 frames the same obligation as a release gate: `restore-pitr.md` executed
end-to-end (seed → restore → validate → swap → confirm → swap back) before V1
ships. This story blocks ship.

## 2. Triggers

Execute this runbook when one of the following applies:

- **Real data-loss event** — accidental delete, corruption, application bug that
  destroyed records. Use PITR to the last known-good timestamp.
- **Scheduled periodic drill** — recommended annually, and whenever the data
  layer's architecture changes materially (new table, GSI shape change, encryption
  key rotation).
- **V1 ship-gate execution** — the one-time verified-restore drill that clears
  the FR-34 / AR-14 ship gate.

## 3. Prerequisites

- **AWS credentials with admin scope.** Use AWS SSO or the `gigbuddy-admin`
  bootstrap profile from `bootstrap.md` § 0a. **Do not** attempt to run this
  with the CI OIDC `gigbuddy-deploy-role` — it deliberately lacks the required
  DynamoDB restore/delete and Lambda-config actions (see `infra/lib/stacks/ci-stack.ts`,
  which grants only `dynamodb:Query`/`Scan`/`DescribeTable` on the table for the
  deploy-time blackout check). Widening the deploy role is **not** the fix; the
  drill is admin-only by design.
- **IAM actions required** (all on eu-west-2 resources):
  - `dynamodb:RestoreTableToPointInTime`, `dynamodb:DescribeTable`,
    `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:DeleteTable` on
    `gigbuddy-data*` (the wildcard covers the ephemeral restore side table).
  - `lambda:UpdateFunctionConfiguration`, `lambda:GetFunctionConfiguration` on
    `gigbuddy-api`.
  - For the AWS Backup secondary path (§ 5, Secondary): `backup:StartRestoreJob`,
    `backup:DescribeRestoreJob`, `backup:ListRecoveryPointsByBackupVault`, plus
    `iam:PassRole` for the AWS Backup restore role.
- **AWS CLI v2** on the local machine, with a profile that carries the actions
  above. Every command in this runbook uses `--region eu-west-2` explicitly —
  do not rely on ambient region config.
- **The live URL** `https://gig.cormie.com/` (used in phase 7).

## 4. RPO / RTO targets

- **RPO ~5 min** — PITR provides continuous backup; the effective data-loss
  window is the last 5 minutes of writes (architecture.md Decision 3).
- **RTO ≤ 2h** — FR-34 ceiling. **Target 15–60 min** for this drill, dominated
  by the phase-4 restore wait (5–15 min for a small table).

AWS Backup daily snapshots are the **secondary** restore path with RPO ~24h.
Use them only when the target restore point is older than PITR's 35-day
retention window. PITR remains the primary mechanism for any recent event.

## 5. Step-by-step procedure

The primary (PITR) path is a 10-phase drill. The secondary (AWS Backup) path
diverges only at phases 3–4; from phase 5 onward it rejoins the primary path.

Every command below sets `--region eu-west-2` explicitly. Every command has a
`# expect: ...` comment describing success. If the actual output diverges,
stop and consult § 6 (Validation checks) and § 7 (Rollback).

### Phase 1 — Seed the canary record

Seed through the app's own write path (not a raw `dynamodb put-item`). This
exercises the real request pipeline the drill is meant to validate, and avoids
the DDB-typed-attribute JSON pitfalls of a hand-built raw item.

```
# Log in as Sandy — reuses the bootstrap.md § 8 cookie pattern
curl -i -X POST https://gig.cormie.com/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d "{\"password\":\"$REAL_PASSWORD\"}" \
  -c /tmp/gigbuddy-drill-cookie.txt
# expect: HTTP/2 200, body {"status":"applied"}, Set-Cookie: gigbuddy_session=...

# Generate a 16-char URL-safe songId (any unique NanoID-shaped string works)
SONG_ID=$(openssl rand -base64 12 | tr '+/' '-_' | tr -d '=' | cut -c1-16)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# PUT the canary Song — bandId is ACTIVE_BAND_ID from shared/src/active-band.ts
curl -i -X PUT "https://gig.cormie.com/api/v1/songs/$SONG_ID" \
  -H 'content-type: application/json' \
  -b /tmp/gigbuddy-drill-cookie.txt \
  -d "{\"bandId\":\"k0c5Db7zM2qF3vNa\",\"songId\":\"$SONG_ID\",\"title\":\"RESTORE CANARY $NOW\",\"clientWrittenAt\":\"$NOW\",\"version\":1}"
# expect: HTTP/2 200, body includes "title":"RESTORE CANARY <NOW>" and a serverReceivedAt timestamp

# Record these — you will need them again in phases 5 and 10.
echo "SONG_ID=$SONG_ID  CANARY_TITLE=RESTORE CANARY $NOW"
```

### Phase 2 — Wait 5 minutes

PITR is continuous, but the restore-window granularity requires the write to
have rolled forward before it can be restored precisely. Set a timer:

```
sleep 300
# expect: 5 minutes elapsed; the phase-1 write is now inside the restorable window
```

### Phase 3 — Initiate the PITR restore

Choose an ISO-8601 timestamp **after** the phase-1 canary write. `NOW` from
phase 1 works; so does the current time (any value ≥ NOW is fine).

```
TIMESTAMP_TAG=$(date -u +%Y%m%d%H%M%S)
RESTORE_TABLE="gigbuddy-data-restore-$TIMESTAMP_TAG"
RESTORE_POINT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

aws dynamodb restore-table-to-point-in-time \
  --source-table-name gigbuddy-data \
  --target-table-name "$RESTORE_TABLE" \
  --restore-date-time "$RESTORE_POINT" \
  --region eu-west-2
# expect: JSON response with TableDescription.TableName = gigbuddy-data-restore-<TIMESTAMP_TAG>
#         and TableStatus: "CREATING"

echo "RESTORE_TABLE=$RESTORE_TABLE"
```

Notes:

- GSI1 is restored automatically — AWS restores all GSIs present on the source
  table at the restore point. No separate GSI-recreation step is required.
- The restored table does **not** inherit `PointInTimeRecoveryEnabled` or
  `DeletionProtection` — that is expected. It is a short-lived side table;
  it is fine that it can be deleted directly in phase 9.

### Phase 4 — Wait for restore completion

This is the dominant time cost — typically 5–15 min for a small table.

```
while true; do
  STATUS=$(aws dynamodb describe-table \
    --table-name "$RESTORE_TABLE" \
    --region eu-west-2 \
    --query 'Table.TableStatus' \
    --output text)
  echo "$(date -u +%H:%M:%S) TableStatus=$STATUS"
  [ "$STATUS" = "ACTIVE" ] && break
  sleep 30
done
# expect: eventually TableStatus=ACTIVE (may take 5–15 min)
```

### Phase 5 — Validate canary present in restored table

```
aws dynamodb get-item \
  --table-name "$RESTORE_TABLE" \
  --key "{\"pk\":{\"S\":\"BAND#k0c5Db7zM2qF3vNa\"},\"sk\":{\"S\":\"SONG#$SONG_ID\"}}" \
  --region eu-west-2
# expect: JSON with an "Item" object containing "title": {"S": "RESTORE CANARY <NOW>"}
#         matching the canary written in phase 1
```

If `Item` is absent or the title does not match: the restore point was before
the canary write. Retry phase 3 with a later `--restore-date-time`.

### Phase 6 — Swap the Lambda's `TABLE_NAME` to the restored side table

> **WARNING — env-var swap gotcha.** `aws lambda update-function-configuration
> --environment` **replaces the entire `Variables` map**; it does not merge.
> `gigbuddy-api` has three env vars: `TABLE_NAME`, `JWT_KEY_PARAM`,
> `PASSWORD_HASH_PARAM`. Omitting `JWT_KEY_PARAM` or `PASSWORD_HASH_PARAM` from
> the swap command silently wipes them, which breaks JWT-key and password-hash
> SSM lookups — i.e. it locks Sandy out of the live app. **Always re-specify
> all three variables**, changing only `TABLE_NAME`.

```
aws lambda update-function-configuration \
  --function-name gigbuddy-api \
  --environment "Variables={TABLE_NAME=$RESTORE_TABLE,JWT_KEY_PARAM=/gigbuddy/jwt-key,PASSWORD_HASH_PARAM=/gigbuddy/password-hash}" \
  --region eu-west-2
# expect: JSON response with Environment.Variables.TABLE_NAME = <RESTORE_TABLE>,
#         and JWT_KEY_PARAM + PASSWORD_HASH_PARAM still present and unchanged

aws lambda get-function-configuration \
  --function-name gigbuddy-api \
  --region eu-west-2 \
  --query 'Environment.Variables'
# expect: {"TABLE_NAME": "<RESTORE_TABLE>", "JWT_KEY_PARAM": "/gigbuddy/jwt-key", "PASSWORD_HASH_PARAM": "/gigbuddy/password-hash"}
# If either of the JWT/PASSWORD_HASH keys is missing here, STOP and re-run
# the update with all three variables before proceeding — the app is
# currently unable to authenticate.
```

### Phase 7 — Confirm the app reads correctly from the restored table

Manual browser check (required):

1. Open `https://gig.cormie.com/` in a fresh private window (to force a login).
2. Log in with the real password.
3. Navigate to Library. Confirm at least one Song row renders (the canary from
   phase 1, or any pre-existing Song — the check is data-path integrity, not
   canary-specific).
4. Open a Setlist card from the Setlists home. Confirm Songs render in the
   overview.

Optional automated check (recommended once the browser check has passed):

```
export RESTORE_DRILL_URL=https://gig.cormie.com
export RESTORE_DRILL_PASSWORD=<the real password>
pnpm test:e2e:restore
# expect: the verified-restore spec passes — Library shows a Song and a Setlist
#         overview renders Songs
```

The Playwright spec (`e2e/restore/verified-restore.spec.ts`) is
parameterised via `RESTORE_DRILL_URL` and `RESTORE_DRILL_PASSWORD`. If either
is unset, the spec exits early with a readable error rather than a confusing
navigation timeout.

### Phase 8 — Swap `TABLE_NAME` back to `gigbuddy-data`

> **WARNING — same env-var swap gotcha as phase 6.** Re-specify all three
> variables. The only difference from the phase-6 command is `TABLE_NAME`.

```
aws lambda update-function-configuration \
  --function-name gigbuddy-api \
  --environment "Variables={TABLE_NAME=gigbuddy-data,JWT_KEY_PARAM=/gigbuddy/jwt-key,PASSWORD_HASH_PARAM=/gigbuddy/password-hash}" \
  --region eu-west-2
# expect: JSON response with Environment.Variables.TABLE_NAME = "gigbuddy-data"

aws lambda get-function-configuration \
  --function-name gigbuddy-api \
  --region eu-west-2 \
  --query 'Environment.Variables'
# expect: {"TABLE_NAME": "gigbuddy-data", "JWT_KEY_PARAM": "/gigbuddy/jwt-key", "PASSWORD_HASH_PARAM": "/gigbuddy/password-hash"}
```

Re-open `https://gig.cormie.com/` and confirm login + Library still work —
this is the "restored to operational" check that closes the RTO measurement.

### Phase 9 — Delete the restored side table

The restored table has no `DeletionProtection`, so `delete-table` succeeds
directly. The original `gigbuddy-data` table is untouched.

```
aws dynamodb delete-table \
  --table-name "$RESTORE_TABLE" \
  --region eu-west-2
# expect: JSON response with TableStatus: "DELETING"
```

### Phase 10 — Delete the canary record from `gigbuddy-data`

There is no delete endpoint in the V1 API (architecture.md Decision 2: no
admin-delete endpoints). Use a raw DDB delete to remove exactly the item
phase 1 added — this is the one raw-DDB mutation in the drill, and it is
additive-cleanup only (it never touches any pre-existing Song or Setlist).

```
aws dynamodb delete-item \
  --table-name gigbuddy-data \
  --key "{\"pk\":{\"S\":\"BAND#k0c5Db7zM2qF3vNa\"},\"sk\":{\"S\":\"SONG#$SONG_ID\"}}" \
  --region eu-west-2
# expect: empty JSON response ({}) — delete-item returns nothing on success

# Clean up the local cookie file used in phase 1
rm -f /tmp/gigbuddy-drill-cookie.txt
```

### Secondary — restore from AWS Backup daily snapshot

Use this path **only** when the target restore point is older than PITR's
35-day window. RPO is ~24h (vs ~5 min for PITR). PITR remains the primary
path for anything recent.

The mechanism differs only at phases 3–4. From phase 5 onward, the primary
runbook applies unchanged — including the env-var swap warning in phase 6.

Sketch:

1. List available recovery points to find the target snapshot:
   ```
   aws backup list-recovery-points-by-backup-vault \
     --backup-vault-name <vault name from GigbuddyData stack> \
     --region eu-west-2
   # TODO: verify vault name from GigbuddyData stack outputs at execution time
   ```
2. Start the restore job, supplying a new `TargetTableName` in `Metadata`:
   ```
   aws backup start-restore-job \
     --recovery-point-arn <ARN from step 1> \
     --iam-role-arn <AWS Backup restore role ARN> \
     --resource-type DynamoDB \
     --metadata '{"TargetTableName":"gigbuddy-data-restore-<timestamp>"}' \
     --region eu-west-2
   # TODO: verify the exact Metadata key(s) against current AWS Backup docs
   # before executing — DynamoDB Metadata keys have varied historically and
   # an untested command shape is worse than a flagged TODO here.
   ```
3. Poll the restore job until `COMPLETED`:
   ```
   aws backup describe-restore-job \
     --restore-job-id <id from step 2> \
     --region eu-west-2
   # expect: eventually Status: "COMPLETED"
   ```
4. **Rejoin the primary runbook at Phase 5** (validate canary) using the
   restored side table's name. Phases 5–10 (validate → swap → confirm →
   swap-back → delete side table → delete canary) apply unchanged.

This subsection is deliberately lean: it exists to document the mechanism and
its rejoin point, not to re-spec the phases already covered above.

## 6. Validation checks

- **Phase 1** — `curl` returns HTTP/2 200 with a body echoing the canary title
  and a `serverReceivedAt` field.
- **Phase 2** — 5 minutes elapsed.
- **Phase 3** — `restore-table-to-point-in-time` response contains
  `TableStatus: "CREATING"` for the new side-table name.
- **Phase 4** — `describe-table` eventually reports `TableStatus: "ACTIVE"`.
- **Phase 5** — `get-item` returns an `Item` whose `title` matches the canary
  string written in phase 1.
- **Phase 6** — `get-function-configuration` shows all **three** env vars
  present, with `TABLE_NAME` set to the restored side table. If any of
  `JWT_KEY_PARAM` / `PASSWORD_HASH_PARAM` is missing, treat as a failure and
  re-run the update immediately.
- **Phase 7** — Library page renders at least one Song; a Setlist card opens
  and its overview renders Songs. Optional: the Playwright spec passes.
- **Phase 8** — `get-function-configuration` shows `TABLE_NAME=gigbuddy-data`
  and the other two env vars still present. Login + Library work in the
  browser.
- **Phase 9** — `delete-table` returns `TableStatus: "DELETING"` (or the
  table is gone from `list-tables` after a short interval).
- **Phase 10** — `delete-item` returns an empty response. A subsequent
  `get-item` for the same key returns no `Item`.

## 7. Rollback

Phases 1–9 **never mutate `gigbuddy-data` destructively**. Phase 1 adds a
single canary Song via the normal write path; phase 10 removes exactly that
item. No other write hits the source table. Restore, describe, get-item on
the restored side table, and the Lambda env-var swap all leave the source
table's data untouched.

That means rollback for a misfire in phases 1–7 is: **re-run the phase-8
swap-back command**, pointed at `gigbuddy-data`. That single action returns
the live app to its normal state.

```
# The safe "back to normal" command — same as phase 8:
aws lambda update-function-configuration \
  --function-name gigbuddy-api \
  --environment "Variables={TABLE_NAME=gigbuddy-data,JWT_KEY_PARAM=/gigbuddy/jwt-key,PASSWORD_HASH_PARAM=/gigbuddy/password-hash}" \
  --region eu-west-2
```

If phase 8 itself was skipped or errored, re-run it directly — it is
idempotent. If phase 10 was skipped, the canary Song remains in the Library
until the raw DDB `delete-item` runs; this is annoying but not damaging.

> **DeletionProtection guardrail.** The original `gigbuddy-data` table's
> `DeletionProtection` must **never** be disabled as part of this drill. The
> restored side table is a separate resource that does not inherit
> `DeletionProtection`, so `delete-table` in phase 9 succeeds directly against
> the side table. Disabling protection on the source table is never a valid
> step in this runbook — if you find yourself considering it, stop and reread
> phase 9.

## 8. Sign-off log

Append one row per drill execution. A fabricated row is a runbook defect, not
a completion — the whole point of the ship gate is that this log records real
executions against the live `gigbuddy-data` table.

| Date | Executor | Total elapsed | RPO observed | RTO observed | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- |
