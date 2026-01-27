# Performance Sprint Orchestrator

**Relentless Pursuit of 99/100 - Be Creative, Be Bold, Don't Break Things**

This orchestrator deploys coordinated agent legions to push Glyph to world-class status. Target: 99/100 composite score. Philosophy: Every developer who tries Glyph becomes an advocate.

---

## Quick Start

```bash
/performance-sprint                    # Run one improvement cycle
/performance-sprint --creative         # Include creative expansion phase
/performance-sprint --status           # Check current scores
/performance-sprint --verify-only      # Just verify production state
```

---

## The Goal

**Composite Score: 99/100**

| Dimension | Weight | Target | How to Improve |
|-----------|--------|--------|----------------|
| **UX** | 25% | 99 | Time-to-value, delight moments, friction elimination |
| **Performance** | 15% | 99 | API speed, page load, animation smoothness |
| **Code Quality** | 10% | 95 | Test coverage, type safety, maintainability |
| **Competitive** | 20% | 99 | Features no one else has, clear differentiation |
| **Polish** | 15% | 99 | Visual refinement, micro-interactions, mobile |
| **Documentation** | 15% | 99 | Time-to-first-success, completeness, clarity |

---

## Philosophy

### BE CREATIVE
- Add features competitors don't have
- Find hidden friction and eliminate it
- Create surprise-and-delight moments
- Think like a developer discovering Glyph for the first time

### BE BOLD
- Big improvements are fine if they don't break things
- Don't artificially constrain to small, safe changes
- Revolutionary features > incremental polish
- If something would make YOU say "wow", do it

### DON'T BREAK THINGS
- Core demo flow must always work
- Instant actions must stay instant (<500ms)
- Mobile must remain usable
- No regressions on existing features
- Verify on production before marking complete

### SPEED > FANCY
- Fast completion beats pretty progress animations
- Most users are API/MCP anyway
- Simple progress steps ("Analyzing... Done.") are fine
- Eddie's feedback: Don't stress about streaming visual polish

---

## CRITICAL: Delegation Protocol

**This orchestrator COORDINATES ONLY. It NEVER writes code directly.**

### Orchestrator CAN
- Read/write state files
- Run git commands
- Coordinate phases
- Prioritize improvements
- Synthesize findings

### Orchestrator CANNOT
- Write application code
- Research APIs
- Run builds/tests
- Browser testing
- ANY substantive work

**If writing code, STOP and spawn @developer.**

---

## Agent Fleet

| Agent | Deploy For |
|-------|------------|
| @auditor | Fresh-eyes review, scoring, competitive analysis, friction finding |
| @developer | Code implementation, optimization, feature building |
| @qa-agent | Browser testing, production verification, regression checks |
| @growth-engagement | Copy refinement, conversion optimization (if needed) |

---

## Phase Structure

```
CONTEXT → MEASURE → CREATIVE → PRIORITIZE → IMPLEMENT → VERIFY → COMMIT → LEARN
    ↑                                                                      |
    └────────────────────── Loop until 99 or max cycles ───────────────────┘
```

---

## Phase 0: Context Intelligence

**Deployment: INTERNAL**

```bash
# Load current state
cat /Users/eddiesanjuan/Projects/glyph/.claude/perfection-state.md

# Load feedback from Eddie
cat /Users/eddiesanjuan/Projects/glyph/.claude/CYCLE_FEEDBACK.md

# Load constraints
cat /Users/eddiesanjuan/Projects/glyph/.claude/USER_DECISIONS.md

# Verify production
curl -s https://glyph-api-production-b8ea.up.railway.app/health

# Check git state
git status --short
git log --oneline -3
```

### Extract Key Info
- Current composite score
- Score by dimension
- Blockers from previous cycle
- Feedback from Eddie (PRIORITY - read first)
- Forbidden items (confetti, stripe styling, dishonest estimates)

---

## Phase 1: MEASURE

**Deployment: PARALLEL WAVE (if scores are stale)**

If scores haven't been measured this cycle, deploy auditors:

### Wave 1: Parallel Audits

Deploy 2-3 @auditor agents simultaneously:

**Auditor A: UX + Polish**
- First impression test
- Time-to-value measurement
- Delight moments inventory
- Friction point identification
- Mobile (375px) testing

**Auditor B: Performance + Code Quality**
- API response times
- Page load metrics (FCP, TTI)
- Test pass rate
- Type safety issues
- Error handling gaps

**Auditor C: Competitive + Documentation**
- Feature comparison vs competitors
- Documentation completeness
- Time-to-first-success
- MCP/API discoverability

### Synthesis

