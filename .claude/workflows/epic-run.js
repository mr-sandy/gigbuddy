export const meta = {
  name: 'epic-run',
  description: 'Run all stories in a BMad epic end-to-end: create spec → review spec → implement → code-review → adversarial review → commit. Logs MANUAL_REVIEW_RECOMMENDED checkpoints for user-visible stories without stopping.',
  whenToUse: 'When the user wants to autonomously execute every story in a BMad epic in one run, with hard-stops only on real failures.',
  phases: [
    { title: 'Discover', detail: 'parse epics doc for stories in the named epic' },
    { title: 'Wrap up', detail: 'list manual-review checkpoints' },
  ],
}

const argsObj = typeof args === 'object' && args !== null ? args : { epicId: args }
const epicId = String(argsObj.epicId ?? '').trim()
if (!epicId) {
  throw new Error('Pass the epic ID as args, e.g. Workflow({name: "epic-run", args: "3"}) or {epicId: "3"}')
}

const attempt = Number(argsObj.attempt ?? 1)

const epicsPath = argsObj.epicsPath ?? '_bmad-output/planning-artifacts/epics.md'
const sprintStatusPath = argsObj.sprintStatusPath ?? '_bmad-output/implementation-artifacts/sprint-status.yaml'
const specDir = argsObj.specDir ?? '_bmad-output/implementation-artifacts'

const DEFAULT_USER_VISIBLE_PATTERNS = [
  '^web/src/routes/',
  '^web/src/components/',
  '^web/src/hooks/',
  '^web/src/styles/',
  '^web/src/main\\.tsx$',
  '^web/src/app-bootstrap\\.tsx$',
  '^web/src/router\\.tsx$',
  '^web/index\\.html$',
  '^web/vite\\.config\\.(t|j)s$',
  '^web/public/',
]

const userVisiblePatterns = (argsObj.userVisiblePatterns ?? DEFAULT_USER_VISIBLE_PATTERNS).map(
  (p) => new RegExp(p),
)
const isUserVisible = (files) =>
  files.some((f) => userVisiblePatterns.some((p) => p.test(f)))

const lockedConstraints = argsObj.lockedConstraints ?? []
const lockedConstraintsBlock = lockedConstraints.length
  ? `

Locked constraints to respect (do NOT flag as issues):
${lockedConstraints.map((c) => `- ${c}`).join('\n')}`
  : ''

const RUNNABLE_STATUSES = new Set(['backlog', 'ready-for-dev', 'in-progress'])
const SKIP_STATUSES = new Set(['review', 'done'])

const haltOn = (review, stage, story, hint) => {
  if (review.severity !== 'high') return
  log(`✋ HARD STOP at ${story.id} (${stage}, severity=high)`)
  for (const f of review.findings) log(`   • ${f}`)
  throw new Error(`${stage} halted at ${story.id}. ${hint} Resume with args.attempt=${attempt + 1}.`)
}

const STORIES_SCHEMA = {
  type: 'object',
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'e.g. "3.1"' },
          title: { type: 'string' },
          sprintStatusKey: {
            type: 'string',
            description: 'verbatim key from sprint-status.yaml development_status (e.g. "3-1-setlist-api-ddb-persistence"); empty string if no matching key',
          },
          status: {
            type: 'string',
            description: 'verbatim status value from sprint-status.yaml; "unknown" if no matching key found',
          },
        },
        required: ['id', 'title', 'sprintStatusKey', 'status'],
      },
    },
  },
  required: ['stories'],
}

const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    specPath: { type: 'string', description: 'absolute or repo-relative path of the created story spec file' },
  },
  required: ['specPath'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    findings: { type: 'array', items: { type: 'string' } },
  },
  required: ['severity', 'findings'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    testsPass: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['testsPass'],
}

const COMMIT_SCHEMA = {
  type: 'object',
  properties: {
    commitSha: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
  },
  required: ['commitSha', 'filesChanged'],
}

