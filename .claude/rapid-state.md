# Glyph Rapid State

## Current Cycle
- Started: 2026-01-30T12:30:00
- Phase: 5 (Deployed - Railway auto-building)
- Issues: 2 total, 2 fixed, 0 pending
- Commit: 941fdd7

## Issues Fixed (Nick's Follow-up Feedback)

| # | Type | Issue | Priority | Status |
|---|------|-------|----------|--------|
| 1 | bug | Dashboard→Playground auth broken (cross-domain localStorage) | P0 | FIXED |
| 2 | bug | Usage stats not recording for /v1/create and /v1/generate | P1 | FIXED |

## Root Causes Found

### Issue 1: Auth Flow Broken
- Dashboard stored key as `glyph_api_key` at dashboard.glyph.you
- Playground looked for `glyph_user_api_key` at glyph.you
- **localStorage is domain-scoped** - these can never share data!

**Fix:** URL parameter auth + auth modal
- Dashboard passes `?apiKey=gk_xxx` when linking to playground
- Playground saves to correct localStorage key and removes from URL
- Added settings icon (key) for manual API key entry
- Visual indicator when logged in

### Issue 2: Usage Stats Missing
- `/v1/create` and `/v1/generate` had NO usage tracking code
- Only `/v1/preview` and `/v1/modify` were tracked
- Nick called create/generate multiple times → none recorded

**Fix:** Added `trackCreateUsage()` and `trackGenerateUsage()` functions
- Fire-and-forget pattern (doesn't block response)
- Demo tier intentionally excluded
- Records endpoint, template, format

## Previous Cycle (Earlier Today)
| Cycle | Issues | Fixed | Deployed | Verified |
|-------|--------|-------|----------|----------|
| 2026-01-30 AM | 3 | 3 | ✓ | ✓ |

Changes shipped:
- `returnUrl: true` param for /v1/generate
- Airtable automation attachment docs
- API endpoint comparison docs
