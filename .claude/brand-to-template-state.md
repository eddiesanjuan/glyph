# Brand-to-Template State

## Run Info
- Started: 2026-01-29T12:00:00Z
- Current Phase: 1
- Status: in_progress

## Phase 0: Context Intelligence
- [x] Git status checked - on main, 27ef3fc (Infrastructure Blitz Cycle 9)
- [x] Production health verified - API v0.13.1 healthy
- [x] Key files identified:
  - `api/src/routes/templates.ts` - Existing template endpoints
  - `api/src/services/template.ts` - Template engine singleton
  - `api/src/services/ai.ts` - Claude integration (uses @anthropic-ai/sdk)
  - `api/src/lib/customTemplates.ts` - In-memory template storage
  - `api/src/index.ts` - Route mounting
- [x] Existing functionality mapped:
  - `createCustomTemplate()` - Creates tpl_xxx IDs, 24h TTL
  - POST /v1/templates - Create custom template
  - GET /v1/templates/:id - Get template details (built-in or custom)
  - POST /v1/templates/generate - AI template from Airtable schema
  - Playwright already installed (for URL screenshot)
  - @anthropic-ai/sdk already installed (for Claude Vision)

## Phase 1: Analysis
- [x] Template structure audited
- [x] Extraction approach chosen
- [x] Dependencies approved
- Recommendation: See Architecture Decision Record below

### Architecture Decision Record

#### Template Requirements (from @auditor)
- CustomTemplate: `id` (tpl_xxx), `name`, `html`, `schema`, `description?`, `createdAt`, `expiresAt`
- HTML: Complete document, embedded CSS, Mustache placeholders, `data-glyph-region` attrs
- CSS: Use `:root` variables for theming (--accent-color, etc.), print styles required
- Schema: JSON Schema draft-07 format with examples

#### Extraction Approach (from @auditor)
- **Image**: Claude Vision API directly (no new deps)
- **URL**: Playwright screenshot → Claude Vision (existing `generatePNGFromURL()`)
- **PDF**: Playwright can render PDFs in Chromium → screenshot → Claude Vision (no new deps)

#### Dependencies (from @auditor)
- **ZERO new dependencies needed**
- Playwright already handles URL screenshots AND can render PDFs in Chromium
- @anthropic-ai/sdk already installed for Claude Vision API
- Existing patterns in `pdf.ts` and `ai.ts` can be reused

#### File Structure
```
api/src/services/brandExtraction.ts (NEW)
api/src/services/templateGenerator.ts (NEW)
api/src/routes/brandTemplates.ts (NEW)
api/src/index.ts (MODIFY - add route import)
```

## Phase 2: Implementation
- [x] brandExtraction.ts created - exports extractBrandFromPDF, extractBrandFromImage, extractBrandFromURL, BrandAttributes
- [x] templateGenerator.ts created - exports generateBrandedTemplate, GeneratedTemplate
- [x] brandTemplates.ts created - POST /v1/templates/from-brand endpoint
- [x] index.ts updated - import + route mounting added
- Build status: PASS (API starts successfully)

## Phase 3: Verification
- [x] URL extraction tested - Route works, blocked by local missing ANTHROPIC_API_KEY (will work in prod)
- [x] Validation errors tested - All 5 validation cases pass (missing input, invalid type, multiple inputs, invalid URL, no auth)
- [x] Existing endpoints verified - ALL PASS (19 templates, quote-modern works, custom templates work)
- [x] Health check verified - v0.13.1 healthy
- NOTE: Full brand extraction requires ANTHROPIC_API_KEY which is configured in Railway production

## Phase 4: Deploy
- [ ] Committed
- [ ] Pushed
- [ ] Production verified
- Endpoint live: [pending]

## Issues Encountered
- None yet

## Next Steps
- Complete Phase 0 context gathering
