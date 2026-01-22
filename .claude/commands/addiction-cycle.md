# Single Addiction Audit Cycle

Run ONE complete audit cycle with full visibility. Use this to observe exactly what's happening.

## Usage

```bash
/addiction-cycle              # Run one cycle
/addiction-cycle --focus ai   # Focus on AI-First dimension
/addiction-cycle --focus sdk  # Focus on SDK/UX dimension
/addiction-cycle --focus lowcode  # Focus on Low-Code dimension
```

---

## ABSOLUTE RULE: YOU ARE A COORDINATOR, NOT A WORKER

**EVERY action requires spawning an agent via Task tool. NO EXCEPTIONS.**

This preserves your context for the full cycle. Agents do heavy lifting.

| Action | Agent | Why |
|--------|-------|-----|
| Read/explore code | `subagent_type=Explore` | Preserves YOUR context |
| Browse website/UX testing | `subagent_type=auditor` | They have Playwright |
| Write/edit any code | `subagent_type=developer` | They handle git too |
| Verify on production | `subagent_type=qa-agent` | They test thoroughly |
| Competitive research | `subagent_type=auditor` | Web access |

**RED FLAGS - If you're about to do these, STOP:**
- Use Grep/Glob/Read on application code → spawn Explore agent instead
- Use any Playwright/browser tools → spawn auditor agent instead
- Use Edit/Write on app code → spawn developer agent instead
- Run curl or test commands → spawn qa-agent instead

**You MAY directly:**
- Read/write `.claude/addiction-audit-state.md`
- Read/write `plans/addiction-audit-progress.txt`
- Synthesize agent outputs
- Make prioritization decisions

---

## THE CYCLE

### Phase 0: Load User Decisions (MANDATORY - you do this)

**BEFORE ANYTHING ELSE**, read `.claude/USER_DECISIONS.md`

This file contains:
- **DO NOT ADD** list - features explicitly rejected by user
- **MUST KEEP** list - features that must not be removed
- **FOCUS AREAS** - user-defined priorities

**VIOLATION OF THIS FILE IS A CRITICAL FAILURE.**

If the auditor suggests adding something on the DO NOT ADD list:
- REJECT the suggestion
- Do NOT pass it to developer
- Note in logs: "Rejected [X] - USER_DECISIONS.md"

If you think a decision should be reconsidered:
- DO NOT make the change
- ASK THE USER explicitly
- Only proceed with explicit approval

---

### Phase 1: Reality Check (spawn auditor)

```
Task tool with subagent_type="auditor":

## Addiction Audit: Reality Check

Production URL: https://glyph.you
Docs URL: https://docs.glyph.you

Score these THREE dimensions (0-10 each):

### 1. AI-First Developer Discovery (35% weight)
- Can an AI assistant find and integrate Glyph easily?
- Are docs AI-readable?
- Is there a "tell your AI this" quick-start?
- Would "add Glyph to my app" work in 60 seconds?

### 2. SDK Integration & End User UX (45% weight)
- Does the demo feel magical?
- Are quick actions instant and impressive?
- Would end users love this?
- Does it feel native, not bolted-on?

**MANDATORY Visual Consistency Checks:**
- [ ] Text contrast: Is ALL text readable? (no gray on white, no light text on light bg)
- [ ] Cross-property branding: Do landing, docs, and dashboard look like same product?
- [ ] Component theming: Do modals/search/inputs adapt to light/dark mode?
- [ ] Color palette: Is the same palette used everywhere? (no purple in one place, blue in another)

### 3. Low-Code/Airtable Integration (20% weight)
- Can non-coders set this up?
- Is there Airtable documentation?
- Zapier/Make.com guidance?

**Test ALL properties:**
- https://glyph.you (landing)
- https://docs.glyph.you (docs - check light AND dark mode)
- https://dashboard.glyph.you (dashboard)

Use Playwright MCP tools to test each. Return dimension scores and top 3 blockers.
```

### Phase 2: Prioritize (you do this)

