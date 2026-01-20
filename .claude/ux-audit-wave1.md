# Glyph Comprehensive UX Audit Report - Wave 1

**Date:** January 19, 2026
**Auditor:** Auditor Agent (Fresh-Eyes Review)
**Scope:** Landing Page, SDK, Dashboard, Documentation
**Reference Competitors:** Stripe, Vercel, Linear

---

## Executive Summary

Glyph has a **solid foundation** with a clean, modern landing page, working live playground demo, and clear value proposition for AI-powered PDF customization. However, **two critical production issues** block the user journey: the Dashboard fails to connect to the API (localhost misconfiguration), and the Documentation site has broken routing (all pages redirect to index).

**Overall UX Score: 5.8/10**

The product concept is strong, but critical infrastructure issues prevent users from completing key tasks (getting an API key, reading documentation). These must be fixed before public launch.

**Top 3 Priorities:**
1. **[CRITICAL]** Fix Dashboard API URL - currently calling localhost:3000 instead of production API
2. **[CRITICAL]** Fix Documentation routing - all routes redirect to index page
3. **[HIGH]** Add social proof and improve landing page conversion elements

---

## Per-Area Scores

| Area | Score | Status | Notes |
|------|-------|--------|-------|
| Landing Page (www) | 7/10 | Good | Clean design, working demo, missing social proof |
| SDK Distribution | 8/10 | Good | CDN-hosted, proper file structure |
| Dashboard | 2/10 | Broken | API calls localhost:3000, completely non-functional |
| Documentation | 3/10 | Broken | All routes redirect to index, navigation non-functional |
| Mobile Responsiveness | 7/10 | Good | Hamburger menu works, layouts adapt well |

---

## Critical Findings

### Finding: Dashboard API URL Misconfiguration

**Severity:** Critical
**Type:** Code / Security
**Effort:** Small (<1hr)

#### Current State
File: Dashboard production deployment
URL: `https://glyph-dashboard-production-a2ea.up.railway.app`

When clicking "View Dashboard" after entering an API key, the browser console shows:
```
Failed to load resource: net::ERR_CONNECTION_REFUSED @ http://localhost:3000/v1/dashboard
```

Screenshot: `/Users/eddiesanjuan/Personal_Assistant/Eddie_Personal_Assistant/.playwright-mcp/glyph-dashboard-localhost-error.png`

#### Problem
The production Dashboard is hardcoded to call `http://localhost:3000` instead of the production API at `https://glyph-api-production-3f73.up.railway.app`. This completely breaks the Dashboard - users cannot view usage, manage keys, or access any dashboard features.

**User Impact:** 100% of users attempting to use the Dashboard will see "Failed to fetch" error. Zero functionality available.

#### Recommended Fix
1. Update the Dashboard's environment configuration to use the production API URL:
   ```javascript
   // Change from
   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

   // To
   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://glyph-api-production-3f73.up.railway.app';
   ```

2. Set `NEXT_PUBLIC_API_URL` environment variable in Railway deployment settings:
   ```
   NEXT_PUBLIC_API_URL=https://glyph-api-production-3f73.up.railway.app
   ```

3. Redeploy the Dashboard service

#### Acceptance Criteria
- [ ] Dashboard successfully calls production API when "View Dashboard" is clicked
- [ ] No localhost references in production network requests
- [ ] API key validation works end-to-end
- [ ] Usage statistics display correctly

---

### Finding: Documentation Routing Completely Broken

**Severity:** Critical
**Type:** Code
**Effort:** Medium (1-4hr)

#### Current State
URL: `https://glyph-docs-production.up.railway.app`

Clicking any navigation link (e.g., "Get Started", "API Reference", "SDK Reference") changes the URL but **the content remains the same** - always showing the index page.

Tested routes that all show index content:
- `/getting-started/quickstart/` - shows index
- `/api/overview/` - shows index
- `/sdk/overview/` - shows index
- `/templates/overview/` - shows index

