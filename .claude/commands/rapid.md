# Glyph Rapid - Batch Feedback → Parallel Fixes → Deploy → Verify

**No barriers. Rapid iteration. Ship fast.**

## Usage

```bash
/rapid                           # Interactive: paste feedback
/rapid "Fix X, improve Y, add Z" # Inline feedback
/rapid --verify-only             # Just test production
/rapid --status                  # Check active work
```

## How It Works

```
FEEDBACK IN → PARSE → PRIORITIZE → PARALLEL AGENTS → FIX → DEPLOY → VERIFY → REPORT
     ↑                                                                    |
     └────────────────────── Next iteration ──────────────────────────────┘
```

## Orchestrator Instructions

You are the rapid development orchestrator for Glyph. Your job: **turn feedback into shipped fixes as fast as possible.**

### Phase 0: Load Context (MANDATORY)

**Before parsing feedback, read `.claude/USER_DECISIONS.md`**

This file contains:
- **DO NOT ADD**: Features explicitly forbidden (Stripe styling, confetti, lying time estimates)
- **MUST KEEP**: Features that must not be removed
- **FOCUS AREAS**: P0/P1/P2 priorities

**When parsing issues, REJECT any that violate USER_DECISIONS.**

### Phase 1: Ingest & Parse (< 1 minute)

When you receive feedback, parse it into discrete issues:

```markdown
## Parsed Issues

| # | Type | Issue | Priority | Parallelizable |
|---|------|-------|----------|----------------|
| 1 | bug | [description] | P0 | yes |
| 2 | ux | [description] | P1 | yes |
| 3 | feature | [description] | P2 | depends on #1 |
```

**Types:**
- `bug` - Something is broken (P0)
- `ux` - Friction, confusion, ugliness (P1)
- `feature` - Missing capability (P2)
- `polish` - Nice-to-have refinement (P3)

**Priority Rules:**
- P0: Demo is broken, embarrassing, or unusable
- P1: Noticeably degrades experience
- P2: Would make it significantly better
- P3: Cherry on top

### Phase 2: Parallel Agent Dispatch

Spawn agents for ALL parallelizable issues simultaneously:

```javascript
// Spawn in ONE message with multiple Task tool calls
Task({ agent: "developer", prompt: "Fix issue #1: ..." })
Task({ agent: "developer", prompt: "Fix issue #2: ..." })
Task({ agent: "developer", prompt: "Fix issue #3: ..." })
// All run in parallel
```

**Agent Prompt Template:**

```markdown
## Glyph Rapid Fix: [Issue Title]

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

**Issue:** [Description]

**Type:** [bug/ux/feature/polish]

**Fix Requirements:**
1. Identify the root cause / location
2. Implement the minimal fix
3. Test locally if possible
4. DO NOT commit - orchestrator handles that

**Key Files (likely relevant):**
- Landing/Demo: www/index.html
- API routes: api/src/routes/*.ts
- AI service: api/src/services/ai.ts
- Guardrails: api/src/services/guardrails.ts
- SDK component: sdk/src/components/GlyphEditor.ts

**Return Format:**
{
  "status": "fixed" | "blocked" | "needs_clarification",
  "files_modified": ["path/to/file.ts"],
  "changes_summary": "Brief description",
  "test_instructions": "How to verify this works",
  "blockers": null | "description of blocker"
}
```

### Phase 3: Collect & Commit

After agents complete:

1. Review all changes for conflicts
2. Stage all modified files
3. Create single commit with all fixes:

```bash
git add -A
git commit -m "rapid: Fix [N] issues from feedback batch

$(for each issue: - [type] [description])

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Phase 4: Deploy

```bash
git push origin main
# Railway auto-deploys in ~2-3 minutes
```

Wait for deployment, then proceed to verification.

### Phase 5: Production Verification

Spawn @qa-agent to verify ALL fixes on production:

```markdown
## Production Verification Task

**URL:** https://glyph.you

**Verify Each Fix:**
| Issue | Expected | Actual | Status |
|-------|----------|--------|--------|
| #1 | [expected behavior] | [what you observed] | PASS/FAIL |
| #2 | ... | ... | ... |

**Test the Core Demo Flow:**
1. Page loads without console errors
2. Preview renders immediately
3. Instant actions work (watermark, QR code, grouping - should be <1s)
4. Mobile 375px - preview visible and usable
5. Self-check passes (check console for "[Glyph] Self-check passed")
6. No localhost:3000 errors

**USER_DECISIONS Compliance Check:**
- NO "Stripe styling" button exists
- NO confetti animation exists
- Time estimates are honest (~45-60s for AI, not <30s)

