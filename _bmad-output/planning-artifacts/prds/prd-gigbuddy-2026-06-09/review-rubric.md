# PRD Quality Review — GigBuddy

## Overall verdict

A strong, opinionated personal-tool PRD. The author has internalized the brief's principles and converted them into a tight capability contract: FRs are testable, the Performance/Practice split is defended as data not display, Non-Goals do real work, and pointer-style delegation to DESIGN.md / EXPERIENCE.md is used deliberately — the PRD names what those documents own and refuses to re-author them. Shape fit is unusually good for the BMad PRD template: the document admits it is a single-operator tool and trims UJs, success metrics, and persona ceremony accordingly without going hobby-shallow. The main risks are confined and addressable: one open NFR back-off detail flagged for PM, two thin spots in operational floor (no explicit constraint on data-loss recovery objective; deploy-window rule is calendar-locked but not enforceable from the PRD alone), and a small handful of glossary/cross-reference cleanups. Nothing here would mislead or block a downstream architect or story author. Recommendation: **PASS-WITH-FIXES** — finalize after addressing the medium notes; the lows can be swept later.

## Decision-readiness — strong

The PRD names its decisions and stands by them. The hardest live tensions are surfaced with explicit rationale rather than smoothed:

- FR-21 commits to "`NEXT ›` becomes inert on the last Song; no `End performance ›` button" and explains the safety rationale (preventing accidental termination via the advance gesture). This is the kind of trade-off PRDs usually dodge.
- FR-5 closes with an unusually direct prohibition: "Implementations must not satisfy FR-5 by storing one document with display rules and a 'show full / show abridged' toggle; the fields are distinct content." A downstream architect cannot misread this.
- §1 Vision §3 final paragraph forecloses a likely-tempting implementation: "a 'view mode toggle' inside one surface would defeat the design." This is decision-as-prose, not buried in considerations.
- Open Questions are genuinely open (or marked resolved with a strikethrough + date + rationale). The mechanism for FR-27 (access gate) and FR-29 (data store) are honestly deferred to Architecture rather than half-answered.
- SM Counter-metrics (SM-C1–C4) name what *not* to optimize. SM-C4 ("do not add settings or toggles to satisfy 'what if I want to also...' cases") is a real constraint on downstream PRs.

The `[NOTE FOR PM]` at FR-18 (Wake Lock back-off strategy) is the only deferred decision the PRD itself owns; everything else is either resolved or punted to Architecture with the contract intact.

### Findings
- **low** Single `[NOTE FOR PM]` left dangling (§4.3 FR-18) — "back-off strategy is implementation detail" reads as half-resolved: the PM note appears in a Feature-specific NFR but the body of FR-18 already says reacquisition happens "on every foreground transition and after any detected release event," which arguably *is* the strategy. *Fix:* either resolve the note (state explicit minimum interval, e.g. ≥1s between attempts on persistent failure) or move it to §8 Open Questions so it shows up in the open-items count.

## Substance over theater — strong

Almost no furniture. Specific evidence:

- §2.1 Jobs To Be Done are sharp and product-specific. "Capture per-gig context without dirtying the canonical song record" with concrete examples ("Ivan on solo tonight," "vocal tonight?", "guitar change after the bridge") drives FR-11 directly. None of these JTBDs are interchangeable with another product.
- §1 Vision is product-specific: "the moment when the band counts in," "an iPhone resting on top of the Nord," the explicit refusal of "view mode toggle inside one surface." None of this swaps into a generic music-app PRD.
- No persona section — appropriate, given Sandy is the sole user. The PRD does not invent a "Sandy Persona" panel to look thorough.
- NFRs (§A.1) carry product-specific numeric thresholds (150ms transitions, 300ms cold render, 500ms paste-to-parse) tied to the brief's "anything that slows reading or navigation under live conditions is a defect" principle. Not boilerplate.
- The "Sacred state" framing of Performance Mode (§4.3) is opinionated and load-bearing; it justifies single-tap, no swipe, no `End performance ›` button, no toasts. The substance earns its rhetorical weight.

No findings.

## Strategic coherence — strong

The PRD has a clear thesis with two prongs: (1) prep and performance are different surfaces, not view modes; (2) the V1 data model must be V2-ready so future analytics need no migration. Every feature serves at least one prong:

- 4.1–4.2 (Library, Setlist Management) — prep surface.
- 4.3 (Performance Mode) — performance surface.
- 4.5 (Multi-Band data model), 4.7 (Persistence), FR-29's "Setlist history is preserved in full from day one" — V2-readiness.
- 4.6 (Access Control), 4.8 (Backup) — survivability ("trust the tool on gig night").

