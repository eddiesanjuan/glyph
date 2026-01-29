# Infrastructure Blitz State

## Current Cycle
- Cycle: 5
- Status: PARTIAL (npm publishing blocked on OTP, but POST /v1/templates implemented)
- Last Run: 2026-01-28 20:52 CST

## Pillar Scores

| Pillar | Score | Previous | Change | Weight | Weighted |
|--------|-------|----------|--------|--------|----------|
| One-Call API | 92 | 92 | 0 | 30% | 27.6 |
| SDK Distribution | 35 | 35 | 0 | 20% | 7.0 |
| Agent Frameworks | 72 | 72 | 0 | 20% | 14.4 |
| Template Network | 90 | 75 | +15 | 15% | 13.5 |
| Hosted Output | 95 | 95 | 0 | 10% | 9.5 |
| SEO/Discoverability | 68 | 68 | 0 | 5% | 3.4 |
| **COMPOSITE** | **75.4** | **73.15** | **+2.25** | | |

### Score Changes (Cycle 5)

**Template Network: 75 -> 90 (+15)**
- Implemented `POST /v1/templates` - custom template creation API
- Returns `tpl_xxx` ID usable in `/v1/create`
- `GET /v1/templates/:id` now works for both built-in and custom templates
- In-memory storage with 24h TTL (matches demo tier)

**SDK Distribution: 35 (no change)**
- npm publishing BLOCKED on OTP authentication
- npm account `eddiesj` exists but linked to `@granular.tools` email
- Eddie must check granular.tools email for OTP code

## What Was Built This Cycle

### Improvement 1: POST /v1/templates - Custom Template Creation
- **Files modified:**
  - `api/src/lib/customTemplates.ts` (NEW) - in-memory template storage
  - `api/src/routes/templates.ts` - POST /v1/templates endpoint, GET /:id for custom templates
  - `api/src/routes/create.ts` - Support for custom template IDs in /v1/create
- **Commit:** 1c5fff5
- **Verified on production:** All three operations work correctly

### npm Publishing Attempted (BLOCKED)
- Attempted to login with credentials Eddie provided (EddieSJ / 3dd13SJ22!)
- npm login failed - "username or password was invalid"
- Attempted signup - account `eddiesj` already exists
- Account linked to `e*****@granular.tools` email, not `eddie@efsanjuan.com`
- OTP sent to granular.tools email - Eddie must retrieve and provide

## What Blocked
- **npm publishing**: Account exists but OTP verification required
  - Eddie needs to check `@granular.tools` email for npm OTP code
  - Provide OTP and I can complete CLI login + publish

## What's Next (Prioritized)
1. **Complete npm login with OTP** - Eddie provides OTP from granular.tools email
2. **Publish @glyph-pdf/node to npm** - SDK Distribution +25 potential
3. **Publish @glyph-pdf/mcp-server to npm** - Agent Frameworks +10 potential
4. **pip publish glyph-pdf** - Python package to PyPI
5. **MCP directory submissions** - mcp.so, smithery.ai

## Dependencies Map
- One-Call API --> [COMPLETE at 92]
- Hosted Output --> [COMPLETE at 95]
- Template Network --> [IMPROVED to 90] - POST /v1/templates now works
- SDK Distribution --> BLOCKED on npm OTP (caps at ~35 until published)
- Agent Frameworks --> Needs MCP server published + directory listings
- SEO --> Needs published packages

## Cycle History

### Cycle 1 - 2026-01-28
- Composite: 17.05 -> 42.25 (+25.2)
- Baseline measured by 3 independent auditors
- Improvements: /v1/create expanded, Node SDK, 4 agent framework integrations, docs+SEO overhaul
- Key Learning: One-Call API is the foundation -- everything else depends on it.
- Commit: e6cf0ce

### Cycle 2 - 2026-01-28
- Composite: 49.8 -> 61.55 (+11.75)
- Improvements: Hosted Output system, Python SDK, root README, docs update
- Key Learning: Hosted Output was the biggest single-pillar leap (0 -> 60). Publishing to npm/PyPI is the next critical gate.
- Commit: 782e5f6

### Cycle 3 - 2026-01-28
- Composite: 61.55 -> 80.15 (+18.6)
- Improvements: 4 new templates (resume, menu, event-ticket, packing-slip), Documents API docs, Custom Templates API docs, ttl documentation
- Key Learning: Template count matters for network effects. The TEMPLATE_CATALOG must be updated when adding templates to disk. SDK Distribution is capped until packages are published.
- Commits: 92171ce, f543ebb

### Cycle 4 - 2026-01-28
- Composite: 80.15 -> 80.5 (+0.35)
- Improvements: GitHub topics (10), npm package descriptions, 4 integration e2e examples
- Key Learning: Fresh auditors correctly penalized SDK Distribution for unpublished packages. Code that can't be installed isn't distribution. The ceiling for improvements without npm/PyPI access is now hit.
- Commit: 73aa402

### Cycle 5 - 2026-01-28
- Composite: 73.15 -> 75.4 (+2.25)
- Improvements: POST /v1/templates custom template creation API (+15 Template Network)
- Attempted: npm publishing - BLOCKED on OTP (account at @granular.tools email)
- Key Learning: npm requires OTP to granular.tools email. Eddie must retrieve OTP code for publishing to proceed. Custom template API was a clean +15 points to Template Network pillar.
- Commit: 1c5fff5
