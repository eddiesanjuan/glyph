# Glyph Rapid State

## Current Cycle
- Started: 2026-01-30T12:00:00
- Phase: 5 (Deployed - Awaiting Verification)
- Issues: 3 total, 3 fixed, 0 pending
- Commit: 56588ce

## Parsed Issues from Nick's Feedback (Jan 29, 2026)

| # | Type | Issue | Priority | Status |
|---|------|-------|----------|--------|
| 1 | feature | Add `returnUrl: true` to `/v1/generate` for hosted URL | P0 | FIXED |
| 2 | docs | Add Airtable Automation attachment pattern guide | P1 | FIXED |
| 3 | docs | Clarify `/v1/create` vs `/v1/generate` usage | P1 | FIXED |

## Changes Deployed

1. **API: `/v1/generate` now supports `returnUrl: true`**
   - When set, returns `{ success: true, url: "https://..." }` instead of binary
   - Perfect for Airtable scripts that can't parse binary responses

2. **Docs: Airtable Automation Email Attachment Guide**
   - Documents the two-automation pattern Nick discovered
   - Includes complete working script code
   - Covers the attachment field format gotcha

3. **Docs: API Endpoint Comparison**
   - Clear table showing when to use `/v1/create` vs `/v1/generate`
   - Recommends `/v1/create` for integrations (returns hosted URL by default)

## Recent Cycles
| Cycle | Issues | Fixed | Deployed | Verified |
|-------|--------|-------|----------|----------|
| 2026-01-30 | 3 | 3 | ✓ | pending |