Success Metrics validate the thesis rather than measure activity: SM-1 ("the Apple-Notes pre-gig compile workflow is gone") validates the prep prong; SM-3 ("readable in a dim bar") validates the performance prong; SM-5 (one gig night with no critical failure) validates survivability. The counter-metrics name the failure modes coherently.

MVP scope kind is consistent: problem-solving tool for one operator, not platform or experience.

No findings.

## Done-ness clarity — adequate, leaning strong

FRs uniformly carry a **Consequences (testable)** block, and most consequences are checkable in code or with manual verification. Spot-check:

- FR-2: "A blur or tap-outside commits the change; rapid input is debounced" — testable (events fire, debounce window observable).
- FR-7: "Matched rows display `✓` + the canonical Library title" — testable (DOM assertion).
- FR-17: "Transitions complete in under 150ms; `prefers-reduced-motion` collapses them to instant" — testable (performance instrumentation).
- FR-18: Wake Lock acquisition / release / reacquisition / state-indicator visibility — all testable.
- FR-22: "OS backgrounding the app does not advance, retreat, or reset the Song index" — testable.

Where the PRD softens, it does so honestly: FR-31's "Performance Mode is never blocked by a sync error" is a strong claim, and the consequence "A Performance Mode session can run end-to-end offline (the Setlist and its Songs are cached on entry)" is checkable. No "user-friendly" or "graceful" adjectives smuggle requirements past the reader.

Two thin areas worth surfacing:

### Findings
- **medium** FR-34 Automated backup lacks a stated recovery-time / data-loss objective (§4.8 FR-34) — "a successful backup occurs at least once per 24-hour period" and "a documented restore procedure exists and has been verified end-to-end at least once before V1 ships" are good, but there is no statement of acceptable data loss (e.g., "loss of up to 24 hours of edits is tolerable; loss of any Setlist record older than that is not") or how long a restore can take before it stops being useful. *Fix:* add one sentence to FR-34 stating the maximum tolerable data-loss window (likely ≤24h given daily cadence) and that restore must complete within a working session (not days). This lets Architecture pick mechanism with the contract intact.
- **medium** Operational floor §A.2 deploy-window rule is calendar-locked but not enforceable from the PRD (§A.2) — "routine maintenance ... must not be scheduled during weekend evenings (Friday through Sunday, ~18:00–24:00 local)" is a strong rule but a downstream story author has nowhere to attach this as an FR. Currently it's an NFR floating in §A. *Fix:* either (a) add a sentence noting Architecture/CI is responsible for the enforcement mechanism, or (b) elevate to an explicit operational requirement tied to release process documentation. Today's gig calendar is also implicit — the rule is calendar-derived, but no FR points at "Sandy's gig calendar is the source of truth for blackout windows." A note that the rule is heuristic (weekend evenings) and not calendar-derived would close the gap.
- **low** FR-13 "Currently performing" strip cross-reference is asymmetric — FR-13 references "FR-19" for the strip but the strip's own definition is FR-20, not FR-19. *Fix:* change FR-13's reference from "(per FR-19)" to "(per FR-20)." Minor but the reviewer should catch it.

## Scope honesty — strong

This is one of the PRD's strongest dimensions. The §5 Non-Goals list is unusually disciplined: each line names a concrete thing the product will not do, with rationale where the absence might be misread (e.g., "Provide a 'Ready to perform' gate. Every Setlist is performable; the user decides readiness."). §6.2 distinguishes V2+ commitments from conditional later-additions, which most PRDs blur.

`[ASSUMPTION]` tags are used sparingly (only two: data store choice and backup mechanism), which is appropriate — most other deferrals are explicit Open Questions or Architecture punts. The Assumptions Index §9 roundtrips cleanly.

`[NOTE FOR PM]` count: one, at FR-18. Low for a 34-FR document, appropriate to the stakes.

Open Questions §8: 10 entries, 3 resolved with strikethrough + date. The resolved entries preserve the decision history rather than being silently deleted — good practice.

No findings.

## Downstream usability — adequate

The PRD is explicitly written for downstream workflows (§0 Document Purpose). FR/UJ/SM IDs are contiguous (FR-1 through FR-34, UJ-1 through UJ-4, SM-1 through SM-5, SM-C1 through SM-C4) and cross-references mostly resolve. Glossary §3 is rich and used verbatim throughout the FRs (Library, Setlist, Section, Performance Card, Patch, etc.). The "Practice Mode / Performance Mode" capitalization is consistent.

UJs each have Sandy as the named protagonist with concrete time-and-place context — appropriate.

