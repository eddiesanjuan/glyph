# Addiction Audit - Developer Experience Deep Dive

**The only question that matters: Would a developer who tried Glyph ONCE want to use it for everything?**

This is the thorough audit command. Takes as long as needed. Quality over speed.

## Usage

```bash
/addiction-audit              # Full audit cycle with fixes
/addiction-audit --quick      # Measure addiction score only (no fixes)
/addiction-audit --deep       # Include real integration test
```

---

## ABSOLUTE RULE: ORCHESTRATOR NEVER DOES WORK

**YOU ARE A COORDINATOR. Delegate ALL work to sub-agents. NO EXCEPTIONS.**

### What You MAY Do Directly
- Read/write files in `.claude/` directory ONLY
- Synthesize agent outputs
- Make prioritization decisions

### What You MUST Delegate

| Action | Agent |
|--------|-------|
| Test developer journey | `subagent_type=qa-agent` |
| Explore codebase | `subagent_type=Explore` |
| Browser testing | `subagent_type=auditor` |
| Write/fix code | `subagent_type=developer` |
| Verify production | `subagent_type=qa-agent` |

---

## STATE FILES

Read ALL THREE at start of every cycle:

| File | Purpose |
|------|---------|
| `USER_DECISIONS.md` | **THE VISION** + forbidden/required items |
| `AUDIT_LEARNINGS.md` | Addiction framework + patterns |
| `VERIFIED_STATE.md` | Current addiction score + gaps |

---

## THE CYCLE

### Phase 0: Load Vision (orchestrator does this)

Read the three state files. Internalize:

> **THE VISION**: "Every app that generates a PDF uses Glyph. Not because they have to, but because nothing else comes close."

**The Addiction Test**: Would a developer who tried Glyph ONCE want to use it for everything?

**DO NOT ADD**: Gimmicks, dishonest estimates, slow demos
**MUST KEEP**: Instant actions, honest labels, self-check
**PRIORITY**: Developer experience > everything else

---

### Phase 1: Developer Journey Test (spawn qa-agent)

```markdown
## Developer Journey Audit

You are a developer who just discovered Glyph. Test the REAL experience.

### Test 1: Discovery (< 30 seconds)
Go to https://glyph.you
- Can you understand what Glyph does in 10 seconds?
- Is the value proposition clear?
- Would you want to try it immediately?

**Score 0-10 with evidence.**

### Test 2: First Demo (< 2 minutes)
Try the demo without reading instructions:
- Click an instant action - visible result in <2s?
- Try a custom request - what happened?
- Did you feel delighted or frustrated?

**Score 0-10. What caused delight? What caused friction?**

### Test 3: Integration Path (< 10 minutes)
Go to https://docs.glyph.you
- Can you find the quickstart in <30 seconds?
- Are code examples copy-pasteable?
- Could you integrate in under 30 minutes?
- Is MCP server documented and working?

**Score 0-10. Where did you get stuck?**

### Test 4: Edge Case Resilience
Try to BREAK it:
- Empty prompt - graceful?
- Impossible request - helpful error?
- Rapid requests - handles queuing?
- 320px mobile - usable?

**Score 0-10. What broke ungracefully?**

### The Addiction Question
After all tests, answer honestly:
**"Would I use Glyph for my next PDF project?"**

### Return Format
{
  "addictionScore": N,
  "discoveryScore": N,
  "demoScore": N,
  "integrationScore": N,
  "edgeCaseScore": N,
  "delightMoments": ["..."],
  "frictionPoints": ["..."],
  "breakingPoints": ["..."],
  "wouldUseAgain": true/false,
  "whyOrWhyNot": "..."
}
```

---

### Phase 2: Pressure Testing (spawn qa-agent)

```markdown
## Pressure Test Suite

Try to break Glyph in ways real developers might.

### Data Edge Cases
- Empty data object
- Missing required fields
- Extremely long text (1000+ chars)
- Special characters (<script>, unicode, emoji)
- Type mismatches (numbers as strings)

### Session Edge Cases
- Request after session expiry
- Simultaneous requests
- Refresh mid-operation

### AI Edge Cases
- Contradictory instructions
- Document-corrupting requests
- Non-existent region references
- Vague instructions ("make it better")

### For Each Test Record
- Graceful failure? (yes/no)
- Error message helpful? (yes/no)
- Document corrupted? (yes/no)
- User can recover? (yes/no)

### Return
{
  "testsRun": N,
  "gracefulFailures": N,
  "ungracefulFailures": N,
  "documentCorruptions": N,
  "worstFailures": ["..."]
}
```

