# Addiction Audit v2

Thorough, learning audit system. Takes as long as needed. Quality over speed.

## Usage

```bash
/addiction-audit              # Full audit cycle
/addiction-audit --quick      # Verify-only (no fixes)
/addiction-audit --focus ai   # Focus on AI-First dimension
```

---

## ABSOLUTE RULE: ORCHESTRATOR NEVER DOES WORK

**YOU ARE A COORDINATOR. EVERY action requires a sub-agent. NO EXCEPTIONS.**

This is not optional. This is not flexible. Violating this rule will fill your context and cause failures.

### What You MAY Do Directly
- Read/write files in `.claude/` directory ONLY
- Synthesize agent outputs
- Make prioritization decisions
- Update todo list

### What You MUST Delegate

| Action | Agent | Prompt Pattern |
|--------|-------|----------------|
| Explore code | `subagent_type=Explore` | "Find X in codebase" |
| Check URLs | `subagent_type=qa-agent` | "Verify these URLs return 200" |
| Test UI/UX | `subagent_type=auditor` | "Browser test X with Playwright" |
| Write code | `subagent_type=developer` | "Implement X, commit, push" |
| Verify fixes | `subagent_type=qa-agent` | "Test X works in production" |

### RED FLAGS - If You Think These, STOP

| Thought | Reality |
|---------|---------|
| "Let me just quickly grep for..." | NO. Spawn Explore agent. |
| "I'll check this URL with curl..." | NO. Spawn QA agent. |
| "Let me read this file to understand..." | NO (unless .claude/). Spawn Explore. |
| "I'll just make this small edit..." | NO. Spawn developer. |
| "Let me take a quick screenshot..." | NO. Spawn auditor. |

---

## STATE FILES

The audit uses THREE state files (all in `.claude/`):

| File | Purpose | You May |
|------|---------|---------|
| `USER_DECISIONS.md` | Sacred user choices - NEVER violate | Read only |
| `AUDIT_LEARNINGS.md` | Patterns, anti-patterns, what we learned | Read/write |
| `VERIFIED_STATE.md` | What's ACTUALLY working (with evidence) | Read/write |

**Read all three at start of every cycle.**

---

## THE CYCLE

### Phase 0: Load Context (you do this directly)

Read these files:
1. `.claude/USER_DECISIONS.md` - forbidden/required items
2. `.claude/AUDIT_LEARNINGS.md` - patterns/anti-patterns
3. `.claude/VERIFIED_STATE.md` - current known state

**Create mental checklist:**
- DO NOT ADD: [list from USER_DECISIONS]
- MUST KEEP: [list from USER_DECISIONS]
- FOCUS AREAS: [P0, P1, P2 from USER_DECISIONS]
- KNOWN GAPS: [from VERIFIED_STATE]
- ANTI-PATTERNS TO AVOID: [from AUDIT_LEARNINGS]

---

### Phase 1: Deep Verification (spawn qa-agent)

```
Task tool with subagent_type="qa-agent":

## Deep Verification Audit

Verify EVERY claim. Trust nothing. Use actual HTTP requests and browser tests.

### URL Verification
For each URL, run: curl -s -o /dev/null -w "%{http_code}" [URL]

Required URLs:
- https://glyph.you
- https://docs.glyph.you
- https://docs.glyph.you/integrations/mcp-server
- https://docs.glyph.you/integrations/airtable
- https://docs.glyph.you/integrations/zapier
- https://docs.glyph.you/integrations/webhooks
- https://dashboard.glyph.you
- https://api.glyph.you/health

Also check any links IN the hero section - click them, verify they work.

### Feature Verification (use Playwright browser tools)
Test each feature, record ACTUAL response time with stopwatch:
- Watermark instant action (should be <1s)
- QR code instant action (should be <1s)
- Grouping instant action (may not exist - record if missing)
- Custom AI modification (type something, record actual seconds)
- PDF download button

### Visual Verification (screenshots required for EACH)
Take named screenshots:
- verify-01-landing-desktop-1280.png
- verify-02-landing-mobile-375.png
- verify-03-docs-light-mode.png
- verify-04-docs-dark-mode.png
- verify-05-docs-search-light.png
- verify-06-docs-search-dark.png
- verify-07-dashboard.png

Check each for:
- Text contrast (can you read ALL text?)
- Branding consistency (same colors everywhere?)
- Theme switching (modals/inputs adapt?)

Return structured report:
- URL status table (URL | HTTP code | Notes)
- Feature status table (Feature | Status | Response time | Notes)
- Visual status table (Screenshot | Contrast | Branding | Theme | Notes)
- List of VERIFIED issues (not assumed - you saw them)
```

---

### Phase 2: Score Dimensions (spawn auditor)

```
Task tool with subagent_type="auditor":

## Dimension Scoring Audit

Use Playwright browser tools to thoroughly test. Score each dimension 0-10.

### 1. AI-First Developer Discovery (35% weight)
Test as if you're an AI assistant helping a developer integrate Glyph:
- Go to docs.glyph.you - can you find MCP setup in <30 seconds?
- Is there a "tell your AI this" or "for AI assistants" section?
- Click the MCP docs link - does it work?
- Is documentation structured for AI consumption?

Score 0-10 with specific evidence.

### 2. SDK Integration & End User UX (45% weight)
Test as an end user trying the demo:
- Go to glyph.you - first impression (screenshot)
- Try each quick action button - time them
- Test mobile at 375px - is it usable?
- Try a custom AI request - does it complete or timeout?
- Check visual polish - fonts, spacing, loading states

Score 0-10 with specific evidence.

### 3. Low-Code/Airtable Integration (20% weight)
Test as a non-developer:
- Find Airtable docs - are they complete?
- Find Zapier/Make docs - do they exist?
- Could you set this up without writing code?

Score 0-10 with specific evidence.

**MANDATORY Checks (do not skip):**
- [ ] Clicked every navigation link
- [ ] Tested both light AND dark mode in docs
- [ ] Tested at 1280px AND 375px viewport
- [ ] Timed at least one AI operation
- [ ] Verified search modal in both themes

Return:
- Dimension scores with evidence
- Top 5 issues found (with dimension affected)
- Weighted total score
```