### Findings
- **medium** UJ-realizes map is incomplete in two places (§4 feature descriptions) — §4.1 says "Realizes UJ-3, UJ-4" but UJ-3 is also realized by 4.2 (which correctly claims it). §4.2 description says "Realizes UJ-1, UJ-3" — UJ-1 is realized by 4.3 and 4.4, not 4.2 (UJ-1 is the load-in flow that ends in `Start performance ›`). Some FRs in 4.2 do touch UJ-1 (FR-13 has the iPhone CTA) but the description-level mapping is loose. *Fix:* tighten the "Realizes" line on each feature header — small change, prevents a story author from picking the wrong feature when sourcing from a UJ.
- **low** FR-21 references "the `End performance ›` button" twice — once to say it doesn't exist, once in the rationale ("the user must not be able to terminate Performance state with the same gesture they use to advance Songs"). A story author searching the PRD for `End performance` would find these and could be momentarily confused about whether the button exists. *Fix:* keep both — but add a one-word qualifier on the second mention, e.g. "(absent) `End performance ›` button" or rephrase the rationale to not name the absent control. Optional.
- **low** Glossary term "Gig" vs. "Setlist" usage is mostly clean but FR-14 and FR-23 alternate between "Setlist whose Gig date equals today" and "Gig dated today" within two paragraphs. Both readings are correct (Setlist has Gig metadata via FR-6), but a strict glossary-only renderer would catch this. *Fix:* pick one phrasing — recommend "Setlist whose Gig date equals today" since the surface lists Setlists, not Gigs.

## Shape fit — strong

The PRD correctly identifies itself as a single-operator capability spec and shapes accordingly:

- UJs are present but trimmed to four flows, each mirroring a key flow in EXPERIENCE.md by reference rather than re-narration.
- No persona section — appropriate.
- Success Metrics are operational and qualitative (SM-1 "Apple-Notes workflow is gone"; SM-5 "one gig night with no critical failure"), not market-facing.
- Pointer-style delegation to DESIGN.md and EXPERIENCE.md is principled (§0 declares it, §C re-declares it, individual FRs cite specific sub-sections of EXPERIENCE.md, e.g. "per EXPERIENCE.md State Patterns"). This is the right shape for a chain-top PRD that has UX upstream.
- Brownfield concerns don't apply (greenfield).

No findings.

## Mechanical notes

- **Glossary drift:** Minor — "Gig" vs. "Setlist" alternation in FR-14/FR-23 (see Downstream usability low finding). All other domain nouns (Library, Section, Patch, Chord chart, Performance Card, Wake Lock, Paste-to-parse) used identically across the document.
- **ID continuity:** Clean. FR-1 → FR-34 contiguous, no gaps or duplicates. UJ-1 → UJ-4, SM-1 → SM-5, SM-C1 → SM-C4 all contiguous.
- **Cross-references:** One broken reference — FR-13 cites "per FR-19" for the "Currently performing" strip; the strip is actually defined in FR-20. (See Done-ness clarity low finding.) All other cross-references checked (§4.2 FR-9 inline-creation reference, FR-15 → FR-22 → FR-18 reacquisition chain, FR-19 → FR-20 → FR-21 lifecycle chain, FR-29 → FR-31 sync floor, FR-27 → FR-28 access) resolve cleanly.
- **Assumptions Index roundtrip:** Clean. Both `[ASSUMPTION]` tags (FR-29 data store, FR-34 backup) appear in §9; §9 contains no entries without inline appearance.
- **UJ protagonist naming:** Each UJ has Sandy as the named protagonist with concrete time/place context (Saturday 8:55 PM, Tuesday evening kitchen table, Sunday morning post-gig).
- **Required sections:** All present and shape-appropriate (Vision, Target User, Glossary, Features, Non-Goals, MVP Scope, Success Metrics, Open Questions, Assumptions Index, Cross-cutting NFRs, Platform, Aesthetic-IA reference).
- **`[NOTE FOR PM]` count:** 1 (FR-18 back-off strategy). Low and appropriate.
- **Open-items density:** 10 Open Questions (3 resolved with strikethrough), 2 indexed `[ASSUMPTION]`s, 1 `[NOTE FOR PM]`. Healthy for a green-light-to-build personal-tool PRD.

## Tally

| Dimension | Verdict |
|---|---|
| Decision-readiness | strong |
| Substance over theater | strong |
| Strategic coherence | strong |
| Done-ness clarity | adequate (leaning strong) |
| Scope honesty | strong |
| Downstream usability | adequate |
| Shape fit | strong |

**Findings by severity:** 0 critical · 0 high · 3 medium · 4 low.

**Suggested overall verdict:** PASS-WITH-FIXES. The medium findings (FR-34 data-loss objective, §A.2 deploy-window enforceability hook, UJ-realizes mapping) are worth sweeping before handoff to Architecture / story creation. The lows can be batched or deferred without risk to downstream work.
