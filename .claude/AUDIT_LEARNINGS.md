# Audit Learnings

> **SUMMARY**: Key lesson - VERIFY EVERYTHING. Don't trust commit messages. Don't trust claims. Click links, test features, take screenshots.

---

## Anti-Patterns (NEVER Do This)

| Anti-Pattern | Why It's Bad | Example |
|--------------|--------------|---------|
| Claiming docs exist without HTTP 200 check | Creates broken user journeys | MCP link went to 404 for multiple cycles |
| Adding features without USER_DECISIONS check | Wastes time, frustrates user | Stripe styling re-added after explicit removal |
| Trusting commit messages as proof | Code != working feature | "Added Zapier docs" but 404 in production |
| Surface-level visual checks | Misses readability issues | Gray text on white passed multiple audits |
| Orchestrator doing work directly | Context fills up, loses track | Should delegate to sub-agents |
| Assuming previous cycle fixed things | Regressions happen | Must re-verify each cycle |

---

## Patterns (ALWAYS Do This)

| Pattern | Why It Works | How |
|---------|--------------|-----|
| Verify every URL with curl + browser | Catches 404s, wrong paths | `curl -s -o /dev/null -w "%{http_code}" URL` |
| Screenshot every visual claim | Creates evidence, catches regressions | Playwright screenshots |
| Check USER_DECISIONS.md first | Prevents re-adding forbidden items | Phase 0 of every cycle |
| Update VERIFIED_STATE.md with proof | Creates audit trail | Include timestamps, who verified |
| Delegate ALL work to sub-agents | Preserves orchestrator context | Task tool with specific agent types |
| Test at 375px mobile | Catches mobile-specific issues | Playwright viewport resize |
| Test both light AND dark mode | Catches theme issues | Toggle and screenshot both |

---

## Common Failures & Detection

| Failure | How to Detect | Prevention |
|---------|---------------|------------|
| Wrong URL paths | curl returns 404 | Verify EXACT URL user will hit |
| Visual inconsistency | Side-by-side screenshots | Check all properties same session |
| Regression of user decisions | QA compliance check | Include forbidden items in test |
| Timeout on AI actions | Actually run the action, time it | Test with stopwatch |
| Missing docs | HTTP 404 | curl before claiming complete |

---

## Model/Performance Learnings

| Learning | Date | Context |
|----------|------|---------|
| AI modifications take 55s avg | 2026-01-22 | User reported timeouts |
| Need to investigate model config | 2026-01-22 | May not be using optimal model |
| Instant actions use fastTransform | 2026-01-21 | These are reliable (<1s) |

---

## User Preferences Learned

| Preference | Context | Date |
|------------|---------|------|
| No confetti | User explicitly dislikes | 2026-01-21 |
| No Stripe styling button | "Nobody cares about Stripe invoices" | 2026-01-21 |
| Honest time estimates | Don't say 30s if it takes 55s | 2026-01-22 |
| Thorough > fast audits | "2 hours is fine if thorough" | 2026-01-22 |
| Grouping demo preferred | Shows capability better than Stripe | 2026-01-22 |

---

## Sub-Agent Delegation Rules

| Task Type | Agent | Why |
|-----------|-------|-----|
| Read/explore code | Explore | Doesn't fill orchestrator context |
| Browse/test UI | auditor | Has Playwright access |
| Write/edit code | developer | Handles git, versioning |
| Verify production | qa-agent | Thorough testing |
| Research competitors | auditor | Web access |

**HARD RULE: Orchestrator NEVER uses Grep/Glob/Read on app code, Edit/Write on app code, or Playwright tools directly.**

---

## Cycle History (What Worked)

| Cycle | What Worked | What Didn't |
|-------|-------------|-------------|
| 6 | Visual consistency fixes, USER_DECISIONS.md | Re-added forbidden items |
| 5 | Honest time labels | Still surface-level checks |

---

## Next Improvements Needed

1. Implement grouping as instant action
2. Expand example data (more line items)
3. Investigate AI model/timeout configuration
4. Fix MCP link path
5. Create Zapier/Make docs