---

### Phase 3: Filter & Prioritize (you do this directly)

From Phase 1 and 2 outputs:

**Step 1: Filter against USER_DECISIONS.md**
- Remove any suggestion on DO NOT ADD list
- Flag any suggestion that would remove MUST KEEP items
- Reject and note: "Rejected [X] - USER_DECISIONS violation"

**Step 2: Cross-reference AUDIT_LEARNINGS.md**
- Check proposals against known anti-patterns
- Apply learnings from previous cycles

**Step 3: Prioritize by FOCUS AREAS**
- P0 items first (from USER_DECISIONS)
- Then by dimension score (fix lowest dimension first)
- Then by addiction impact

**Step 4: Select top 3-5 fixes**

Before proceeding, verify each selected fix:
- [ ] Not on DO NOT ADD list
- [ ] Doesn't remove MUST KEEP items
- [ ] Aligns with FOCUS AREAS
- [ ] Avoids known anti-patterns

---

### Phase 4: Fix (spawn developer - ONE AT A TIME)

For each prioritized fix, spawn separately and WAIT for completion:

```
Task tool with subagent_type="developer":

## Fix: [Issue Title]

Working Directory: /Users/eddiesanjuan/Projects/glyph
Priority: [P0/P1/P2]
Dimension: [AI-First | SDK/UX | Low-Code]

### Problem
[Specific description from audit]

### Solution
[What to implement]

### USER_DECISIONS Compliance
This fix does NOT:
- Add: Stripe styling button, confetti, lying time estimates
- Remove: Instant actions, grouping demo, honest labels

### Verification After Implementation
- [Specific test to run]
- [Expected result]

### Requirements
- Implement the fix completely
- Test it locally if possible
- Commit with descriptive message
- Push to main (Railway auto-deploys in ~2-3 min)
- Report what was done and verification result
```

**CRITICAL: Wait for each fix to complete before starting next.**

---

### Phase 5: Verify All Fixes (spawn qa-agent)

```
Task tool with subagent_type="qa-agent":

## Post-Fix Verification

Wait 3 minutes for Railway deployment, then verify.

Production URLs:
- https://glyph.you
- https://docs.glyph.you
- https://dashboard.glyph.you

### Fixes to Verify
[List each fix with expected behavior]

### Regression Suite
Run these checks:
- Landing page loads without console errors
- Instant actions work: watermark (<1s), QR code (<1s)
- Grouping instant action (if implemented)
- Mobile 375px - preview visible and usable
- Docs readable in light mode (text contrast)
- Docs readable in dark mode
- Search modal themes correctly (both modes)
- Dashboard loads and matches branding

### USER_DECISIONS Compliance Check
Verify these DO NOT exist:
- "Stripe styling" button anywhere
- Confetti animation anywhere
- Time estimates that say <30s for AI operations

Take screenshot evidence for each check.

Return PASS/FAIL table with evidence.
```

---

### Phase 6: Validate & Learn (you do this directly)

**Step 1: Validate no violations**
- Check QA results for any USER_DECISIONS violations
- If violation found: spawn developer to revert immediately

**Step 2: Update VERIFIED_STATE.md**
- Update URL status
- Update feature status
- Update visual status
- Record what changed this cycle

**Step 3: Update AUDIT_LEARNINGS.md**
- Add new patterns that worked
- Add anti-patterns discovered
- Record any user preferences learned

**Step 4: Calculate new scores**
Based on verification results, update dimension scores.

---

### Phase 7: Output Summary (you do this directly)

Format your output:

```
## AUDIT COMPLETE - Cycle [N]

**Score**: X.XX/10 (previous: Y.YY, delta: +/-Z.ZZ)

### Dimension Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| AI-First | X/10 | 35% | X.XX |
| SDK/UX | X/10 | 45% | X.XX |
| Low-Code | X/10 | 20% | X.XX |

### Verified Working
- [item] - evidence: [screenshot/test result]

### Fixed This Cycle
- [commit] - [description]

### Rejected (USER_DECISIONS)
- [item] - reason: [which rule violated]

### Remaining Gaps (for next cycle)
- P0: [gap]
- P1: [gap]
- P2: [gap]

### Learnings Added
- Pattern: [what worked]
- Anti-pattern: [what to avoid]
```

**Then STOP. Do not continue or ask questions.**

---

## Dimension Targets

| Dimension | Weight | Target |
|-----------|--------|--------|
| AI-First Developer Discovery | 35% | 9.5/10 |
| SDK Integration & End User UX | 45% | 10/10 |
| Low-Code/Airtable Integration | 20% | 9.5/10 |

**Goal: 9.85/10 weighted score**

---

## Quick Mode (--quick flag)

Skip Phase 4 (fixes). Only verify and report current state.

Useful for:
- Checking production status
- Post-deployment verification
- Before starting new work

---

## Focus Mode (--focus flag)

`--focus ai` - Prioritize AI-First dimension issues
`--focus sdk` - Prioritize SDK/UX dimension issues
`--focus lowcode` - Prioritize Low-Code dimension issues

Affects Phase 3 prioritization weighting.

---

**Arguments:** $ARGUMENTS
