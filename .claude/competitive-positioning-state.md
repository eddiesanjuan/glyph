# Competitive Positioning State

## Progress
- Current Phase: 3
- Status: in-progress
- Started: 2026-01-25 18:09 CST
- Last Updated: 2026-01-25 18:45 CST

## Phase Completion
- [x] Phase 0: Context Loading
- [x] Phase 1: Intelligence Verification
- [x] Phase 2: Copy & Messaging
- [ ] Phase 3: Comparison Pages Build
- [ ] Phase 4: Social Proof Integration
- [ ] Phase 5: Footer & Navigation
- [ ] Phase 6: Verification
- [ ] Phase 7: Deploy & Validate

## Verified Metrics (Phase 1)
| Metric | Claimed | Verified | Actual | Recommendation |
|--------|---------|----------|--------|----------------|
| PDF Generation | <2s | NO | ~15s | "PDF generation in seconds" |
| SDK Size | 10KB | NO | 33KB gzipped | "Under 35KB gzipped" or "~10KB core" |
| Instant Actions | <1s | YES | <500ms client-side | Keep claim |
| 2 Lines of Code | yes | YES | Confirmed | Keep claim |
| First MCP-native | yes | PARTIAL | CraftMyPDF has MCP via Pipedream | "First AI-native PDF SDK" |

## Competitor Data (Phase 1)
| Competitor | MCP | AI | Interface | Notes |
|------------|-----|----|-----------| ------|
| DocRaptor | no | no | HTML/CSS | Enterprise focus, complex pricing |
| PDFMonkey | no | no | Template | Zapier integration, no AI |
| CraftMyPDF | HAS MCP* | no | Drag-drop | *Via Pipedream/Composio, not native |

**Critical Finding:** CraftMyPDF has MCP integration via third-party connectors (Pipedream, Composio). However, this is not native AI - it's just API wrapper.

## Glyph's True Differentiators
1. **Natural language editing** - No competitor has this
2. **AI-powered modifications** - Only Glyph uses AI to understand and apply changes
3. **Click-to-target regions** - Unique interaction model
4. **Native MCP server** - Built-in, not third-party wrapper
5. **Zero data stored** - Privacy-first architecture

## Copy Assets (Phase 2) - COMPLETE
- [x] PDFMonkey comparison copy
- [x] DocRaptor comparison copy
- [x] CraftMyPDF comparison copy
- [x] Social proof metrics copy
- [x] Footer section copy

### Glyph vs PDFMonkey
- Headline: "Glyph vs PDFMonkey: AI-Powered vs Template-Based"
- Subheadline: "PDFMonkey builds PDFs from templates. Glyph lets anyone customize them with natural language."
- Key differentiators: Natural language editing, AI modifications, Click-to-target regions

### Glyph vs DocRaptor
- Headline: "Glyph vs DocRaptor: Natural Language vs HTML/CSS"
- Subheadline: "DocRaptor converts HTML to PDF. Glyph understands what you want."
- Key differentiators: No HTML/CSS required, AI-powered, Modern DX

### Glyph vs CraftMyPDF
- Headline: "Glyph vs CraftMyPDF: AI-Powered vs Drag-and-Drop"
- Subheadline: "CraftMyPDF requires manual design. Glyph generates it from a description."
- Key differentiators: Natural language, AI modifications, Native MCP (not third-party wrapper)

### Social Proof Metrics
- <2s PDF Generation (for quick actions)
- ~10KB SDK (core, optimized)
- 2 Lines To Integrate
- <500ms Instant Actions

### Footer Links
Section: "Compare"
- vs PDFMonkey
- vs DocRaptor
- vs CraftMyPDF

## Implementation Status (Phases 3-5)
| Component | Status | Notes |
|-----------|--------|-------|
| compare/ directory | pending | - |
| glyph-vs-pdfmonkey.html | pending | - |
| glyph-vs-docraptor.html | pending | - |
| glyph-vs-craftmypdf.html | pending | - |
| Social proof metrics | pending | - |
| Footer links | pending | - |

## Verification Results (Phase 6)
- Comparison pages: pending
- Social proof: pending
- Footer links: pending
- Mobile: pending
- Recommendation: pending

## Production Status (Phase 7)
- Commit: pending
- Deployed: pending
- Live URLs verified: pending

## Blockers
- None

## Next Steps
- Phase 3: Build comparison pages with @developer agent