phase('Discover')

const discovery = await agent(
  `Read both ${epicsPath} and ${sprintStatusPath} from the project root, then return every story under Epic ${epicId}.

For each story, return:
- id: e.g. "${epicId}.1"
- title: the title text from the "### Story ${epicId}.<n>: <title>" heading with the "Story X.Y:" prefix stripped. KEEP any trailing "(FR-N, …)" tag — it is part of the canonical title used in commit messages.
- sprintStatusKey: the matching key from ${sprintStatusPath}'s development_status map. Match by the "${epicId}-<n>-" prefix (e.g. "${epicId}-1-..."). Return the full key verbatim. If no key has that prefix, return an empty string.
- status: the verbatim status string from ${sprintStatusPath} for that key (e.g. "backlog", "ready-for-dev", "in-progress", "review", "done", "contexted"). If no matching key, return "unknown".

Look for headings of the form "### Story ${epicId}.<n>: <title>" in the epics doc. Return stories in the order they appear.`,
  { label: `discover-epic-${epicId}`, model: 'sonnet', schema: STORIES_SCHEMA },
)

if (!discovery.stories.length) {
  throw new Error(`No stories found for epic ${epicId} in ${epicsPath}`)
}

const runnable = discovery.stories.filter(
  (s) => RUNNABLE_STATUSES.has(s.status) || s.status === 'unknown',
)
const skipped = discovery.stories.filter((s) => SKIP_STATUSES.has(s.status))
const unknownEntries = discovery.stories.filter((s) => s.status === 'unknown')

log(`Epic ${epicId}: ${discovery.stories.length} stories total — ${runnable.length} runnable, ${skipped.length} skipped (review/done).`)

for (const s of skipped) {
  log(`⊘ skip ${s.id} (status=${s.status}) — ${s.title}`)
}

if (unknownEntries.length) {
  log(`⚠️ ${unknownEntries.length} stories have no entry in ${sprintStatusPath}; treating as runnable. If you have not run bmad-sprint-planning yet for this epic, do that first for proper status tracking.`)
  for (const s of unknownEntries) {
    log(`   ? ${s.id} (status=unknown) — ${s.title}`)
  }
}

if (!runnable.length) {
  log(`No runnable stories in epic ${epicId}. To redo a finished story, reset its status to "backlog" in ${sprintStatusPath} first.`)
  return {
    epicId,
    attempt,
    storiesCompleted: [],
    manualReviewCheckpoints: [],
    skipped: skipped.map((s) => ({ id: s.id, status: s.status })),
  }
}

log(`Will run: ${runnable.map((s) => s.id).join(', ')}${attempt > 1 ? ` [attempt ${attempt}]` : ''}`)

const completed = []
const checkpoints = []
let haltError = null

