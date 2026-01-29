# Infrastructure Blitz State

## Current Cycle
- Cycle: 2
- Status: SUCCESS
- Last Run: 2026-01-28 18:30 CST

## Pillar Scores

| Pillar | Score | Previous | Change | Weight | Weighted |
|--------|-------|----------|--------|--------|----------|
| One-Call API | 65 | 55 | +10 | 30% | 19.5 |
| SDK Distribution | 62 | 52 | +10 | 20% | 12.4 |
| Agent Frameworks | 68 | 68 | +0 | 20% | 13.6 |
| Template Network | 52 | 52 | +0 | 15% | 7.8 |
| Hosted Output | 60 | 0 | +60 | 10% | 6.0 |
| SEO/Discoverability | 45 | 30 | +15 | 5% | 2.25 |
| **COMPOSITE** | **61.55** | **49.8** | **+11.75** | | |

### Score Justifications (Cycle 2 Deltas)

**One-Call API: 55 -> 65 (+10)**
- +5: /v1/create now returns hosted URL in `url` field (was base64 data URL)
- +5: TTL parameter added to Zod schema (300s-604800s range, configurable)
- Still missing: docs don't mention `ttl` yet, `expiresAt` enforcement now real

**SDK Distribution: 52 -> 62 (+10)**
- +10: Python SDK created with `Glyph.create()`, 86 lines core, zero deps
- +3: pyproject.toml configured for PyPI publishing
- -3: Still not published to npm or PyPI

**Agent Frameworks: 68 -> 68 (no change)**
- No work done on this pillar this cycle

**Template Network: 52 -> 52 (no change)**
- No work done on this pillar this cycle

**Hosted Output: 0 -> 60 (+60)**
- +20: PDFs stored with unique `doc_` prefixed IDs
- +20: `GET /v1/documents/:id` returns PDF file
- +5: `GET /v1/documents/:id/metadata` returns JSON metadata (partial: exists but needs production verification)
- +15: URLs work without authentication (unguessable IDs)
- +0: TTL configurable (need to verify enforcement in production)
- Still missing: 410 Gone for expired docs needs production test, metadata endpoint partial

**SEO/Discoverability: 30 -> 45 (+15)**
- +12: Root README.md created with keyword optimization for AI PDF generation
- +3: README includes keywords, features, template listing, SDK examples
- Still missing: npm/PyPI publication, blog content, GitHub topics

## What Was Built This Cycle

### Improvement 1: Hosted Output System (Hosted Output pillar)
- Created `api/src/lib/documentStore.ts` - In-memory document store with Map
- Created `api/src/routes/documents.ts` - GET /:id and GET /:id/metadata
- Updated `api/src/routes/create.ts` - Now stores PDFs, returns hosted URLs
- Updated `api/src/index.ts` - Mounted documents route (public, no auth)
- Features: configurable TTL, 5-min cleanup interval, 50-doc demo limit, 410 Gone for expired
- **Files**: api/src/lib/documentStore.ts (new), api/src/routes/documents.ts (new), api/src/routes/create.ts, api/src/index.ts

### Improvement 2: Python SDK (SDK Distribution pillar)
- Created `packages/python/glyph_pdf/__init__.py` - Glyph class with create(), templates(), template_schema()
- Created `packages/python/glyph_pdf/py.typed` - PEP 561 marker
- Created `packages/python/pyproject.toml` - Package metadata
- Created `packages/python/README.md` - Documentation with examples
- 86 lines core logic, zero dependencies (stdlib urllib only)
- **Files**: packages/python/* (4 new files)

### Improvement 3: Root README.md (SEO pillar)
- Created keyword-optimized `/README.md` targeting "AI PDF generation", "PDF API", "generate PDF from JSON"
- Quick start, features, installation, usage examples, template listing
- **Files**: README.md (new)

### Improvement 4: /v1/create Docs Update (One-Call API pillar)
- Added "Input Methods" section documenting data+template, html, url paths
- Updated parameter table with conditional requirements
- Added cURL examples for HTML and URL input paths
- Added 502 error response for URL path
- **Files**: docs/src/content/docs/api/create.mdx

## What Blocked
- **npm/PyPI publishing**: Cannot publish without npm account setup and credentials. Deferred.
- **Production verification of hosted output**: Pushed code, waiting for Railway deploy. QA should verify.
- **Agent Frameworks**: No work this cycle (held at 68/100, not the lowest scoring pillar)

## What's Next (Prioritized)
1. **Verify hosted output on production** - Test /v1/documents/:id endpoint live
2. **npm publish @glyph-pdf/node** - Needs npm account, would unlock SDK Distribution scoring (+15 points)
3. **4 new templates** - Get to 15+ templates threshold (Template Network +7 points)
4. **MCP directory listings** - Submit to mcp.so, smithery.ai (Agent Frameworks +10 points)
5. **Blog/content marketing** - SEO guide targeting "AI PDF generation API" queries
6. **Template-specific TypeScript types** - Per-template data types (SDK Distribution +5 points)

## Dependencies Map
- One-Call API --> unlocks SDK, Agent Frameworks, Hosted Output
- Hosted Output --> unlocks shareable URLs (the key agent workflow) [NOW IMPLEMENTED]
- SDK Distribution --> unlocks npm/PyPI publishing, SEO via package listings
- Templates --> unlocks network effects, more use cases

## Cycle History

### Cycle 1 - 2026-01-28
- Composite: 17.05 -> 42.25 (+25.2)
- Baseline measured by 3 independent auditors (API testing + browser + codebase review)
- Improvements: /v1/create expanded, Node SDK, 4 agent framework integrations, docs+SEO overhaul
- Key Learning: One-Call API is the foundation -- everything else depends on it. Hosted Output at 0 is the biggest weighted gap remaining.
- Commit: e6cf0ce

### Cycle 2 - 2026-01-28
- Composite: 49.8 -> 61.55 (+11.75)
- 3 independent auditors scored all 6 pillars fresh (API curl tests + browser + codebase review)
- Improvements: Hosted Output system (in-memory store + /v1/documents), Python SDK, root README, docs update
- Key Learning: Hosted Output was the biggest single-pillar leap (0 -> 60, +6 weighted points). Publishing to npm/PyPI is the next critical gate -- SDK code exists but distribution score is capped without publication.
- Commit: 782e5f6