---

### Phase 3: Gap Analysis (orchestrator does this)

From Phase 1-2 outputs, identify:

1. **Addiction Blockers** (P0) - Would prevent a developer from using Glyph
2. **Trust Destroyers** (P0) - Would make developers warn others away
3. **Friction Points** (P1) - Would make developers hesitate to recommend
4. **Polish Gaps** (P2) - Would make it feel "okay" instead of "amazing"

**Filter against USER_DECISIONS.md**:
- Reject anything on DO NOT ADD list
- Flag anything removing MUST KEEP items

**Prioritize by addiction impact**, not by ease of fix.

---

### Phase 4: Fix (spawn developer - ONE AT A TIME)

For each P0, then P1:

```markdown
## Fix: [Issue Title]

Working Directory: /Users/eddiesanjuan/Projects/glyph

### Problem (Addiction Impact)
[What it is and why it hurts developer experience]

### Solution
[What to implement]

### Vision Alignment
This serves the vision by: [how it makes Glyph more addictive]

### Verification
- [Test that proves it's fixed]
- [The delight moment it creates]

### Requirements
- Implement completely
- Commit with clear message
- Push to main
- Report verification
```

**Wait for completion before next fix.**

---

### Phase 5: Verify (spawn qa-agent)

```markdown
## Post-Fix Verification

Wait 3 minutes for Railway deployment.

### Re-test Each Fix
- Issue no longer occurs
- No regressions
- Improvement is noticeable

### Quick Addiction Re-test
- Try demo fresh
- Score: Would you use this?

### Compliance Check
Verify DO NOT exist:
- Gimmicky animations
- Dishonest time estimates
- Broken instant actions

### Return
{
  "fixesVerified": N,
  "fixesPassed": N,
  "regressions": [],
  "newAddictionScore": N,
  "trend": "improving|stable|regressing"
}
```

---

### Phase 6: Learn & Log (orchestrator does this)

**Update VERIFIED_STATE.md**:
- New addiction score
- Updated gap list
- What changed

**Update AUDIT_LEARNINGS.md**:
- What patterns caused addiction blockers?
- What fixes had biggest impact?

**Append to self-improve-log.md**:

```markdown
## Addiction Audit - [Date]

### Addiction Score
- Previous: X/10
- Current: Y/10
- Trend: [improving/stable/regressing]

### Developer Journey Scores
- Discovery: X/10
- Demo: X/10
- Integration: X/10
- Edge Cases: X/10

### Fixed This Cycle
- [fix 1]
- [fix 2]

### Remaining Blockers
- P0: [blocker]
- P1: [friction]

### Key Learning
[What did we learn about making Glyph addictive?]
```

---

### Phase 7: Output Summary (orchestrator does this)

```
## AUDIT COMPLETE

**Addiction Score**: X/10 (target: 9.5/10)
**Trend**: [improving/stable/regressing]

### Would Developers Use This?
[Honest assessment based on testing]

### Delight Moments Found
- [moment 1]
- [moment 2]

### Fixed This Cycle
- [fix 1]
- [fix 2]

### Remaining Blockers
- P0: [would prevent usage]
- P1: [would prevent recommendation]

### Next Cycle Focus
[What to tackle next to increase addiction score]
```

**Then STOP.**

---

## Addiction Score Scale

| Score | Meaning |
|-------|---------|
| 10 | "I'd use this for everything. Why use anything else?" |
| 8-9 | "Really good. I'd recommend it." |
| 6-7 | "Works, but I might look at alternatives." |
| 4-5 | "Meh. I'd use it if I had to." |
| 0-3 | "I'd actively avoid this." |

**Target: 9.5/10**

---

## Quick Mode (--quick)

Only run Phase 0, 1, and 7. Measure and report. No fixes.

## Deep Mode (--deep)

Add real integration test: Actually create a test project and integrate Glyph following the docs. Measure time-to-first-PDF.

---

**Arguments:** $ARGUMENTS

**Remember: The goal is a product so good developers can't stop talking about it.**
