# Verified State

> **SUMMARY**: Last verified 2026-01-22. MCP link broken (wrong path). Zapier docs missing. AI takes 55s (needs optimization). Visual consistency PASS.

---

## Last Full Audit
- **Date**: 2026-01-22
- **Verified by**: Manual check + curl
- **Next scheduled**: Run /addiction-audit

---

## URLs (HTTP Status Verified)

| URL | Status | Notes |
|-----|--------|-------|
| https://glyph.you | ✅ 200 | Landing works |
| https://docs.glyph.you | ✅ 200 | Docs home works |
| https://docs.glyph.you/integrations/mcp-server | ✅ 200 | MCP docs exist HERE |
| https://docs.glyph.you/mcp-server | ❌ 404 | WRONG - hero links here |
| https://docs.glyph.you/integrations/airtable | ✅ 200 | Airtable docs exist |
| https://docs.glyph.you/integrations/zapier | ❌ 404 | MISSING - needs creation |
| https://dashboard.glyph.you | ✅ 200 | Dashboard works |
| https://api.glyph.you/health | ⚠️ UNTESTED | Needs verification |

---

## Features (Browser Tested)

| Feature | Status | Response Time | Notes |
|---------|--------|---------------|-------|
| Watermark instant action | ✅ PASS | 0.1s | Works reliably |
| QR code instant action | ✅ PASS | 0.1s | Works reliably |
| Grouping instant action | ❌ MISSING | - | Needs implementation |
| AI modification (custom) | ⚠️ UNSTABLE | 45-60s | Timeouts reported |
| PDF download | ⚠️ UNTESTED | - | Needs verification |
| Mobile 375px | ✅ PASS | - | Preview visible |

---

## Visual Consistency (Screenshot Verified)

| Property | Text Contrast | Branding | Theme Switching |
|----------|---------------|----------|-----------------|
| Landing (glyph.you) | ✅ PASS | ✅ Navy/G logo | N/A (dark only) |
| Docs light mode | ✅ PASS | ✅ Matches | ✅ PASS |
| Docs dark mode | ✅ PASS | ✅ Matches | ✅ PASS |
| Dashboard | ✅ PASS | ✅ Navy/G logo | N/A (dark only) |
| Search modal | ✅ PASS | ✅ Purple accent | ✅ Adapts |

---

## Known Gaps (Verified Missing)

| Gap | Impact | Priority |
|-----|--------|----------|
| Hero MCP link wrong path | Broken link for AI-first users | P1 |
| Zapier/Make docs missing | Low-code dimension gap | P2 |
| AI response 55s | UX blocker, timeouts | P0 |
| Grouping instant action missing | Demo doesn't match hero promise | P1 |
| Example data too simple | Doesn't showcase complex capability | P2 |

---

## Model Configuration (Needs Audit)

| Service | Model | Notes |
|---------|-------|-------|
| AI modifications | ⚠️ UNKNOWN | Needs investigation |
| Guardrails | ⚠️ UNKNOWN | Needs investigation |

---

## Change Log

| Date | Change | Verified By |
|------|--------|-------------|
| 2026-01-22 | Initial state capture | Manual curl + browser |
