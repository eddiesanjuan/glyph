# User Decisions Log

**THIS FILE IS SACRED. The audit system MUST read and respect these decisions.**

These are explicit decisions made by the user (Eddie) that should NEVER be reversed by automated audits or improvement cycles. If you think one of these should change, ASK THE USER FIRST.

---

## Permanent Decisions

### DO NOT ADD

| Item | Reason | Date | Context |
|------|--------|------|---------|
| **Stripe styling button** | Takes 45-60s, times out, "nobody cares about making PDFs look like Stripe invoices" | 2026-01-21 | Commit 6c0079b |
| **Confetti animation** | User explicitly dislikes it | 2026-01-21 | Commit aa8b769 |
| **Time estimates that lie** | If AI takes 55s, don't say 30s | 2026-01-22 | Cycle 5 |

### MUST KEEP

| Item | Reason | Date |
|------|--------|------|
| **Instant quick actions** | Watermark, QR code work instantly - these demonstrate value | 2026-01-21 |
| **"Group items by category"** | Hero should show this, not Stripe styling | 2026-01-21 |
| **Honest time labels** | ~45-60s for AI operations | 2026-01-22 |

### FOCUS AREAS

| Priority | Item | Reason |
|----------|------|--------|
| **P0** | AI response speed | 55s is the blocker. Streaming or caching needed. |
| **P1** | Visual consistency | All properties must look like same product |
| **P2** | Mobile UX | Preview must be usable at 375px |

---

## How to Use This File

**Before proposing ANY feature addition:**
1. Check the "DO NOT ADD" list
2. If it's on the list, DO NOT PROPOSE IT
3. If you think the decision should be reconsidered, ASK THE USER

**Before removing ANY feature:**
1. Check the "MUST KEEP" list
2. If it's on the list, DO NOT REMOVE IT

**When prioritizing work:**
1. Check the "FOCUS AREAS" list
2. P0 items come before P1, P1 before P2

---

## Change History

| Date | Change | By |
|------|--------|-----|
| 2026-01-22 | Created file after Stripe/confetti were wrongly re-added | Cycle 6 |
