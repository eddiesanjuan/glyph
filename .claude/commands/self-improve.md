# Glyph Self-Improve - The Addiction Engine

**Mission: Make Glyph so good that developers are addicted to it and annoyed to use anything else.**

This isn't about fixing bugs. This is about relentlessly pursuing perfection until Glyph barely needs advertising—because it's that good.

## Usage

```bash
/self-improve                    # Full cycle: test as developer, find gaps, improve
/self-improve --auto-fix         # Same + automatically fix what's possible
/self-improve --quick            # Health check + addiction test only
/self-improve --deep             # Include real integration test + competitor analysis
```

## The Self-Improvement Loop

```
VISION CHECK → DEVELOPER TEST → EDGE CASES → IDENTIFY GAPS → FIX → VERIFY → LEARN
      ↑                                                                      |
      └──────────────────── Continuous evolution ────────────────────────────┘
```

---

## Orchestrator Instructions

You are Glyph's quality obsession engine. Your mission: **make the product so good developers can't imagine using anything else.**

**CRITICAL: You are a coordinator, not a worker. Delegate ALL work to sub-agents.**

---

### Phase 0: Load Vision & Context (MANDATORY)

Before ANY work, read these files:
1. `.claude/USER_DECISIONS.md` - **THE VISION SECTION FIRST**, then tactical rules
2. `.claude/AUDIT_LEARNINGS.md` - patterns and anti-patterns
3. `.claude/VERIFIED_STATE.md` - current known state

**Internalize the vision:**
> "Every app that generates a PDF uses Glyph. Not because they have to, but because nothing else comes close."

**The Addiction Test (ask this every cycle):**
> "Would a developer who tried Glyph ONCE want to use it for everything?"

---

### Phase 1: Developer Experience Test (spawn qa-agent)

**This is the most important phase.** Don't just check if pages load—actually BE a developer trying to use Glyph.

```markdown
## Developer Experience Test

You are a developer who just discovered Glyph. Test the REAL developer journey.

### Test 1: Discovery (< 30 seconds)
1. Go to https://glyph.you
2. Can you understand what Glyph does in 10 seconds?
3. Is the value proposition immediately clear?
4. Would you want to try it RIGHT NOW?

**Score 0-10 with specific observations.**

### Test 2: First Demo (< 2 minutes)
1. Try the demo without reading instructions
2. Click an instant action - did something visible happen?
3. Try a custom AI request - what happened?
4. Did you feel delighted or frustrated?

**Score 0-10. What caused delight? What caused friction?**

### Test 3: Integration Journey (< 10 minutes)
1. Go to docs.glyph.you
2. Find the quickstart guide
3. Could you integrate this into YOUR app in under 30 minutes?
4. Are the code examples copy-pasteable?
5. Is there an MCP server you could tell Claude Code about?

**Score 0-10. Where did you get stuck?**

### Test 4: Edge Case Resilience
Try to BREAK the demo:
1. Submit an empty prompt - what happens?
2. Submit an impossible request ("make this document sing") - graceful failure?
3. Make 5 rapid requests in sequence - does it handle queuing?
4. Resize to 320px mobile - still usable?

**Score 0-10. What broke? What handled gracefully?**

### The Addiction Question
After all tests, answer honestly:
**"Would I use Glyph for my next project that needs PDFs?"**
- If YES: What sealed the deal?
- If NO: What would need to change?

### Return Format
{
  "addictionScore": N (0-10, would use again),
  "discoveryScore": N,
  "demoScore": N,
  "integrationScore": N,
  "edgeCaseScore": N,
  "delightMoments": ["...", "..."],
  "frictionPoints": ["...", "..."],
  "breakingPoints": ["...", "..."],
  "wouldUseAgain": true/false,
  "whyOrWhyNot": "..."
}
```

---

### Phase 2: Real Integration Test (spawn developer - only with --deep flag)

```markdown
## Real Integration Test

Create a minimal test project and actually integrate Glyph.

### Setup
1. Create `/tmp/glyph-integration-test/`
2. Initialize a simple Node.js project
3. Follow the Glyph docs to integrate

### Test Scenarios
1. Generate a PDF from sample data
2. Modify a region with AI
3. Handle an error case
4. Generate final PDF

### Record
- Time to first successful PDF
- Number of documentation lookups needed
- Errors encountered and how clear they were
- Did the SDK types help?

### Report
{
  "timeToFirstPdf": "Xm Ys",
  "documentationLookups": N,
  "errors": [{"error": "...", "clarity": 0-10}],
  "overallDx": 0-10,
  "suggestions": ["...", "..."]
}
```

---

### Phase 3: Pressure Testing (spawn qa-agent)

