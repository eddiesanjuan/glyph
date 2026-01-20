# Glyph Self-Improve - Continuous Quality Evolution

Glyph gets better every day. This command runs a comprehensive self-audit, identifies improvements, and optionally fixes them automatically.

## Usage

```bash
/self-improve                    # Full audit + suggest improvements
/self-improve --auto-fix         # Audit + automatically fix what's possible
/self-improve --quick            # Fast check of critical paths only
/self-improve --deep             # Exhaustive analysis including competitors
```

## The Self-Improvement Loop

```
AUDIT → IDENTIFY → PRIORITIZE → FIX → VERIFY → LOG → LEARN
   ↑                                                    |
   └────────────────── Daily cycle ─────────────────────┘
```

## Orchestrator Instructions

You are Glyph's self-improvement system. Your mission: **find issues before users do and fix them.**

### Phase 1: Production Health Check

Before diving deep, verify the basics:

```markdown
## Health Check

| Check | Status | Notes |
|-------|--------|-------|
| API responds | ✓/✗ | Response time: Xms |
| Landing loads | ✓/✗ | Load time: Xs |
| Demo preview works | ✓/✗ | |
| Quick action works | ✓/✗ | Tested: "Stripe styling" |
| Self-check passes | ✓/✗ | |
| No console errors | ✓/✗ | |
```

**If health check fails, stop and fix critical issues first.**

### Phase 2: UX Audit

Spawn @auditor to evaluate user experience:

```markdown
## UX Audit Prompt

**URL:** https://glyph-www-production.up.railway.app

**Evaluate:**

1. **First Impression (0-10)**
   - Does it look professional?
   - Is the value proposition clear?
   - Would you trust this with your business documents?

2. **Demo Experience (0-10)**
   - How fast does it feel?
   - Are interactions intuitive?
   - Do quick actions produce visible results?

3. **Mobile Experience (0-10)**
   - Does it work on phone?
   - Touch targets adequate?
   - Layout adapts properly?

4. **Friction Points**
   - What confused you?
   - What took too long?
   - What didn't work as expected?

**Return:**
{
  "scores": { "firstImpression": N, "demoExperience": N, "mobile": N },
  "frictionPoints": ["description", ...],
  "recommendations": ["specific improvement", ...]
}
```

### Phase 3: Code Quality Scan

Analyze codebase for issues:

```markdown
## Code Scan Areas

1. **Error Handling**
   - Uncaught exceptions
   - Missing error boundaries
   - Generic error messages

2. **Performance**
   - Slow API endpoints
   - Large bundle sizes
   - Unnecessary re-renders

3. **Security**
   - API key exposure
   - Input sanitization
   - CORS configuration

4. **Dead Code**
   - Unused functions
   - Commented-out code
   - Deprecated patterns

**Files to Scan:**
- api/src/**/*.ts
- sdk/src/**/*.ts
- www/index.html
```

### Phase 4: Competitive Comparison

If `--deep` flag, check how Glyph compares:

```markdown
## Competitive Analysis

Compare Glyph's current state against:
- DocRaptor
- PDFMonkey
- React-PDF
- Puppeteer-based solutions

**Questions:**
1. What can they do that Glyph can't?
2. What does Glyph do better?
3. What features would close the gap?
```

### Phase 5: Generate Improvement Backlog

Compile all findings into prioritized list:

```markdown
## Improvement Backlog

### Critical (Fix immediately)
| Issue | Type | Effort | Impact |
|-------|------|--------|--------|
| [issue] | bug | S/M/L | High |

### High (Fix this week)
| Issue | Type | Effort | Impact |
|-------|------|--------|--------|

### Medium (Fix this month)
| Issue | Type | Effort | Impact |
|-------|------|--------|--------|

### Ideas (Future consideration)
- [idea 1]
- [idea 2]
```

### Phase 6: Auto-Fix (if --auto-fix)

For issues that are safe to auto-fix:

**Safe to Auto-Fix:**
- Typos in UI text
- Missing alt attributes
- Obvious CSS bugs
- Dead code removal
- Console.log cleanup

**NOT Safe to Auto-Fix:**
- Logic changes
- API modifications
- New features
- Anything affecting data

```markdown
## Auto-Fix Execution

Spawning parallel agents for safe fixes:
- Agent 1: [fix description]
- Agent 2: [fix description]

After fixes, run verification, then deploy.
```

### Phase 7: Update Self-Improvement Log

Append to `/Users/eddiesanjuan/Projects/glyph/.claude/self-improve-log.md`:

```markdown
## Self-Improvement Cycle - [Date]

### Health Check
- Status: PASS/FAIL
- Issues found: N

### UX Scores
- First Impression: N/10
- Demo Experience: N/10
- Mobile: N/10

### Code Scan
- Issues found: N
- Auto-fixed: N

### Backlog Generated
- Critical: N
- High: N
- Medium: N
- Ideas: N

### Actions Taken
- [action 1]
- [action 2]

### Recommendations for Human
- [recommendation 1]
- [recommendation 2]
```

---

## Quality Metrics to Track

Over time, track these metrics:

```markdown
## Glyph Quality Dashboard

| Metric | Previous | Current | Trend |
|--------|----------|---------|-------|
| UX Score (avg) | 7.2 | 7.8 | ↑ |
| API Response Time | 450ms | 380ms | ↑ |
| Demo Load Time | 2.1s | 1.8s | ↑ |
| Self-Check Pass Rate | 94% | 97% | ↑ |
| Console Errors | 3 | 0 | ↑ |
| Open Issues | 12 | 8 | ↑ |
```

---

## Improvement Categories

### 1. Demo Polish
- Loading states
- Animations
- Visual feedback
- Error messages

### 2. AI Quality
- Prompt engineering
- Response validation
- Edge case handling
- Context understanding

### 3. Template System
- New template types
- Better schemas
- More regions
- Smarter defaults

### 4. Developer Experience
- Documentation clarity
- Integration simplicity
- Error messages
- TypeScript support

### 5. Performance
- API latency
- Bundle size
- Render speed
- Memory usage

### 6. Reliability
- Uptime
- Error rates
- Self-check accuracy
- Edge case handling

---

## Self-Learning

Over time, Glyph should learn:

1. **Common User Requests** → Add as quick actions
2. **Frequent Errors** → Improve guardrails
3. **Template Gaps** → Create new templates
4. **Integration Friction** → Better docs/defaults

Store learnings in `/Users/eddiesanjuan/Projects/glyph/.claude/learnings.md`:

```markdown
## Learnings Log

### Common Requests (add to quick actions)
- "Make it look like Stripe" → Already a quick action ✓
- "Add payment QR code" → TODO: Add quick action
- "Remove watermark" → TODO: Add quick action

### Frequent Errors (improve guardrails)
- AI sometimes breaks table layout → Added table validation
- Color contrast issues → Added accessibility check

### Template Gaps
- No invoice template → TODO: Create
- No receipt template → TODO: Create

### Integration Friction
- Data format confusion → Improved docs
- Event naming unclear → Added TypeScript definitions
```

---

## BEGIN

Run the self-improvement cycle based on the flags provided.

**Arguments:** $ARGUMENTS

**Default (no flags):** Full audit, generate recommendations, do not auto-fix.
