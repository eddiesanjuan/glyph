# Magic Data-to-PDF Build State

## Mission
Build the "connect data, see PDF" magic experience for Nick's E.F. San Juan use case.

## Progress
- Current Phase: 0
- Status: in-progress
- Started: 2026-01-31 08:52 CST
- Last Updated: 2026-01-31 08:52 CST

## Phase Completion
- [ ] Phase 0: Audit Current Capabilities
- [ ] Phase 1: One-Call Auto-Generate API
- [ ] Phase 2: Enhanced AI Matching
- [ ] Phase 3: Dashboard Magic Flow
- [ ] Phase 4: Playground Integration
- [ ] Phase 5A: Deploy
- [ ] Phase 5B: Verify with Real Use Cases

## Key Findings from Audit

### Backend (Wave 0A)
**Good news:** Substantial auto-mapping infrastructure exists:
- Document type detection (heuristic + AI fallback)
- Semantic field matching with synonym tables + Levenshtein + AI
- Confidence scoring (weighted formula)
- Template matching with minConfidence=0.3

**Critical Gap:** NO true one-call endpoint exists
- `/v1/generate/smart` requires pre-existing mapping
- `/v1/create` works from raw data but doesn't integrate with data sources
- Missing: `sourceId + recordId -> auto-template -> auto-map -> PDF`

**P1 Gaps:**
- AI suggest-mappings requires templateId upfront (can't auto-select)
- Missing domain synonyms: job/work_order, technician/assigned_to

### Dashboard (Wave 0B)
**Current flow is configuration-heavy:**
- 8 steps to connect data source
- 4 pieces of technical info required (token, base ID, table ID, view ID)
- NO preview until full PDF generation
- NO field mapping interface

**Critical UX Issues:**
- Shows success modal even on connection failure (false success state)
- No data preview after connection
- Mobile layout clipping at 375px
- No guidance on next steps after connection

**Missing Magic:**
- Instant data preview on connection
- Auto-field mapping with AI
- One-click PDF generation from connected data
- OAuth or URL-paste for easier Airtable connect

## Implementation Status
| Component | Status | Files |
|-----------|--------|-------|
| /v1/auto-generate | pending | - |
| Semantic matching | pending | - |
| Magic preview modal | pending | - |
| Quick mapping editor | pending | - |
| Playground integration | pending | - |

## Test Results
[Pending - Phase 5B]

## Blockers
None yet

## Next Steps
Run Phase 0 parallel audit wave (0A: Backend, 0B: Dashboard UX)