**Use Agent Browser CLI:**
```bash
agent-browser open https://glyph.you
agent-browser snapshot -i
# Test interactions
agent-browser screenshot
```

**Return Format:**
{
  "overall": "PASS" | "FAIL",
  "issues_verified": N,
  "issues_passed": N,
  "issues_failed": N,
  "failures": [{ "issue": "#", "expected": "...", "actual": "..." }],
  "demo_flow": "PASS" | "FAIL",
  "screenshots": ["path/to/screenshot.png"]
}
```

### Phase 6: Report & Iterate

**If ALL PASS:**
```markdown
## Rapid Cycle Complete ✓

**Feedback Processed:** [N] issues
**Fixed & Deployed:** [N] issues
**Production Verified:** ALL PASS

**Changes Shipped:**
- [Issue 1]: [summary]
- [Issue 2]: [summary]

**Live at:** https://glyph.you

Ready for next feedback batch.
```

**If ANY FAIL:**
```markdown
## Rapid Cycle: [N] Issues Need Attention

**Passed:** [N]
**Failed:** [N]

**Failures:**
| Issue | Problem | Next Step |
|-------|---------|-----------|
| #X | [what failed] | [suggested fix] |

**Options:**
1. Fix failures and re-deploy (recommended)
2. Rollback: `git revert HEAD && git push`
3. Continue with partial success

What would you like to do?
```

---

## Critical Rules

### 1. Speed Over Perfection
- Ship fast, iterate fast
- Don't over-engineer fixes
- Minimal viable fix, then move on

### 2. Parallel Everything
- If issues don't depend on each other, fix them in parallel
- Never wait for one fix to start another independent fix

### 3. Always Verify Production
- Local testing is not enough
- The demo on production is the only thing that matters

### 4. No Barriers
- Don't ask for permission to fix obvious issues
- Don't create PRs - push directly to main
- Don't wait for approval - ship and verify

### 5. Context Preservation
- Keep a running log in `/Users/eddiesanjuan/Projects/glyph/.claude/rapid-log.md`
- Each cycle appends to the log
- Enables learning from past fixes

### 6. Respect USER_DECISIONS
- NEVER add items on the DO NOT ADD list
- NEVER remove items on the MUST KEEP list
- If feedback asks for something forbidden, REJECT with reason

### 7. Update Learnings
- After each cycle, update `.claude/AUDIT_LEARNINGS.md` with:
  - New patterns that worked
  - Anti-patterns discovered

---

## State File

Persist state to `/Users/eddiesanjuan/Projects/glyph/.claude/rapid-state.md`:

```markdown
# Glyph Rapid State

## Current Cycle
- Started: [timestamp]
- Phase: [1-6]
- Issues: [N] total, [N] fixed, [N] pending

## Active Agents
- [agent-id]: [issue description] - [status]

## Recent Cycles
| Cycle | Issues | Fixed | Deployed | Verified |
|-------|--------|-------|----------|----------|
| 1 | 5 | 5 | ✓ | ✓ |
```

---

## Example Session

**Input:**
```
The demo feels slow. The quick action buttons look cramped.
Add a "download PDF" button that's more prominent.
The footer links are broken.
```

**Parsed:**
| # | Type | Issue | Priority |
|---|------|-------|----------|
| 1 | ux | Demo feels slow (loading/response time) | P1 |
| 2 | ux | Quick action buttons look cramped | P1 |
| 3 | feature | Add prominent download PDF button | P2 |
| 4 | bug | Footer links broken | P0 |

**Execution:**
- Spawn 4 developer agents in parallel
- All fix their issues
- Commit all changes in one commit
- Push to main
- Railway deploys
- QA agent verifies production
- Report results

**Output:**
```
Rapid Cycle Complete ✓

4 issues processed, 4 fixed, deployed, verified.

Changes:
- [bug] Fixed footer links (href targets were wrong)
- [ux] Added loading skeleton and optimized preview render
- [ux] Increased button padding and spacing
- [feature] Added prominent Download PDF button in toolbar

Live at: https://glyph.you
```

---

## Related Commands

| Command | When to Use |
|---------|-------------|
| `/rapid` | Quick batch fixes from feedback |
| `/addiction-audit` | Thorough audit with verification and learning |
| `/addiction-audit --quick` | Verify-only, no fixes |

**After multiple rapid cycles**, run `/addiction-audit` to:
- Verify everything is still working
- Update VERIFIED_STATE.md with evidence
- Add learnings to AUDIT_LEARNINGS.md
- Check for any regressions

---

## BEGIN

Parse the feedback provided, then execute the rapid cycle.

**Arguments:** $ARGUMENTS