```markdown
## Pressure Test Suite

Try to break Glyph in ways real users might.

### Data Edge Cases
1. Empty data object - does it fail gracefully?
2. Missing required fields - clear error?
3. Extremely long text (1000+ chars in a field) - layout breaks?
4. Special characters (<script>, unicode, emoji) - XSS or corruption?
5. Numbers as strings, strings as numbers - type coercion issues?

### Session Edge Cases
1. Make a request after session expiry - clear error + recovery?
2. Make simultaneous requests - race conditions?
3. Refresh mid-AI-operation - recoverable state?

### AI Edge Cases
1. Contradictory instructions ("make it bigger AND smaller")
2. Instructions that would corrupt the document
3. Instructions referencing non-existent regions
4. Very vague instructions ("make it better")

### For Each Test
Record:
- Did it fail gracefully?
- Was the error message helpful?
- Did it corrupt the document?
- Could the user recover?

### Return
{
  "testsRun": N,
  "gracefulFailures": N,
  "ungracefulFailures": N,
  "documentCorruptions": N,
  "worstFailures": ["description", "..."]
}
```

---

### Phase 4: Gap Analysis (orchestrator does this)

From Phase 1-3 outputs, identify:

1. **Addiction Blockers** - Things that would make a developer NOT come back
2. **Delight Opportunities** - Things that could make the experience magical
3. **Trust Issues** - Things that make the product feel unreliable
4. **DX Friction** - Things that slow down integration

**Prioritize by addiction impact:**
- P0: Would prevent a developer from using Glyph at all
- P1: Would make a developer hesitate to recommend Glyph
- P2: Would make Glyph feel "just okay" instead of amazing

**Filter against USER_DECISIONS:**
- Remove anything on DO NOT ADD list
- Flag anything that would remove MUST KEEP items

---

### Phase 5: Fix (spawn developer - one at a time, wait for completion)

For each P0 issue, then P1:

```markdown
## Fix: [Issue Title]

Working Directory: /Users/eddiesanjuan/Projects/glyph

### Problem (Addiction Impact)
[What the issue is and why it hurts the developer experience]

### Solution
[What to implement]

### Vision Alignment
This fix serves the vision by: [how it makes Glyph more addictive]

### Verification
After implementing, verify:
- [Specific test that proves it's fixed]
- [The addiction moment it creates]

### Requirements
- Implement the fix completely
- Commit with descriptive message
- Push to main (Railway auto-deploys)
- Report verification result
```

---

### Phase 6: Verify Improvements (spawn qa-agent)

```markdown
## Post-Fix Verification

Wait 3 minutes for Railway deployment.

### Re-test Affected Areas
For each fix, verify:
- The issue no longer occurs
- No regressions introduced
- The improvement is noticeable

### Re-run Addiction Test
Quick version of Phase 1:
- Try the demo fresh
- Try one integration step
- Score: Would you use this?

### Return
{
  "fixesVerified": N,
  "fixesPassed": N,
  "regressions": [],
  "newAddictionScore": N,
  "trend": "improving" | "stable" | "regressing"
}
```

---

### Phase 7: Learn & Log (orchestrator does this)

Update `.claude/AUDIT_LEARNINGS.md`:
- What patterns led to addiction blockers?
- What fixes had the biggest impact?
- What should future cycles prioritize?

Update `.claude/VERIFIED_STATE.md`:
- Current addiction score
- Known gaps
- Last verified date

Append to `/Users/eddiesanjuan/Projects/glyph/.claude/self-improve-log.md`:

```markdown
## Self-Improvement Cycle - [Date]

### Addiction Score
- Previous: X/10
- Current: Y/10
- Trend: [improving/stable/regressing]

### Developer Experience Test
- Discovery: X/10
- Demo: X/10
- Integration: X/10
- Edge Cases: X/10

### Issues Found
- Addiction blockers: N
- Delight opportunities: N
- Trust issues: N
- DX friction: N

### Fixed This Cycle
- [fix 1]
- [fix 2]

### Remaining Gaps (for next cycle)
- P0: [gap]
- P1: [gap]

### Key Learning
[One sentence: what did we learn about making Glyph addictive?]
```

---

## The Addiction Score

Every cycle produces an Addiction Score (0-10):

| Score | Meaning |
|-------|---------|
| 10 | "I'd use this for everything. Why would I use anything else?" |
| 8-9 | "This is really good. I'd recommend it." |
| 6-7 | "It works, but I might look at alternatives." |
| 4-5 | "Meh. I'd use it if I had to." |
| 0-3 | "I'd actively avoid this." |

**Target: 9.5/10** - Developers are addicted.

---

## Quick Mode (--quick flag)

Only run:
- Phase 0: Load context
- Phase 1: Developer Experience Test (abbreviated)
- Phase 7: Log results

No fixes. Just measure and report addiction score.

---

## Deep Mode (--deep flag)

Run everything PLUS:
- Phase 2: Real Integration Test (actually build something)
- Competitive analysis against DocRaptor, PDFMonkey, etc.

---

## BEGIN

Run the self-improvement cycle based on the flags provided.

**Arguments:** $ARGUMENTS

**Default (no flags):** Full audit cycle focused on developer addiction.

**Remember: The goal isn't a checklist. The goal is a product so good developers can't stop talking about it.**
