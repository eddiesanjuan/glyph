# Cycle Feedback

Write your feedback below. The next cycle will read this, act on it, then clear it.

---

## Feedback from Eddie - 2026-01-22

**Priority:** P1 (strategic feature direction + UX improvement)

**Feedback:**
1. **Streaming AI edits:** Edge cases are timing out at 60s. Could we stream the AI modifications so users see the document being edited in real-time? Like watching Claude Code edit files. This would make waiting feel engaging instead of frustrating, and massively increase the "wow factor."

2. **Developer UX for template selection:** The audit cycles need to think about the end-user/developer experience more holistically:
   - How does a developer pick which template to use (invoice vs quote vs report)?
   - Should users choose templates, or should Glyph auto-select based on data?
   - Should developers prompt Glyph to create the right PDF type?
   - These are the real DX questions that make or break adoption.

**Context:**
Current AI modifications use a request/response pattern with 60s timeout. The API uses Claude for modifications (`api/src/services/ai.ts`). Streaming would require SSE or WebSocket changes to both API and SDK. Template selection is currently hardcoded in demos - no intelligent routing exists.

**Suggested Focus:**
- Investigate feasibility of streaming AI responses to the preview (would need API + SDK changes)
- Add "template selection UX" as a key developer journey question in audits
- Consider: What makes a developer's USERS delighted, not just the developer?

---

## Feedback from Eddie - 2026-01-22 20:43 CST

**Priority:** P0 (GIMMICKY ANIMATION - VIOLATES USER_DECISIONS)

**Feedback:**
"What is that stupid celebration time glowing animation on this PDF?"

Screenshot shows the live preview with a glowing banner at the top reading "🎉🎊 CELEBRATION TIME 🎊🎉" - this is EXACTLY the kind of gimmicky animation that is FORBIDDEN in USER_DECISIONS.md.

**Context:**
This appears to be an AI modification result that added a tacky celebration banner to the document. The guardrails should have blocked this as it degrades the professional appearance of the PDF. This is the same category of violation as confetti - gimmicky, unprofessional elements that hurt the product's credibility.

**Suggested Focus:**
- IMMEDIATELY investigate how this got added and remove it
- Check if guardrails are properly blocking unprofessional modifications
- This is a P0 trust destroyer - the AI should never make documents look tacky

---

## Feedback from Eddie - 2026-01-22 20:47 CST

**Priority:** P1 (docs dark mode bug - broken UX)

**Feedback:**
"In the docs page on Dark Mode, when you've clicked on an item on the side menu, you can't see what you've clicked. It just goes all white."

Screenshot shows docs.glyph.you/integrations/mcp-server/ - in the left sidebar under "Integrations", there's a menu item that appears as a solid white/light rectangle with no visible text. The active/selected state has white text on white background, making it unreadable.

**Context:**
The docs site is at docs.glyph.you. This is a CSS issue with the sidebar's active link state in dark mode - the text color likely matches or is too close to the background color when selected. The docs are built with a documentation framework (possibly Mintlify or similar).

**Suggested Focus:**
- Fix the sidebar active state CSS in docs to have visible text contrast in dark mode
- Test all sidebar states: hover, active, focus in dark mode
- Quick CSS fix, but important for professional appearance

---

