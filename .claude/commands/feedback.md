# Feedback - Quick Input for Next Cycle

Adds feedback to CYCLE_FEEDBACK.md for the next Ralph cycle to act on.

## Usage

```bash
/feedback The mobile preview is still hard to see on small screens
/feedback Stop testing the docs page - focus only on the playground
/feedback P0: The watermark button is broken again
```

---

## Instructions

You received feedback from Eddie. Your job:

1. **Read the current feedback file** at `.claude/CYCLE_FEEDBACK.md`

2. **Append the new feedback** in this format:

```markdown
## Feedback from Eddie - [timestamp]

**Priority:** [P0/P1/P2 - infer from tone/content, P0 if urgent/broken, P1 if important, P2 if nice-to-have]

**Feedback:**
[The exact feedback provided]

**Context:**
[Add 1-2 sentences of helpful context based on what you know about the current state of Glyph, recent changes, or relevant files]

**Suggested Focus:**
[1-2 bullet points on what the cycle should investigate or fix]

---
```

3. **Confirm** with a brief message showing what you added

## Rules

- Don't overthink it - just capture the feedback clearly
- Infer priority from urgency words ("broken", "stop", "critical" = P0)
- Add context that will help the cycle understand the issue
- Keep it concise - cycles have limited context

## Arguments

$ARGUMENTS