From auditor's output:
1. **FILTER against USER_DECISIONS.md** - reject any suggestion on DO NOT ADD list
2. Identify the LOWEST scoring dimension
3. Pick 1-3 issues with highest addiction impact
4. Cross-check against FOCUS AREAS - P0 before P1 before P2
5. Focus on what would make alternatives feel painful

**Before passing ANY fix to developer, verify:**
- [ ] Not on DO NOT ADD list
- [ ] Doesn't remove anything on MUST KEEP list
- [ ] Aligns with FOCUS AREAS priorities

### Phase 3: Fix (spawn developer)

For each prioritized issue:

```
Task tool with subagent_type="developer":

## Fix: [Issue Title]

Working Directory: /Users/eddiesanjuan/Projects/glyph
Dimension: [which dimension this affects]
Addiction Impact: [why fixing this matters]

[Description of what needs to be fixed]

Requirements:
- Fix the issue completely
- Commit with descriptive message
- Push to main (Railway auto-deploys)
```

### Phase 4: Verify (spawn qa-agent)

```
Task tool with subagent_type="qa-agent":

## Verify Addiction Audit Fixes

Production: https://glyph.you

Fixes to verify:
1. [Fix 1 description] - expected behavior
2. [Fix 2 description] - expected behavior

Also run regression:
- Landing page loads without errors
- Quick actions work (watermark, QR code - NOT Stripe styling)
- Mobile works at 375px

**USER_DECISIONS compliance check:**
- No "Stripe styling" button exists
- No confetti animation exists
- Instant actions are actually instant

Return PASS/FAIL for each.
```

### Phase 5: Validate Against User Decisions (you do this)

Before logging, verify no violations occurred:
- [ ] Nothing on DO NOT ADD list was added
- [ ] Nothing on MUST KEEP list was removed
- [ ] Work aligned with FOCUS AREAS

If a violation occurred:
1. Spawn developer to revert the violation
2. Note in logs: "REVERTED: [X] violated USER_DECISIONS.md"
3. Continue with logging

---

### Phase 6: Log (you do this)

Update `.claude/addiction-audit-state.md`:
- Increment cycle number
- Update dimension scores
- Calculate weighted total
- List remaining blockers
- **Note any USER_DECISIONS validations**

Append to `plans/addiction-audit-progress.txt`:
- What was fixed
- What was REJECTED (and why - reference USER_DECISIONS)
- New scores
- What's next

---

## Dimension Focus Mode

If `--focus` argument provided, emphasize that dimension:

**--focus ai**: Prioritize AI-First issues (MCP, docs discoverability, AI integration)
**--focus sdk**: Prioritize SDK/UX issues (demo, playground, visual polish)
**--focus lowcode**: Prioritize Low-Code issues (Airtable, Zapier, no-code friendliness)

---

## Target

**Goal: 9.85/10 weighted score**

| Dimension | Weight | Target |
|-----------|--------|--------|
| AI-First Developer Discovery | 35% | 9.5/10 |
| SDK Integration & End User UX | 45% | 10/10 |
| Low-Code/Airtable Integration | 20% | 9.5/10 |

---

## BEGIN

1. **Read `.claude/USER_DECISIONS.md`** - load forbidden/required items (Phase 0)
2. Read current state from `.claude/addiction-audit-state.md`
3. Run Phase 1 (auditor)
4. Prioritize based on output, **filtering against USER_DECISIONS** (Phase 2)
5. Run Phase 3 (developer) for 1-3 fixes
6. Run Phase 4 (qa-agent) to verify - includes USER_DECISIONS compliance check
7. Run Phase 5 (validate) - confirm no violations
8. Run Phase 6 (log) - update state and progress files
9. Output: CYCLE_COMPLETE with summary
10. **STOP IMMEDIATELY** - Do not continue after CYCLE_COMPLETE

**CRITICAL: After CYCLE_COMPLETE, you are DONE. Do not ask follow-up questions, do not suggest next steps, do not continue. The cycle is complete.**

**Arguments:** $ARGUMENTS
