# Feedback - Quick Input for Next Cycle

Adds feedback to CYCLE_FEEDBACK.md for the next Ralph cycle to act on.

## Usage

Run `/feedback` with or without arguments:

```
/feedback                             → Interactive: asks system, priority, feedback
/feedback The watermark is broken     → Quick: asks system + priority, uses text as feedback
/feedback P0: Watermark is broken     → Quickest: infers priority from prefix, asks system only
```

---

## Instructions

You received a `/feedback` command from Eddie. Follow this flow:

### Step 1: Check for inline feedback

Look at `$ARGUMENTS`. Three scenarios:

**A) No arguments (empty):** Ask all three questions below in order.
**B) Has text but no priority prefix:** Use text as feedback, ask system and priority.
**C) Has priority prefix (e.g., "P0: ..."):** Parse priority and feedback text, ask system only.

### Step 2: Gather what's missing (conversational, fast)

Ask ONLY what you don't already have. Ask one message at a time to keep it fast.

**System** — Ask:
> What's this about?
> 1. Performance Sprint (product polish)
> 2. Infrastructure Blitz (distribution)
> 3. General (applies to everything)

Eddie can reply with a number or a word. Map accordingly:
- 1, "perf", "performance", "product", "polish" → Performance Sprint
- 2, "infra", "infrastructure", "blitz", "distribution" → Infrastructure Blitz
- 3, "general", "all", "everything", anything else → General

**Priority** — Ask:
> Priority?
> - **P0:** Must fix THIS cycle, blocks everything
> - **P1:** Important, address soon
> - **P2:** Nice to have, can wait

Eddie can reply with "P0", "0", "p0", "P1", "1", etc. Map accordingly.

**Feedback** — Ask:
> What's the feedback?

Accept whatever Eddie writes as-is.

### Step 3: Write to CYCLE_FEEDBACK.md

1. **Read** the current contents of `.claude/CYCLE_FEEDBACK.md`
2. **Append** the new entry at the END of the file, using this exact format:

```markdown
## Feedback from Eddie - [YYYY-MM-DD HH:MM CST]

**Priority:** P[0/1/2]
**System:** [Performance Sprint / Infrastructure Blitz / General]

**Feedback:**
[Eddie's exact feedback text]

**Context:**
[1-2 sentences of helpful context you know about the current state of Glyph, recent changes, or relevant files. If you have no useful context, omit this section entirely.]

**Status:** PENDING

---

```

**Timestamp rules:**
- Always use CST (Central Standard Time, UTC-6)
- Format: `YYYY-MM-DD HH:MM CST`
- Use the current date and time

### Step 4: Confirm

Reply with a brief confirmation like:

> Added P1 feedback to Performance Sprint. Next cycle will pick it up.

Show the entry you wrote so Eddie can verify it looks right.

## Rules

- **APPEND only** — never overwrite or remove existing entries
- **Preserve the file header** — keep the `# Cycle Feedback` title and description at the top
- **Keep it fast** — this is a mid-work interrupt, don't write essays
- **Infer when possible** — if Eddie says "broken" or "blocks me", lean P0 without asking
- **CST timezone always** — Eddie is in Central Time
- **Don't ask unnecessary questions** — if the arguments give you everything, skip straight to writing
- **Status is always PENDING** — cycles will update status when they act on it

## Arguments

$ARGUMENTS
