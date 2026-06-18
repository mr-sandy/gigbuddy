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

## Everything else

See the global skill at `~/.claude/skills/epic-run/SKILL.md` for full behaviour: step list, model assignments, halt conditions, resume semantics, commit timing, watch-outs.

## The project-local workflow file

`.claude/workflows/epic-run.js` is a snapshot copy of the global script as of when this skill was lifted. The global is canonical — edits should go to `~/.claude/workflows/epic-run.js`. The project copy exists so the workflow keeps working if `~/.claude/` is unavailable; if it drifts, prefer the global.
