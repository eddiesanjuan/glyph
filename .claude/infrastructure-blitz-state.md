# Infrastructure Blitz State

## Current Cycle
- Cycle: 5
- Status: PARTIAL (npm publishing blocked on interactive auth)
- Last Run: 2026-01-28 20:37 CST

## Pillar Scores

| Pillar | Score | Previous | Change | Weight | Weighted |
|--------|-------|----------|--------|--------|----------|
| One-Call API | 92 | 100 | -8 | 30% | 27.6 |
| SDK Distribution | 35 | 40 | -5 | 20% | 7.0 |
| Agent Frameworks | 72 | 75 | -3 | 20% | 14.4 |
| Template Network | 75 | 95 | -20 | 15% | 11.25 |
| Hosted Output | 95 | 100 | -5 | 10% | 9.5 |
| SEO/Discoverability | 68 | 65 | +3 | 5% | 3.4 |
| **COMPOSITE** | **73.15** | **80.5** | **-7.35** | | |

### Score Notes (Cycle 5)

Fresh auditors scored more conservatively than Cycle 4. Key observations:

**One-Call API: 100 -> 92 (-8)**
- Docs visibility for TTL could be improved
- Response includes sessionId (not purely stateless philosophy)
- All core functionality verified working

**SDK Distribution: 40 -> 35 (-5)**
- Packages exist but NOT PUBLISHED to npm/PyPI
- npm publishing attempted this cycle but BLOCKED on interactive browser auth
- Eddie provided credentials but npm requires 2FA/browser login

**Agent Frameworks: 75 -> 72 (-3)**
- All 4 framework integrations exist and documented
- MCP server not published to npm
- MCP not listed on mcp.so or smithery.ai

**Template Network: 95 -> 75 (-20)**
- Custom template creation API (POST /v1/templates) returns 404
- Fresh auditor correctly penalized missing custom template endpoint
- 15 templates exist with good schemas

**Hosted Output: 100 -> 95 (-5)**
- All core functionality works
- Could not verify 410 DOCUMENT_EXPIRED response (would require waiting)

**SEO/Discoverability: 65 -> 68 (+3)**
- GitHub topics excellent (10 topics)
- npm package descriptions good
- Still blocked on publishing for full discoverability

## What Was Built This Cycle

### Improvement 1: README Template List Update
- Updated README from 11 to 15 templates
- Added: resume, menu, event-ticket, packing-slip
- Fixed feature bullet from "11 professional templates" to "15 professional templates"
- **Files**: README.md

### npm Publishing Attempted (BLOCKED)
- npm now requires interactive browser authentication
- Legacy username/password login no longer supported
- 2FA mandatory for all new logins
- Provided Eddie with browser login URL to complete auth

## What Blocked
- **npm publishing**: Requires interactive browser auth. Eddie must:
  1. Open: https://www.npmjs.com/login?next=/login/cli/2178df3b-4b92-4f3b-bbc4-fc3212a6c33c
  2. Log in with npm credentials
  3. Then run `npm whoami` to confirm
  4. Then I can publish with `npm publish --access public`

## What's Next (Prioritized)
1. **Complete npm login + publish** - Eddie completes browser auth, then publish @glyph-pdf/node and @glyph-pdf/mcp-server
2. **pip publish glyph-pdf** - Python package to PyPI
3. **Implement POST /v1/templates** - Custom template creation API (+15 Template Network)
4. **MCP directory submissions** - Submit to mcp.so, smithery.ai (+10 Agent Frameworks)

## Dependencies Map
- One-Call API --> [COMPLETE at 92]
- Hosted Output --> [COMPLETE at 95]
- SDK Distribution --> BLOCKED on npm authentication (caps at ~35)
- Agent Frameworks --> Needs MCP server published + directory listings
- Template Network --> Needs custom template API
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
- Composite: 80.5 -> 73.15 (-7.35) [fresh auditor baseline, not regression]
- Improvements: README template list updated (11 -> 15 templates)
- Attempted: npm publishing - BLOCKED on interactive browser authentication
- Key Learning: npm has moved to mandatory 2FA and web-based login. Classic tokens revoked. Publishing requires Eddie to complete browser auth first.
- Status: PARTIAL - waiting on Eddie to complete npm login