Calculate composite:
```
COMPOSITE = (UX * 0.25) + (Performance * 0.15) + (CodeQuality * 0.10) +
            (Competitive * 0.20) + (Polish * 0.15) + (Documentation * 0.15)
```

---

## Phase 2: CREATIVE EXPANSION

**Deployment: 1 @auditor or @growth-engagement agent**

When `--creative` flag is passed (or every 3rd cycle):

```markdown
## Creative Expansion Prompt

Don't propose "fix bug X" or "improve loading time."
Propose things that would make developers say "I didn't know I needed this."

Think about:
- Moments of delight that surprise users
- Hidden friction users have accepted
- Features that create competitive moats
- Things that make developers actively recommend us

Constraints:
- Implementable in <2 hours
- No new infrastructure required
- Not on forbidden list
```

---

## Phase 3: PRIORITIZE

**Deployment: INTERNAL**

Score each opportunity:
```
PRIORITY = (IMPACT * 3) + (EFFORT_INVERSE * 2) + (RISK_INVERSE * 1)
```

Select 3-5 improvements for this cycle:
- Mix of quick wins and bold moves
- At least 1 creative/differentiating improvement
- Nothing that risks breaking core features

---

## Phase 4: IMPLEMENT

**Deployment: PARALLEL WAVE**

For each selected improvement, spawn @developer:

```markdown
## Developer Prompt Template

**Working Directory:** /Users/eddiesanjuan/Projects/glyph
**Improvement:** [description]
**Dimension:** [which score this affects]
**Expected Impact:** [+X points]

### FORBIDDEN (ABSOLUTE)
- Confetti animation - NO CONFETTI EVER
- Stripe styling button - Too slow
- Dishonest time estimates - Trust > comfort

### Requirements
1. Implement the improvement
2. Test locally
3. Don't touch unrelated code
4. Return files modified and test instructions

### DO NOT COMMIT
Orchestrator handles git.
```

---

## Phase 5: VERIFY

**Deployment: SEQUENTIAL or PARALLEL**

For each improvement, verify:

1. **Local**: Does it work locally?
2. **Build**: Does it build without errors?
3. **Demo Flow**: Core demo still works?
4. **Mobile**: Still usable at 375px?
5. **No Regressions**: Existing features intact?

If ANY verification fails:
- Fix it (spawn @developer)
- Or revert it
- Do NOT proceed with broken changes

---

## Phase 6: COMMIT

**Deployment: INTERNAL**

```bash
# Stage specific files (not git add .)
git add [files from implementations]

# Commit with context
git commit -m "$(cat <<'EOF'
perf: Cycle [N] - [summary]

Improvements:
- [improvement 1]
- [improvement 2]

Score: [before] → [after] (+[delta])

Orchestrated by: /performance-sprint
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Push to deploy
git push origin main
```

Wait 2-3 minutes for Railway deployment.

### Production Verification

Deploy @qa-agent to verify on production:
- Landing page loads
- Demo flow works
- Instant actions work
- Improvements visible

If regression detected: `git revert HEAD && git push`

---

## Phase 7: LEARN

**Deployment: INTERNAL**

Update `/Users/eddiesanjuan/Projects/glyph/.claude/perfection-state.md`:
- New scores by dimension
- New composite score
- Improvements completed
- Blockers remaining
- Learnings for next cycle

Update `/Users/eddiesanjuan/Projects/glyph/.claude/perfection-history.md`:
- Cycle summary
- What worked
- What didn't
- Key learning

### Loop Check

If composite < 99 AND more cycles allowed:
- Return to Phase 1
- Pass blockers to next cycle
- Adjust priorities based on learnings

---

## State Files

| File | Purpose |
|------|---------|
| `.claude/perfection-state.md` | Current scores, backlog, blockers |
| `.claude/perfection-history.md` | Log of all cycles |
| `.claude/CYCLE_FEEDBACK.md` | Feedback from Eddie (READ FIRST) |
| `.claude/USER_DECISIONS.md` | Forbidden items, constraints |

---

## Success Criteria

### Cycle Success
- [ ] Composite score improved (or maintained if blocked)
- [ ] No dimension regressed by >2 points
- [ ] All improvements verified on production
- [ ] No forbidden items added
- [ ] Learnings documented

### Ultimate Success
- [ ] Composite score >= 99
- [ ] Every dimension >= 90
- [ ] Core demo flow is flawless
- [ ] "Would a developer who tried Glyph ONCE be annoyed using anything else?" = YES

---

## BEGIN

Read context, measure if needed, get creative, implement boldly, verify thoroughly, learn continuously.

**The goal is not a checklist. The goal is a product so good that alternatives feel like punishment.**
