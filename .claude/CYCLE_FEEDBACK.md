# Cycle Feedback

Write your feedback below. The next cycle will read this, act on it, then clear it.

---

## Feedback from Eddie - 2026-01-26 21:45 CST

**Priority:** P2 (nice-to-have, explicitly deprioritized)

**Feedback:**
The "streaming animation" of watching the AI work is honestly pretty unsatisfying the way it is now. It looks like it just glitches pretty hard, shows a bunch of weird code if you don't know what you're looking at for the field names and whatnot, and then all of a sudden produces a very nice sharp looking document. If the result is good, the experience would honestly just be better as a bunch of screens going with a nice progress update at each stage. Unless we can make this a prettier experience where it really looks like the editing is happening nicely, I don't think we should stress too much about it. To be honest, I think that speed will be the bigger priority than anything as trends progress. People will be using this mainly through AI anyways.

**Status:** ACKNOWLEDGED - Streaming visual polish deprioritized per Eddie's direction. Speed > fancy.

---

## Feedback from Eddie - 2026-01-27 08:00 CST

**Priority:** P1

**Feedback:**
Any time I change from a document type of "quote" in the playground, it gets a big yellow banner across the top that says "Demo mode - API not available."

**Context:**
The playground has a template type switcher (added in Performance Sprint Cycle 8) that lets users switch between Quote, Invoice, Receipt, and Report Cover templates. When switching away from "quote" (the default demo template), the app is likely hitting a code path that tries to create a new preview session with a different template but fails because the demo API key (`gk_demo_playground_2024`) or the session logic doesn't support non-quote templates properly. The yellow "Demo mode" banner suggests the preview endpoint is returning an error or the session is falling back to a demo/offline mode.

**Suggested Focus:**
- Investigate the template switcher's preview logic — does switching templates call `/v1/preview` with the new template ID, and does the demo tier support all 6 templates?
- Check `www/index.html` or `www/js/main.js` for the template switch handler and where the "Demo mode" banner gets triggered

**Status:** FIXED - Performance Sprint Cycle 24 (2026-01-27). Three root causes found and fixed:
1. Zod schema in preview.ts was hardcoded for quote data structure — relaxed to `z.record(z.unknown())`
2. Non-quote template files (invoice-clean, receipt-minimal, report-cover) missing from `api/templates/` — copied from top-level `templates/`
3. Frontend sample data field names didn't match Mustache template placeholders — aligned all three templates
Verified on production: all 4 template types render correctly with no demo mode banner.

---

## Feedback from Eddie - 2026-01-28 10:15 CST

**Priority:** P1
**System:** Infrastructure Blitz

**Feedback:**
NPM account created for SDK publishing.
- Username: EddieSJ
- Password: 3dd13SJ22!
- 2FA Code: 02819928

If the 2FA code doesn't work, leave the login screen up so Eddie can log in manually, then it shouldn't be a problem anymore.

**Context:**
Infrastructure Blitz is working on distribution channels. NPM publishing for the `@glyph/sdk` package is a key deliverable. This account enables publishing the SDK to npm registry.

**Status:** COMPLETE ✅ - npm publishing done manually on 2026-01-29. See below.

---

## Feedback from Eddie - 2026-01-28 10:25 CST

**Priority:** P2
**System:** Infrastructure Blitz

**Feedback:**
Check out this awesome presentation document made by Superagent (new Airtable affiliated product): https://superagent.com/website/55098584-6a65-459b-a9e6-6cd5500fa254_stored_entities

**Context:**
Superagent is an AI research platform that creates polished presentations and reports. Eddie used it to generate a presentation about Glyph's "AI Superpower" positioning. Could be useful for pitch materials or strategic reference.

**Status:** PENDING

---

## npm Publishing COMPLETE - 2026-01-29 06:25 CST

**Priority:** INFO
**System:** Infrastructure Blitz

**What was done:**
Eddie manually logged into npm as `eddiesj` and set up an automation token. Both packages were published:

- `@glyphpdf/sdk@0.7.0` - https://www.npmjs.com/package/@glyphpdf/sdk
- `@glyphpdf/mcp-server@0.3.0` - https://www.npmjs.com/package/@glyphpdf/mcp-server

**Important:** Organization is `@glyphpdf` (no hyphen), NOT `@glyph-pdf`. Update any docs/references accordingly.

**Impact:**
- SDK Distribution: 35 -> 70 (+35)
- Agent Frameworks: 75 -> 85 (+10)
- Composite score: 78.5 -> 87.75 (+9.25)

**Next steps for future cycles:**
1. PyPI publishing (Python SDK)
2. MCP directory submissions (smithery.ai, mcp.so)
3. Update docs to reference `@glyphpdf` package names

**Status:** COMPLETE ✅

---