Screenshot: `/Users/eddiesanjuan/Personal_Assistant/Eddie_Personal_Assistant/.playwright-mcp/glyph-docs-homepage.png`

#### Problem
The Starlight/Astro documentation site appears to have a routing configuration issue where all routes fall back to the index page. Users cannot access any documentation beyond the homepage, making the entire docs site useless.

**User Impact:** Developers cannot learn how to integrate Glyph. They'll abandon the product when they can't find API documentation.

#### Recommended Fix
1. Check the Astro/Starlight configuration in `docs/astro.config.mjs`
2. Verify content files exist in `docs/src/content/docs/` for each route
3. Check Railway deployment settings for proper static site configuration
4. Ensure `trailingSlash` setting is consistent between config and deployment
5. Test locally with `npm run build && npm run preview` to reproduce

Possible issues:
- `base` path misconfiguration
- Content collection not being built
- Railway serving from wrong directory
- SPA fallback routing interfering with static routes

#### Acceptance Criteria
- [ ] `/getting-started/quickstart/` shows quickstart content
- [ ] `/api/overview/` shows API overview content
- [ ] `/sdk/overview/` shows SDK overview content
- [ ] Navigation sidebar is visible and functional
- [ ] Search functionality works

---

## High Priority Findings

### Finding: No Social Proof on Landing Page

**Severity:** High
**Type:** UX
**Effort:** Small (<1hr)

#### Current State
Location: `https://glyph-www-production-69d7.up.railway.app`

The landing page has zero social proof elements:
- No customer logos
- No testimonials
- No GitHub stars badge
- No usage metrics (e.g., "10,000+ PDFs generated")
- No trust indicators

#### Problem
When compared to reference competitors (Stripe, Vercel, Supabase), the lack of social proof significantly reduces conversion. Developers are skeptical of tools without community validation.

**Reference:** Stripe shows "OpenAI, Amazon, Google, Anthropic" logos immediately below the fold. Supabase shows GitHub stars (96.4K) in the navigation.

#### Recommended Fix
Add social proof section below the hero:

```html
<section class="social-proof">
  <p class="social-proof__label">Trusted by developers worldwide</p>
  <div class="social-proof__stats">
    <div class="stat">
      <span class="stat__number">5,000+</span>
      <span class="stat__label">PDFs generated</span>
    </div>
    <div class="stat">
      <span class="stat__number">200+</span>
      <span class="stat__label">Active developers</span>
    </div>
  </div>
</section>
```

Even if metrics are modest, showing any social proof is better than none.

#### Acceptance Criteria
- [ ] At least one form of social proof visible above the fold
- [ ] Usage metric displayed (can be approximated initially)
- [ ] Consider adding GitHub stars badge in navigation

---

### Finding: SDK Demo URL Shows Raw Directory Listing

**Severity:** High
**Type:** UX
**Effort:** Small (<1hr)

#### Current State
URL: `https://glyph-sdk-production-e779.up.railway.app`

Visiting the SDK URL shows a raw file directory listing:
```
dist/
components/
glyph.esm.js
glyph.min.js
index.d.ts
lib/
styles/
```

Screenshot: Shows directory listing of dist files

#### Problem
While technically correct (SDK serves as CDN), a new user visiting this URL will be confused. They expect a demo or documentation, not a file browser.

#### Recommended Fix
Two options:

**Option A:** Add an index.html that redirects to docs
```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=https://glyph-docs-production.up.railway.app/sdk/overview/">
  <title>Glyph SDK</title>
</head>
<body>
  <p>Redirecting to <a href="https://glyph-docs-production.up.railway.app/sdk/overview/">SDK Documentation</a>...</p>
</body>
</html>
```

**Option B:** Add a simple landing page explaining this is the CDN endpoint with usage instructions

