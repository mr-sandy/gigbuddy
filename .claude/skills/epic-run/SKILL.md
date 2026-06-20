---
name: epic-run
description: Autonomously execute every story in a BMad epic — create spec, review spec, implement, code-review, adversarial review, commit. GigBuddy-specific wrapper that pre-loads locked design constraints. Use when the user says "run epic N", "execute epic N", or "run the epic-run workflow for epic N".
---

# epic-run (GigBuddy)

Thin GigBuddy wrapper around the global `epic-run` workflow at `~/.claude/workflows/epic-run.js`. The canonical documentation lives at `~/.claude/skills/epic-run/SKILL.md`; this file only documents the GigBuddy-specific invocation.

## How to invoke

```
Workflow({
  scriptPath: '/Users/sandy/.claude/workflows/epic-run.js',
  args: {
    epicId: '3',
    lockedConstraints: [
      'Visual direction is locked — do not propose alterations to color, typography, or layout philosophy',
      'Sandy IS the user — skip persona ceremony concerns',
      'iOS PWA + Safari cookie sharing pattern is intentional',
    ],
    // userVisiblePatterns defaults match GigBuddy's web/ layout — no override needed
  }
})
```

On resume after a halt:

```
Workflow({
  scriptPath: '/Users/sandy/.claude/workflows/epic-run.js',
  resumeFromRunId: '<prior runId>',
  args: { epicId: '3', attempt: 2, lockedConstraints: [...same as above...] }
})
```

## What's GigBuddy-specific here

- **`lockedConstraints`**: the three design decisions above are locked per Sandy's project memory (`project_visual_direction_locked`, `feedback_skip_persona_ceremony`, `project_ios_pwa_safari_cookie_jar`). Always pass them — the global workflow defaults to an empty array.
- **`userVisiblePatterns`**: the global workflow's defaults are already tuned for the GigBuddy `web/` layout, so no override is needed from gigbuddy.
- **One commit per story — never bundle.** Each story's commit must contain ONLY that story's files. The commit subject is `Implement story X.Y: <title>`. If the working tree carries any uncommitted changes when a story is about to start, the workflow halts and asks the user to verify and commit prior work — bundled commits destroy `git log` archaeology and were the Epic 3 retro's #1 finding. The project snapshot at `.claude/workflows/epic-run.js` enforces this with a pre-flight check; **prefer the project snapshot over the global for GigBuddy runs** until the constraint lands in the global.

## How to invoke (with the GigBuddy-permanent constraint enforced)

```
Workflow({
  scriptPath: '/Users/sandy/dev/gigbuddy/.claude/workflows/epic-run.js',
  args: { epicId: '4', lockedConstraints: [...] }
})
```

Note the path is the project snapshot, not the global. The wrapper's example above (referencing `~/.claude/workflows/epic-run.js`) is the fallback shape if the project snapshot is unavailable; if you fall back, you MUST manually verify `git status --porcelain` is clean between stories.

## Everything else

See the global skill at `~/.claude/skills/epic-run/SKILL.md` for full behaviour: step list, model assignments, halt conditions, resume semantics, commit timing, watch-outs.

## The project-local workflow file

`.claude/workflows/epic-run.js` started as a snapshot copy of the global script. It now carries one GigBuddy-permanent guard (pre-flight clean-tree check at story start) that the global lacks. For GigBuddy runs, **prefer the project snapshot**. If the snapshot drifts further from the global in non-guard areas, sync those areas back from the global while preserving the guard.