try {
for (const story of runnable) {
  phase(`Story ${story.id}`)
  log(`▶ ${story.id} — ${story.title} (status=${story.status})`)

  const expectedSpecPath = story.sprintStatusKey
    ? `${specDir}/${story.sprintStatusKey}.md`
    : `${specDir}/${story.id.replace('.', '-')}-<slug>.md`

  const created = await agent(
    `Invoke the bmad-create-story skill to create the story spec for story ${story.id} ("${story.title}") from epic ${epicId}.

Inputs:
- Epics doc: ${epicsPath}
- Architecture doc: _bmad-output/planning-artifacts/architecture.md
- Sprint status: ${sprintStatusPath}

The skill will derive the spec filename from the sprint-status key. Expected output path: ${expectedSpecPath}

If the spec file already exists (prior run created it), the skill is idempotent — let it pick up from existing state. Do not implement anything in this step — only produce the story spec file. Return its path.`,
    { label: `create:${story.id}`, model: 'sonnet', schema: SPEC_SCHEMA },
  )

  const specReview = await agent(
    `[attempt ${attempt}] Invoke the bmad-review-adversarial-general skill against the story spec at ${created.specPath}.

The skill will produce a cynical findings list. Then translate those findings into the structured output below, focusing only on these axes:

- AC drift: does the spec's acceptance criteria match the epic at ${epicsPath} exactly, or has it been paraphrased / weakened / expanded?
- Out-of-scope scaffolding: do any tasks/subtasks reference work owned by a later story (per ${epicsPath})?
- Convention conflicts: does the spec contradict anything in _bmad-output/planning-artifacts/architecture.md or CLAUDE.md (file layout, naming, module boundaries, web↔api HTTP-only, shared/ Zod single source of truth, api/src/ddb as sole DDB surface)?

Set severity:
- high: AC drift or out-of-scope work that would derail implementation
- medium: convention conflicts that need fixing but don't change scope
- low: minor wording or formatting nits
- none: spec is clean on the axes above

Return findings as concrete strings; include only severity≥medium concerns (drop pure nit-pickery from the skill's ≥10 list).`,
    { label: `review-spec:${story.id}`, model: 'sonnet', schema: REVIEW_SCHEMA },
  )

  haltOn(specReview, 'spec review', story, `Fix the spec at ${created.specPath}.`)

  const impl = await agent(
    `Invoke the bmad-dev-story skill to implement story ${story.id} from the spec at ${created.specPath}.

Requirements:
- Follow the spec's tasks/subtasks exactly. Do not scaffold anything outside the story's scope.
- Adhere to the conventions in CLAUDE.md and _bmad-output/planning-artifacts/architecture.md.
- Respect module boundaries: web ↔ api via HTTP only; shared/ Zod schemas are the single source of truth; DDB access only via api/src/ddb; SSM only via api/src/secrets/ssm.ts.
- Run the project's test suite. If tests fail, try ONE round of fixes, then re-run. If they still fail, set testsPass=false and put the failure summary in notes.
- Update the story's File List and Dev Agent Record sections.
- DO NOT create a git commit. Leave changes uncommitted in the working tree — the workflow will commit after review steps pass.

Return: testsPass, notes (optional, summarising any fix iteration or remaining gotchas).`,
    { label: `impl:${story.id}`, model: 'opus', schema: IMPL_SCHEMA },
  )

  if (!impl.testsPass) {
    log(`✋ HARD STOP at ${story.id} (tests failed after retry)`)
    log(`   notes: ${impl.notes || '(none)'}`)
    throw new Error(`Tests failed at ${story.id}. Investigate, fix the working tree, then resume with args.attempt=${attempt + 1}.`)
  }

  const codeReview = await agent(
    `[attempt ${attempt}] Review the uncommitted working-tree changes for story ${story.id} ("${story.title}").

How to read the diff (run these yourself):
- "git status -s" — list new/changed files
- "git diff HEAD" — see staged + unstaged changes against HEAD
- For new untracked files referenced in the spec's File List, read them directly

Spec to check against: ${created.specPath}

Apply the same lens as bmad-code-review's Blind Hunter / Edge Case Hunter / Acceptance Auditor, but do it inline — do NOT invoke the bmad-code-review skill (it is interactive and will hang).

Set severity:
- high: correctness bug, schema/architecture deviation, security issue, broken test, or boundary violation per CLAUDE.md (e.g. api/src importing from web, DDB access outside api/src/ddb, shared types defined outside shared/ Zod, parallel TS type duplicating a Zod-derived shape)
- medium: missed reuse, awkward but correct code, naming or convention drift
- low: stylistic nits
- none: clean

Be calibrated, not noisy. Severity=high requires a concrete failure mode or hard boundary violation. Return findings as concrete strings with file:line where possible.`,
    { label: `code-review:${story.id}`, model: 'opus', schema: REVIEW_SCHEMA },
  )

  haltOn(codeReview, 'code review', story, `Fix the working tree.`)

  const adversarial = await agent(
    `[attempt ${attempt}] Invoke the bmad-review-adversarial-general skill on the uncommitted working-tree changes for story ${story.id}.

How to read the diff:
- "git diff HEAD" — all uncommitted changes against HEAD
- "git status -s" — new/untracked files
- Spec context: ${created.specPath}

Translate the skill's cynical findings into the structured output below.

Be cynical, but calibrated: severity=high ONLY for findings that genuinely break correctness, violate a locked design constraint, or undermine an acceptance criterion. Plausible-sounding nits get low or medium. If you cannot point to a concrete failure mode, severity is not high.${lockedConstraintsBlock}

Return findings as concrete strings.`,
    { label: `adversarial:${story.id}`, model: 'opus', schema: REVIEW_SCHEMA },
  )

  haltOn(adversarial, 'adversarial review', story, `Fix the working tree.`)

  const commit = await agent(
    `Stage and commit all changes for story ${story.id}.

Steps:
1. Run "git add -A" to stage everything in the working tree.
2. Run "git diff --cached --quiet"; capture its exit code.
   - If exit code 0 (no staged changes), a prior run already committed for this story. Do NOT create a new commit. Set commitSha = output of "git rev-parse HEAD".
   - If exit code 1 (staged changes exist), create a commit with subject exactly:
       Implement story ${story.id}: ${story.title}
     Do NOT include any "Co-Authored-By", "Generated with", or similar trailers — Sandy's project preference.
     Then set commitSha = output of "git rev-parse HEAD".
3. Set filesChanged = output of "git diff-tree --no-commit-id --name-only -r ${'${commitSha}'}", as an array of paths relative to repo root (one path per array element).

Return: commitSha (full SHA, not abbreviated), filesChanged.`,
    { label: `commit:${story.id}`, model: 'sonnet', schema: COMMIT_SCHEMA },
  )

  const visible = isUserVisible(commit.filesChanged)
  if (visible) {
    const triggers = commit.filesChanged.filter((f) =>
      userVisiblePatterns.some((p) => p.test(f)),
    )
    checkpoints.push({
      storyId: story.id,
      title: story.title,
      commitSha: commit.commitSha,
      triggers,
    })
    log(`📱 MANUAL_REVIEW_RECOMMENDED ${story.id} — user-visible change in ${triggers.join(', ')}`)
  }

  completed.push({
    storyId: story.id,
    commitSha: commit.commitSha,
    userVisible: visible,
    findings: {
      spec: specReview,
      code: codeReview,
      adversarial,
    },
  })

  log(`✓ ${story.id} complete @ ${commit.commitSha.slice(0, 7)}`)
}
} catch (err) {
  haltError = err
}

phase('Wrap up')

if (haltError) {
  log(`⛔ Epic ${epicId} halted partway: ${completed.length}/${runnable.length} stories committed before the halt.`)
  for (const c of completed) {
    log(`  ✓ ${c.storyId} (${c.commitSha.slice(0, 7)})`)
  }
} else {
  log(`Epic ${epicId} complete: ${completed.length}/${runnable.length} runnable stories implemented (${skipped.length} pre-existing skipped).`)
}

if (checkpoints.length) {
  log(`Manual review recommended for ${checkpoints.length} user-visible stories:`)
  for (const cp of checkpoints) {
    log(`  • ${cp.storyId} (${cp.commitSha.slice(0, 7)}) — ${cp.title}`)
  }
  log(`Suggested: run the app, exercise each commit's changes, then mark stories done in ${sprintStatusPath}.`)
} else {
  log(`No user-visible changes detected — no manual review needed.`)
}

if (haltError) {
  log(`Halt reason: ${haltError.message}`)
}

return {
  epicId,
  attempt,
  storiesCompleted: completed,
  manualReviewCheckpoints: checkpoints,
  skipped: skipped.map((s) => ({ id: s.id, status: s.status })),
  halted: haltError ? { message: haltError.message } : null,
}