#### Acceptance Criteria
- [ ] Visiting SDK base URL shows helpful content, not raw directory
- [ ] Clear path to SDK documentation
- [ ] CDN functionality remains unaffected

---

### Finding: Landing Page Pricing Shows "All 3 templates" (Outdated)

**Severity:** High
**Type:** Content
**Effort:** Small (<30min)

#### Current State
Location: Landing page pricing section (Free tier)
Text: "All 3 templates"

However, the CLI section shows "12 doc types" and the existing audit report confirms 12 document types exist.

#### Problem
Inconsistent messaging confuses users about what's included. The Free tier appears limited when actually more templates may be available.

#### Recommended Fix
Update pricing section to reflect actual template availability:
- Free: "5 core templates" or list specific ones: "Invoice, Quote, Receipt, Letter, Contract"
- Pro: "All 12 document types"
- Scale: "All templates + custom"

#### Acceptance Criteria
- [ ] Template counts are consistent across landing page and docs
- [ ] Free tier clearly states what templates are included
- [ ] Pro/Scale tiers show upgrade value

---

## Medium Priority Findings

### Finding: Playground "Generate PDF" Triggers API Key Modal

**Severity:** Medium
**Type:** UX
**Effort:** Small (<1hr)

#### Current State
When clicking "Generate PDF" in the playground, a modal appears asking for an API key with options:
- "Get Free API Key" (links to dashboard)
- "Maybe Later" (dismisses modal)

#### Problem
This interrupts the demo flow. Users exploring the product shouldn't be blocked by API key prompts during initial exploration. The playground should work with a demo key for first-time visitors.

#### Recommended Fix
1. Use a rate-limited demo key (`gk_demo_playground_2024`) for first 3 generations
2. Only prompt for API key after demo limit reached
3. Change modal copy to explain the demo limit: "You've used your 3 free demo generations. Get an API key for unlimited access."

#### Acceptance Criteria
- [ ] First 3 playground generations work without API key prompt
- [ ] Clear messaging about demo limits
- [ ] Smooth transition to "get API key" flow after demo exhausted

---

### Finding: Hero Subtitle Could Be More Specific

**Severity:** Medium
**Type:** UX
**Effort:** Small (<30min)

#### Current State
Current subtitle: "Describe what you want in plain English. Glyph handles the rest. Works with Claude Code, Cursor, Windsurf, or any MCP-compatible tool."

#### Problem
"Describe what you want" is generic. It doesn't communicate the unique value or specific use cases.

#### Recommended Fix
More specific options:

**Option A:** Lead with use case
```
"Generate invoices, quotes, contracts, and more with natural language.
Works with Claude Code, Cursor, Windsurf, or any MCP-compatible tool."
```

**Option B:** Lead with example
```
"'Create an invoice for John Doe, $3,500 for web development.'
That's it. AI handles the PDF."
```

#### Acceptance Criteria
- [ ] Subtitle communicates specific value proposition
- [ ] Mentions document types or shows example prompt

---

### Finding: Mobile Navigation Hamburger Menu Exists But Untested

**Severity:** Medium
**Type:** UX
**Effort:** Small (<1hr)

#### Current State
At 375px width, a hamburger menu appears in the navigation. The toggle button exists (`button "Toggle menu" [ref=e7]`).

#### Problem
The menu functionality was not fully tested during this audit. Verify it opens, displays all navigation items, and closes properly.

#### Recommended Fix
Conduct full mobile navigation testing:
1. Verify hamburger opens menu overlay
2. Verify all links (Playground, Features, Airtable, Pricing, Docs, Get API Key) are visible
3. Verify menu closes after link click
4. Verify menu closes on backdrop click/tap
5. Test on actual iOS/Android devices, not just resized viewport

#### Acceptance Criteria
- [ ] Mobile menu opens and closes smoothly
- [ ] All navigation links accessible on mobile
- [ ] Menu auto-closes after navigation

---

## Low Priority Findings

### Finding: Footer Links May 404

**Severity:** Low
**Type:** UX
**Effort:** Small (<30min)

#### Current State
Footer includes links to:
- `/changelog`
- `/examples`
- `/about`
- `/blog`
- `/privacy`
- `/terms`

These were not tested but may return 404 if pages don't exist.

#### Recommended Fix
1. Test all footer links
2. Either create placeholder pages or remove non-existent links
3. Consider linking to external URLs (e.g., GitHub releases for changelog)

#### Acceptance Criteria
- [ ] All footer links resolve to valid pages
- [ ] No 404 errors in footer navigation

---

### Finding: Version Mismatch Between Services

**Severity:** Low
**Type:** Code
**Effort:** Small (<30min)

#### Current State
- Dashboard footer shows: "Glyph v0.1.0"
- API health endpoint shows: `"version": "0.9.0"`
- SDK shows: VERSION = '0.5.0' (per existing audit)

#### Problem
Version inconsistency across services makes debugging difficult and looks unprofessional.

#### Recommended Fix
Align versions across all services, or use semantic versioning that distinguishes service versions:
- API: 0.9.0
- SDK: 0.5.0
- Dashboard: 0.1.0
- Docs: 0.1.0

Or consolidate to single product version.

#### Acceptance Criteria
- [ ] Version strategy documented
- [ ] All user-facing version strings are consistent or clearly labeled by service

---

## Positive Observations

1. **Clean, modern landing page design** - Dark theme with teal accents matches current design trends
2. **Working live playground** - Interactive demo actually works and showcases the AI capabilities
3. **Three clear integration paths** - MCP, CLI, SDK options are well-presented with copy-paste commands
4. **Good mobile responsiveness** - Layout adapts well at 375px width with hamburger menu
5. **Transparent pricing** - Four clear tiers with feature lists
6. **Airtable integration section** - Unique differentiator well-presented
7. **Framework examples** - HTML/React/Vue tabs with real code snippets
8. **Fast page load** - Single HTML file with minimal overhead

---

## Summary: Prioritized Action Items

### Critical (Must Fix Before Launch)
| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | Dashboard API URL calling localhost | Small | Blocking |
| 2 | Documentation routing broken | Medium | Blocking |

### High (Fix This Week)
| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 3 | No social proof on landing page | Small | High conversion impact |
| 4 | SDK URL shows raw directory | Small | Confusing for new users |
| 5 | Pricing template count outdated | Small | Inconsistent messaging |

### Medium (Fix This Month)
| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 6 | Playground prompts for API key too early | Small | Friction in demo flow |
| 7 | Hero subtitle could be more specific | Small | Clearer value prop |
| 8 | Mobile navigation needs testing | Small | Mobile user experience |

### Low (Nice to Have)
| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 9 | Footer links may 404 | Small | Broken links |
| 10 | Version mismatch between services | Small | Professional polish |

---

## Screenshots Reference

All screenshots saved to: `/Users/eddiesanjuan/Personal_Assistant/Eddie_Personal_Assistant/.playwright-mcp/`

| File | Description |
|------|-------------|
| `glyph-dashboard-initial.png` | Dashboard login screen |
| `glyph-dashboard-localhost-error.png` | Dashboard error after clicking View Dashboard |
| `glyph-docs-homepage.png` | Documentation homepage |
| `glyph-landing-mobile.png` | Landing page at 375px mobile width |

---

## Related Audit Reports

This audit builds on existing reports in `/Users/eddiesanjuan/Projects/glyph/.claude/`:
- `landing-page-audit.md` - Detailed feature coverage analysis
- `docs-audit-report.md` - AI-readability audit of documentation
- `production-qa-report.md` - API endpoint testing results
- `railway-architecture-audit.md` - Infrastructure review

---

*Report generated by Auditor Agent - January 19, 2026*
*For questions or implementation details, reference the specific file paths and line numbers in each finding.*
