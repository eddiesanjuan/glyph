---
name: magic-data-to-pdf
description: "Build the magic 'connect data, see PDF' experience. One-call auto-generation from data sources. Usage: /magic-data-to-pdf [--status|--resume|--phase=N|--verify-only]"
model: opus
---

# MAGIC DATA-TO-PDF - Connect Data, See PDF Instantly

## IDENTITY LOCK (SURVIVES COMPACT)

**READ THIS AFTER EVERY CONTEXT COMPACT.**

You are MAGIC-DATA-TO-PDF orchestrator. You ORCHESTRATE. You do NOT:
- Write application code
- Implement features
- Fix bugs
- Do ANY work that belongs to @developer, @qa-agent, @auditor

**BEFORE EVERY ACTION:** "Am I about to do work myself?"
If YES -> STOP -> Deploy the appropriate agent.

---

## The Vision

When a user connects their data (Airtable, REST API), Glyph should:

1. **Intelligently interpret the data** - Look at field names and sample values, understand the document type
2. **Auto-pick a template** - "This looks like a work order" or "This looks like a proposal"
3. **Auto-map fields intelligently** - See `Job Number` -> map to `work_order_number`
4. **Show preview immediately** - No manual configuration required
5. **Let user tweak if wrong** - Simple corrections, not complex config screens

**This is MAGIC - connect data, see PDF. No barriers.**

## Real Use Case

Nick from E.F. San Juan:
- **Lydia's FWO (Field Work Order)** - Airtable base with work order data
- **Service APM Proposals** - Airtable base with proposal data

Fields won't match template placeholders exactly. The system figures it out automatically.

---

## Agent Fleet

| Agent | Responsibility |
|-------|---------------|
| @auditor | Audit current gaps, UX friction, competitive analysis |
| @developer | All code implementation (backend + frontend) |
| @qa-agent | Testing, browser verification, E2E flows |

---

## Inputs

$ARGUMENTS: Optional flags
- `--status` - Check current progress
- `--resume` - Resume from last checkpoint
- `--phase=N` - Jump to specific phase
- `--verify-only` - Just test production
- `--audit-only` - Only run Phase 0 audit

---

## Run Initialization (MANDATORY FIRST STEP)

Before deploying ANY agent:

1. **Create Run State**
   ```bash
   mkdir -p .claude/runs/$(TZ='America/Chicago' date '+%Y%m%d-%H%M')-magic-data-to-pdf
   ```

2. **Load/Create State File**
   ```bash
   cat .claude/magic-data-to-pdf-state.md 2>/dev/null || echo "Starting fresh"
   ```

3. **Check Git Status**
   ```bash
   git status
   git log --oneline -5
   ```

4. **If --status flag**: Report state and exit
5. **If --resume flag**: Load state and jump to last incomplete phase
6. **If --verify-only flag**: Jump to Phase 5

---

## Architecture Overview

```
                    +------------------+
                    |   Phase 0        |
                    |   Audit Current  |
                    |   Capabilities   |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v----------+       +----------v---------+
    |   Phase 1          |       |   Phase 2          |
    |   One-Call API     |       |   Enhanced AI      |
    |   POST /v1/auto    |       |   Confidence +     |
    |                    |       |   Semantic Match   |
    +--------+-----------+       +----------+---------+
              |                             |
              +-------------+---------------+
                            |
                  +---------v---------+
                  |   Phase 3         |
                  |   Dashboard       |
                  |   Magic Flow      |
                  +---------+---------+
                            |
                  +---------v---------+
                  |   Phase 4         |
                  |   Playground      |
                  |   Integration     |
                  +---------+---------+
                            |
                  +---------v---------+
                  |   Phase 5         |
                  |   Deploy + Verify |
                  |   Real Use Cases  |
                  +-------------------+
```

---

## Phase 0: Audit Current State

**Deployment: PARALLEL WAVE**

### Wave 0A: Backend Capability Audit

**Agent: @auditor**

```markdown
## Mission: Audit Auto-Mapping Backend Capabilities

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

### Files to Analyze

1. **api/src/services/autoMatcher.ts**
   - What matching algorithms exist?
   - What confidence scoring is used?
   - Gap: Does it use AI for semantic matching or just string matching?

2. **api/src/services/aiAssistant.ts**
   - What AI capabilities exist?
   - Is there document type detection?
   - Is there smart field mapping with reasoning?

3. **api/src/routes/sources.ts**
   - What happens when a source is created?
   - Is auto-matching triggered automatically?
   - Are match suggestions returned?

4. **api/src/routes/ai-assist.ts**
   - What AI endpoints exist?
   - `/suggest-mappings` - Does it work without manual template selection?
   - `/infer-schema` - Does it detect document type?
   - `/match-template` - Does it auto-select best template?

5. **api/src/routes/sessions.ts**
   - `/from-mapping` endpoint - Does it work?
   - Can it create session from source+auto-detected template?

### Questions to Answer

1. **Document Type Detection**
   - Q: Can the system look at raw data and say "this is a work order"?
   - Evidence needed: Code that infers document type from field names/values

2. **Semantic Field Matching**
   - Q: Can it match `Job Number` to `work_order_number`?
   - Evidence needed: Synonym tables, AI-based matching, fuzzy matching

3. **Confidence Scoring**
   - Q: Does it provide confidence scores for matches?
   - Q: Is there a threshold (e.g., >80% = proceed, <80% = ask)?
   - Evidence needed: Confidence calculation code

4. **One-Call Generation**
   - Q: Can we go from sourceId+recordId -> PDF in one call?
   - Evidence needed: Endpoint that handles all steps automatically

5. **Edge Case Handling**
   - Q: What happens with unknown document types?
   - Q: What happens with weird field names?
   - Evidence needed: Fallback logic, error handling

### Return Format
```json
{
  "currentCapabilities": {
    "documentTypeDetection": { "exists": true|false, "location": "file:line", "gaps": [] },
    "semanticFieldMatching": { "exists": true|false, "location": "file:line", "gaps": [] },
    "confidenceScoring": { "exists": true|false, "location": "file:line", "gaps": [] },
    "oneCallGeneration": { "exists": true|false, "location": "file:line", "gaps": [] },
    "edgeCaseHandling": { "exists": true|false, "location": "file:line", "gaps": [] }
  },
  "criticalGaps": [
    { "gap": "description", "priority": "P0|P1|P2", "effort": "small|medium|large" }
  ],
  "recommendedApproach": "description of best path forward"
}
```
```

### Wave 0B: Dashboard UX Audit

**Agent: @auditor**

```markdown
## Mission: Audit Dashboard Data Source Flow

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

**Production URL:** https://dashboard.glyph.you

### Flow to Test

1. Navigate to dashboard.glyph.you
2. Log in or use demo mode
3. Find "Connect Data Source" or "Airtable" option
4. Attempt to connect a data source

### Questions to Answer

1. **Onboarding Flow**
   - How many steps to connect a data source?
   - Is there a "magic" immediate preview?
   - Or is it a configuration-heavy wizard?

2. **Post-Connection Experience**
   - After connecting, what does user see?
   - Immediate preview? Or configuration screen?
   - How long until they see their data in a PDF?

3. **Friction Points**
   - Where does the flow feel slow or confusing?
   - What manual steps could be automated?
   - What error messages are unclear?

4. **Mobile Experience**
   - Does the flow work on 375px viewport?
   - Any touch/scroll issues?

### Use Browser Testing
```bash
# Navigate to dashboard
agent-browser open https://dashboard.glyph.you
agent-browser snapshot -i

# Screenshot each step
agent-browser screenshot audit-dashboard-step1.png
```

### Return Format
```json
{
  "currentFlow": {
    "stepsToConnect": N,
    "stepsToSeePreview": N,
    "timeToFirstPreview": "N seconds/clicks"
  },
  "frictionPoints": [
    { "step": "description", "friction": "what's wrong", "fix": "how to improve" }
  ],
  "missingMagic": [
    "what should happen automatically but doesn't"
  ],
  "screenshots": ["path/to/screenshot.png"]
}
```
```

### Wave 0C: Competitive Intelligence (Optional)

**Agent: @auditor**

```markdown
## Mission: Quick Competitive Check

**Competitors to Check:**
- DocRaptor - How do they handle data connection?
- PDFMonkey - Their template-data flow
- CraftMyPDF - Their Airtable integration

### Questions
1. Do any competitors offer "magic" auto-matching?
2. What's the best-in-class data connection experience?
3. What can we learn/steal?

### Return Format
```json
{
  "bestPractices": ["list of things competitors do well"],
  "differentiators": ["what Glyph can do better"],
  "stealable": ["specific features to copy"]
}
```
```

### Phase 0 Synthesis

After all audits complete:

1. Combine capability gaps + UX friction + competitive insights
2. Prioritize based on:
   - P0: Blockers to "magic" experience
   - P1: Significantly improves experience
   - P2: Nice to have
3. Update implementation plan for Phase 1-4

---

## Phase 1: One-Call Auto-Generate API

**Deployment: @developer**

### Mission

Create `POST /v1/auto-generate` - The magic endpoint that does everything.

```markdown
## Mission: Implement One-Call Auto-Generate Endpoint

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

### Create: api/src/routes/auto-generate.ts

```typescript
/**
 * Auto-Generate Routes
 * The "magic" endpoint - connect data, get PDF
 *
 * POST /v1/auto-generate - Complete auto-generation from source
 */

import { Hono } from "hono";
import { z } from "zod";
import { getSupabase, supabase } from "../lib/supabase.js";
import { findMatchingTemplates } from "../services/autoMatcher.js";
import { suggestMappings, inferSchema } from "../services/aiAssistant.js";
import { createConnector } from "../services/connectors/index.js";
import { applyMappings } from "../services/fieldMapper.js";
import Mustache from "mustache";

const autoGenerate = new Hono();

// Request schema
const autoGenerateSchema = z.object({
  // Primary input - one of these is required
  sourceId: z.string().uuid().optional(),
  rawData: z.record(z.unknown()).optional(),

  // Optional overrides
  recordId: z.string().optional(),
  templateId: z.string().uuid().optional(), // Override auto-selection
  mappingOverrides: z.record(z.string()).optional(), // Override specific mappings

  // Output options
  format: z.enum(['pdf', 'png', 'html', 'preview']).default('preview'),

  // Behavior options
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
  autoAcceptAboveThreshold: z.boolean().default(true),
}).refine(
  data => data.sourceId || data.rawData,
  { message: "Either sourceId or rawData is required" }
);

/**
 * POST /v1/auto-generate
 *
 * The magic endpoint. Given a data source or raw data:
 * 1. Detect document type
 * 2. Find best matching template
 * 3. Auto-map fields
 * 4. Generate preview or PDF
 *
 * All in ONE call.
 */
autoGenerate.post("/", async (c) => {
  const apiKeyId = c.get("apiKeyId") as string | null;

  // Parse request
  const body = await c.req.json();
  const validation = autoGenerateSchema.safeParse(body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: "Validation failed",
      details: validation.error.issues
    }, 400);
  }

  const {
    sourceId,
    rawData,
    recordId,
    templateId: overrideTemplateId,
    mappingOverrides,
    format,
    confidenceThreshold,
    autoAcceptAboveThreshold
  } = validation.data;

  try {
    // STEP 1: Get the data
    let sourceData: Record<string, unknown>;
    let schema: any;

    if (sourceId) {
      // Fetch from registered source
      const { data: source } = await getSupabase()
        .from("data_sources")
        .select("*")
        .eq("id", sourceId)
        .single();

      if (!source) {
        return c.json({ success: false, error: "Source not found" }, 404);
      }

      const connector = createConnector(source);

      if (recordId) {
        const record = await connector.fetchRecord(recordId);
        sourceData = record?.fields || {};
      } else {
        const records = await connector.fetchRecords({ limit: 1 });
        sourceData = records[0]?.fields || {};
      }

      schema = source.discovered_schema;
    } else {
      // Use raw data directly
      sourceData = rawData!;

      // Infer schema from raw data
      const inferred = await inferSchema(rawData!);
      schema = inferred.schema;
    }

    // STEP 2: Find best template (unless overridden)
    let selectedTemplate: any;
    let templateConfidence: number;
    let templateReasoning: string;

    if (overrideTemplateId) {
      // Use specified template
      const { data: template } = await getSupabase()
        .from("templates")
        .select("*")
        .eq("id", overrideTemplateId)
        .single();

      selectedTemplate = template;
      templateConfidence = 1.0;
      templateReasoning = "User specified template";
    } else {
      // Auto-select best template
      const matches = await findMatchingTemplates(schema, apiKeyId, {
        maxResults: 1,
        minConfidence: 0.3
      });

      if (matches.length === 0) {
        return c.json({
          success: false,
          error: "No matching template found",
          code: "NO_TEMPLATE_MATCH",
          suggestion: "Create a custom template or provide a templateId"
        }, 400);
      }

      const bestMatch = matches[0];
      templateConfidence = bestMatch.confidence;
      templateReasoning = bestMatch.reasoning;

      // Check confidence threshold
      if (templateConfidence < confidenceThreshold && !autoAcceptAboveThreshold) {
        return c.json({
          success: false,
          code: "LOW_CONFIDENCE",
          confidence: templateConfidence,
          reasoning: templateReasoning,
          suggestedTemplate: {
            id: bestMatch.templateId,
            name: bestMatch.templateName,
            isBuiltIn: bestMatch.isBuiltIn
          },
          message: `Best match confidence (${Math.round(templateConfidence * 100)}%) is below threshold (${Math.round(confidenceThreshold * 100)}%). Confirm or provide templateId.`
        }, 200); // 200 because it's not an error, just needs confirmation
      }

      // Fetch the template
      if (bestMatch.isBuiltIn) {
        // Fetch from built-in templates
        // (implementation depends on how built-ins are stored)
        selectedTemplate = await getBuiltInTemplate(bestMatch.templateId);
      } else {
        const { data: template } = await getSupabase()
          .from("templates")
          .select("*")
          .eq("id", bestMatch.templateId)
          .single();
        selectedTemplate = template;
      }
    }

    if (!selectedTemplate) {
      return c.json({ success: false, error: "Template not found" }, 404);
    }

    // STEP 3: Map fields
    const templateFields = extractTemplateFields(selectedTemplate.html_template);
    const mappingResult = await suggestMappings(templateFields, schema);

    // Apply any overrides
    const finalMappings = { ...Object.fromEntries(
      mappingResult.suggestions.map(s => [s.templateField, s.sourceField])
    ), ...mappingOverrides };

    // Transform source data using mappings
    const mappedData = applyMappingsToData(sourceData, finalMappings);

    // STEP 4: Render template
    const renderedHtml = Mustache.render(selectedTemplate.html_template, mappedData);

    // STEP 5: Generate output
    if (format === 'preview' || format === 'html') {
      return c.json({
        success: true,
        preview: {
          html: renderedHtml,
          templateUsed: {
            id: selectedTemplate.id,
            name: selectedTemplate.name,
            confidence: templateConfidence,
            reasoning: templateReasoning
          },
          mappingsApplied: finalMappings,
          unmappedFields: mappingResult.unmapped,
          mappingCoverage: mappingResult.coverage
        }
      });
    }

    // For PDF/PNG, use the generate service
    // ... (implementation for PDF generation)

    return c.json({
      success: true,
      url: "...", // Generated PDF URL
      templateUsed: { ... },
      mappingsApplied: finalMappings
    });

  } catch (error) {
    console.error("[Auto-Generate] Error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Auto-generation failed",
      code: "AUTO_GENERATE_ERROR"
    }, 500);
  }
});

export default autoGenerate;
```

### Mount the Route

In `api/src/index.ts`:
```typescript
import autoGenerate from './routes/auto-generate.js';

// Mount routes
app.route('/v1/auto-generate', autoGenerate);
```

### Key Implementation Details

1. **Dual Input Support**
   - `sourceId` - Use registered data source
   - `rawData` - Direct JSON payload (no source needed)

2. **Confidence-Based Flow**
   - Above threshold: Proceed automatically
   - Below threshold: Return suggestion, require confirmation

3. **Override Capability**
   - `templateId` - Skip auto-selection
   - `mappingOverrides` - Fix specific field mappings

4. **Multiple Output Formats**
   - `preview` - HTML for display
   - `html` - Raw HTML string
   - `pdf` - Generate PDF file
   - `png` - Generate PNG image

### Return Format
```json
{
  "status": "completed" | "blocked",
  "filesCreated": ["api/src/routes/auto-generate.ts"],
  "filesModified": ["api/src/index.ts"],
  "testInstructions": "curl -X POST ...",
  "blockers": null | "description"
}
```
```

### Phase 1 Acceptance Criteria
- [ ] POST /v1/auto-generate endpoint exists
- [ ] Works with sourceId input
- [ ] Works with rawData input
- [ ] Auto-selects template when not specified
- [ ] Respects confidence threshold
- [ ] Returns preview with mappings applied
- [ ] Handles edge cases gracefully

---

## Phase 2: Enhanced AI Matching

**Deployment: @developer**

### Mission

Enhance the AI matching to be truly intelligent - semantic matching, value-based inference, better confidence scoring.

```markdown
## Mission: Enhance AI Field Matching Intelligence

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

### Enhance: api/src/services/autoMatcher.ts

Add semantic matching capabilities:

```typescript
/**
 * Enhanced synonym groups for semantic matching
 * Organized by domain concepts
 */
const SEMANTIC_GROUPS = {
  // Document identification
  documentId: ['number', 'no', 'num', 'id', 'ref', 'reference', 'code', '#'],

  // Work orders / Service
  workOrder: ['work_order', 'wo', 'job', 'ticket', 'task', 'fwo', 'service_order'],

  // People
  customer: ['customer', 'client', 'buyer', 'purchaser', 'contact', 'account'],
  vendor: ['vendor', 'seller', 'supplier', 'provider', 'merchant'],
  technician: ['technician', 'tech', 'worker', 'employee', 'assignee', 'staff'],

  // Money
  amount: ['total', 'amount', 'sum', 'grand_total', 'price', 'cost', 'value'],

  // Dates
  date: ['date', 'created', 'timestamp', 'created_at', 'created_date', 'datetime'],
  dueDate: ['due', 'due_date', 'deadline', 'expected', 'scheduled'],

  // Descriptions
  description: ['description', 'desc', 'details', 'notes', 'comments', 'summary', 'scope'],

  // Line items
  items: ['items', 'line_items', 'products', 'services', 'entries', 'lines', 'details'],

  // Address
  address: ['address', 'location', 'street', 'addr', 'site', 'place'],

  // Status
  status: ['status', 'state', 'condition', 'stage', 'phase'],
  priority: ['priority', 'urgency', 'importance', 'level'],
};

/**
 * Match field semantically using multiple strategies
 */
function semanticMatch(
  sourceField: string,
  templateField: string
): { matches: boolean; confidence: number; reasoning: string } {
  const src = normalizeFieldName(sourceField);
  const tpl = normalizeFieldName(templateField);

  // Strategy 1: Exact match after normalization
  if (src === tpl) {
    return { matches: true, confidence: 0.98, reasoning: "Exact match" };
  }

  // Strategy 2: Contains match
  if (src.includes(tpl) || tpl.includes(src)) {
    return { matches: true, confidence: 0.85, reasoning: "Partial name match" };
  }

  // Strategy 3: Semantic group match
  for (const [concept, synonyms] of Object.entries(SEMANTIC_GROUPS)) {
    const srcMatches = synonyms.some(s => src.includes(s));
    const tplMatches = synonyms.some(s => tpl.includes(s));

    if (srcMatches && tplMatches) {
      return {
        matches: true,
        confidence: 0.80,
        reasoning: `Semantic match: both represent "${concept}"`
      };
    }
  }

  // Strategy 4: Levenshtein similarity for typos/variations
  const similarity = levenshteinSimilarity(src, tpl);
  if (similarity > 0.8) {
    return {
      matches: true,
      confidence: similarity * 0.9,
      reasoning: `String similarity: ${Math.round(similarity * 100)}%`
    };
  }

  return { matches: false, confidence: 0, reasoning: "No match found" };
}

function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')  // Remove separators
    .replace(/s$/, '');         // Remove trailing 's' for plurals
}
```

### Enhance: api/src/services/aiAssistant.ts

Improve AI-powered matching with value analysis:

```typescript
/**
 * Enhanced mapping suggestion with value-based inference
 */
export async function suggestMappingsWithValueAnalysis(
  templateFields: string[],
  sourceSchema: DiscoveredSchema,
  sampleData: Record<string, unknown>
): Promise<SuggestMappingsResult> {
  // Include sample values in the AI prompt for smarter matching
  const fieldsWithSamples = sourceSchema.fields.map(f => ({
    ...f,
    sampleValue: sampleData[f.name] || sampleData[f.path]
  }));

  const prompt = `You are a data mapping expert. Given template fields and source data with samples, suggest the best mappings.

Template requires these fields:
${templateFields.map(f => `- {{${f}}}`).join('\n')}

Source data has these fields (with sample values):
${fieldsWithSamples.map(f =>
  `- ${f.name} (type: ${f.type}, sample: ${JSON.stringify(f.sampleValue)})`
).join('\n')}

For each template field, suggest the best source field. Use the SAMPLE VALUES to understand what each field actually contains.

For example:
- If template needs "customer_name" and source has "Contact" with sample "John Smith", that's a match
- If template needs "work_order_number" and source has "Job #" with sample "WO-2024-001", that's a match

Return JSON with high confidence for clear matches, lower confidence for guesses:
{
  "suggestions": [
    {
      "templateField": "{{field}}",
      "sourceField": "path.to.field",
      "confidence": 0.95,
      "reasoning": "Why this match makes sense"
    }
  ]
}`;

  // ... rest of implementation
}

/**
 * Detect document type using AI with sample data
 */
export async function detectDocumentTypeWithAI(
  sampleData: Record<string, unknown>
): Promise<{ type: string; confidence: number; reasoning: string }> {
  const prompt = `Analyze this data sample and determine what type of document it represents.

Data:
${JSON.stringify(sampleData, null, 2)}

Common document types:
- work_order: Field service, maintenance, repair jobs
- invoice: Bills, payment requests
- quote: Estimates, proposals, quotations
- receipt: Payment confirmations
- proposal: Business proposals, project proposals
- certificate: Awards, completions, credentials
- contract: Agreements, legal documents
- shipping: Packing slips, shipping labels
- purchase_order: PO documents

Return JSON:
{
  "type": "document_type",
  "confidence": 0.9,
  "reasoning": "Why this is the detected type"
}`;

  // ... implementation
}
```

### Return Format
```json
{
  "status": "completed" | "blocked",
  "filesModified": [
    "api/src/services/autoMatcher.ts",
    "api/src/services/aiAssistant.ts"
  ],
  "improvements": [
    "Semantic matching with domain concepts",
    "Value-based field inference",
    "AI-powered document type detection"
  ],
  "blockers": null | "description"
}
```
```

### Phase 2 Acceptance Criteria
- [ ] Semantic matching handles common synonyms
- [ ] Value analysis improves mapping accuracy
- [ ] Document type detection works with real E.F. San Juan data patterns
- [ ] Confidence scores are more accurate

---

## Phase 3: Dashboard Magic Flow

**Deployment: @developer**

### Mission

Transform the dashboard data source flow from configuration-heavy to magic-first.

```markdown
## Mission: Build Dashboard Magic Flow

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

### Modify: dashboard/src/app.tsx

**Goal:** When user connects a data source, IMMEDIATELY show a preview (not a config screen).

### New Component: MagicPreviewModal

```tsx
interface MagicPreviewModalProps {
  sourceId: string;
  onAccept: (templateId: string) => void;
  onAdjust: () => void;
  onClose: () => void;
}

function MagicPreviewModal({ sourceId, onAccept, onAdjust, onClose }: MagicPreviewModalProps) {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    autoGeneratePreview();
  }, [sourceId]);

  async function autoGeneratePreview() {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/v1/auto-generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceId,
          format: 'preview',
          confidenceThreshold: 0.5,
          autoAcceptAboveThreshold: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setPreview(data.preview);
      } else if (data.code === 'LOW_CONFIDENCE') {
        // Show suggestion but require confirmation
        setPreview({
          ...data,
          needsConfirmation: true
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Modal>
        <div className="magic-loading">
          <Spinner />
          <h3>Glyph is analyzing your data...</h3>
          <p>Finding the best template and mapping your fields</p>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal>
        <div className="magic-error">
          <h3>Couldn't auto-match</h3>
          <p>{error}</p>
          <button onClick={onAdjust}>Choose Template Manually</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal>
      <div className="magic-preview">
        <div className="magic-header">
          <h2>Here's your document!</h2>
          <p>
            Glyph matched {preview.mappingsApplied.length} fields
            ({Math.round(preview.mappingCoverage * 100)}% coverage)
            using "{preview.templateUsed.name}"
          </p>
        </div>

        <div className="magic-preview-content">
          {/* Render the HTML preview in an iframe or shadow DOM */}
          <iframe
            srcDoc={preview.html}
            className="preview-frame"
          />
        </div>

        {preview.unmappedFields?.length > 0 && (
          <div className="magic-warnings">
            <p>Some fields couldn't be mapped:</p>
            <ul>
              {preview.unmappedFields.map(f => <li key={f}>{f}</li>)}
            </ul>
          </div>
        )}

        <div className="magic-actions">
          <button
            className="primary"
            onClick={() => onAccept(preview.templateUsed.id)}
          >
            Looks Good - Save Template
          </button>
          <button onClick={onAdjust}>
            Adjust Mappings
          </button>
        </div>

        {preview.needsConfirmation && (
          <div className="confidence-warning">
            <p>
              Confidence: {Math.round(preview.confidence * 100)}% -
              Please verify the mappings look correct
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

### Modify: Data Source Connection Flow

After Airtable/REST source is created successfully:

```tsx
// In the connect flow, after source is created:
async function handleSourceCreated(source: DataSource) {
  // Immediately show magic preview instead of config screen
  setShowMagicPreview(true);
  setNewSourceId(source.id);
}

// In render:
{showMagicPreview && (
  <MagicPreviewModal
    sourceId={newSourceId}
    onAccept={async (templateId) => {
      // Save the template-source link
      await fetch(`${API_URL}/v1/sources/${newSourceId}/accept-match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ templateId })
      });

      // Redirect to My Templates
      setShowMagicPreview(false);
      setActiveView('my-templates');
      showToast('Template created from your data!', 'success');
    }}
    onAdjust={() => {
      // Show field mapping editor
      setShowMagicPreview(false);
      setShowMappingEditor(true);
    }}
    onClose={() => setShowMagicPreview(false)}
  />
)}
```

### New Component: QuickMappingEditor

Simple correction UI for when auto-mapping isn't quite right:

```tsx
function QuickMappingEditor({
  templateFields,
  sourceFields,
  currentMappings,
  onSave
}: QuickMappingEditorProps) {
  const [mappings, setMappings] = useState(currentMappings);

  return (
    <div className="quick-mapping-editor">
      <h3>Fix Field Mappings</h3>
      <p>Click any field that's wrong to fix it</p>

      <div className="mapping-grid">
        {templateFields.map(tf => (
          <div key={tf} className="mapping-row">
            <span className="template-field">{tf}</span>
            <span className="arrow">→</span>
            <select
              value={mappings[tf] || ''}
              onChange={(e) => setMappings({
                ...mappings,
                [tf]: e.target.value
              })}
            >
              <option value="">-- Select --</option>
              {sourceFields.map(sf => (
                <option key={sf} value={sf}>{sf}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button onClick={() => onSave(mappings)}>
        Save & Preview
      </button>
    </div>
  );
}
```

### Add CSS

```css
.magic-loading {
  text-align: center;
  padding: 3rem;
}

.magic-preview {
  max-width: 800px;
}

.magic-header {
  margin-bottom: 1.5rem;
}

.magic-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.preview-frame {
  width: 100%;
  height: 500px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.magic-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.magic-actions .primary {
  background: var(--accent);
  color: white;
  font-weight: 500;
}

.quick-mapping-editor .mapping-grid {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0;
}

.mapping-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.template-field {
  font-family: monospace;
  background: var(--muted);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
```

### Return Format
```json
{
  "status": "completed" | "blocked",
  "componentsCreated": [
    "MagicPreviewModal",
    "QuickMappingEditor"
  ],
  "filesModified": [
    "dashboard/src/app.tsx",
    "dashboard/src/app.css"
  ],
  "flow": "Source created -> Magic preview shown -> Accept or adjust -> My Templates",
  "blockers": null | "description"
}
```
```

### Phase 3 Acceptance Criteria
- [ ] Connecting data shows immediate preview
- [ ] Preview uses auto-matched template
- [ ] User can accept with one click
- [ ] User can adjust mappings with simple editor
- [ ] Flow feels "magic" not "configuration"

---

## Phase 4: Playground Integration

**Deployment: @developer**

### Mission

Ensure playground can load and edit templates created via the magic flow.

```markdown
## Mission: Integrate Magic Templates with Playground

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

### Modify: www/index.html

**1. Support Magic Template Loading**

When loading from URL params, handle magic-created templates:

```javascript
// Parse URL for magic template loading
const urlParams = new URLSearchParams(window.location.search);
const magicMappingId = urlParams.get('mapping');
const sourceRecordId = urlParams.get('record');

if (magicMappingId) {
  loadMagicTemplate(magicMappingId, sourceRecordId);
}

async function loadMagicTemplate(mappingId, recordId) {
  // Show loading state
  setPlaygroundState('loading');
  showLoadingMessage('Loading your template...');

  try {
    // Use auto-generate to get preview with this mapping
    const response = await fetch(`${API_URL}/v1/auto-generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mappingId,
        recordId,
        format: 'preview'
      })
    });

    const data = await response.json();

    if (data.success) {
      // Load into playground
      currentSessionState.html = data.preview.html;
      currentSessionState.templateHtml = data.preview.templateHtml; // Mustache template
      currentSessionState.mappingId = mappingId;
      currentSessionState.data = data.preview.mappedData;

      // Show linked mode banner
      showLinkedModeBanner(data.preview.templateUsed.name, data.preview.sourceUsed.name);

      // Render
      await renderPreview();
    } else {
      showError(data.error);
    }
  } catch (error) {
    showError('Failed to load template');
  }
}
```

**2. Record Navigation**

When editing a linked template, allow cycling through records:

```javascript
function addRecordNavigation() {
  if (!currentSessionState.mappingId) return;

  // Add navigation UI
  const nav = document.createElement('div');
  nav.className = 'record-navigation';
  nav.innerHTML = `
    <button onclick="loadPreviousRecord()">< Previous</button>
    <span class="record-indicator">Record ${currentRecordIndex + 1}</span>
    <button onclick="loadNextRecord()">Next ></button>
  `;

  document.querySelector('.playground-header').appendChild(nav);
}

async function loadNextRecord() {
  const records = await fetchSourceRecords(currentSessionState.sourceId);
  currentRecordIndex = (currentRecordIndex + 1) % records.length;
  await loadMagicTemplate(currentSessionState.mappingId, records[currentRecordIndex].id);
}
```

**3. Save Updates Template**

When saving in linked mode, update the template:

```javascript
async function saveTemplate() {
  if (currentSessionState.mappingId) {
    // Update existing mapping's template
    const response = await fetch(`${API_URL}/v1/mappings/${currentSessionState.mappingId}/template`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        html: currentSessionState.html
      })
    });

    if (response.ok) {
      showToast('Template updated!', 'success');
    }
  } else {
    // Regular save flow
    // ...
  }
}
```

### Return Format
```json
{
  "status": "completed" | "blocked",
  "featuresImplemented": [
    "Magic template loading via URL",
    "Record navigation",
    "Template update on save",
    "Linked mode banner"
  ],
  "filesModified": ["www/index.html"],
  "blockers": null | "description"
}
```
```

### Phase 4 Acceptance Criteria
- [ ] Playground loads magic templates via URL
- [ ] Record navigation works
- [ ] Edits save back to template
- [ ] Linked mode is visually clear

---

## Phase 5: Deploy and Verify with Real Use Cases

**Deployment: SEQUENTIAL**

### Phase 5A: Commit and Deploy

**Agent: @developer**

```markdown
## Mission: Commit and Deploy

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

### Commit Message
```bash
git add api/src/routes/auto-generate.ts \
        api/src/services/autoMatcher.ts \
        api/src/services/aiAssistant.ts \
        api/src/index.ts \
        dashboard/src/app.tsx \
        dashboard/src/app.css \
        www/index.html

git commit -m "feat: Magic data-to-PDF - connect data, see PDF instantly

- New endpoint: POST /v1/auto-generate - one-call auto-generation
- Enhanced AI: Semantic field matching with domain concepts
- Enhanced AI: Value-based inference for smarter mappings
- Dashboard: Magic preview modal on source connection
- Dashboard: Quick mapping editor for corrections
- Playground: Load magic templates, record navigation

Magic flow: Connect data -> Auto-detect template -> Auto-map fields -> Show preview

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

git push origin main
```

### Return Format
```json
{
  "status": "completed" | "blocked",
  "commitHash": "...",
  "blockers": null | "description"
}
```
```

### Phase 5B: Verify with Real Use Cases

**Agent: @qa-agent**

```markdown
## Mission: Verify Magic Flow with Real Use Cases

**Production URLs:**
- API: https://api.glyph.you
- Dashboard: https://dashboard.glyph.you
- Playground: https://glyph.you

### Test Case 1: Work Order Data

Simulate Nick's FWO (Field Work Order) data:

```json
{
  "Job Number": "FWO-2024-0523",
  "Customer": "Johnson Residence",
  "Site Address": "123 Oak Lane, San Juan, PR",
  "Work Description": "Replace HVAC filter and check refrigerant levels",
  "Scheduled Date": "2024-01-15",
  "Assigned Tech": "Miguel Rodriguez",
  "Priority": "Normal",
  "Materials Needed": ["HVAC filter 20x25x1", "R-410A refrigerant"],
  "Estimated Hours": 2.5
}
```

Expected:
- Auto-detect: "work_order" type
- Auto-match: work-order template
- Auto-map: Job Number -> work_order_number, Customer -> customer_name, etc.

Test via API:
```bash
curl -X POST https://api.glyph.you/v1/auto-generate \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"rawData": {...}}'
```

### Test Case 2: Proposal Data

Simulate Service APM Proposals data:

```json
{
  "Proposal #": "APM-2024-089",
  "Client Name": "Pacific Properties LLC",
  "Project Title": "Annual HVAC Maintenance Contract",
  "Scope": "Quarterly preventive maintenance for 12 rooftop units",
  "Duration": "12 months",
  "Total Value": 24000,
  "Valid Until": "2024-02-15",
  "Prepared By": "Eddie San Juan"
}
```

Expected:
- Auto-detect: "proposal" type
- Auto-match: proposal template
- Auto-map fields accordingly

### Test Case 3: Edge Cases

1. **Unknown Field Names**
   - Data with field names like "Fld1", "Fld2"
   - Should fall back gracefully or ask for clarification

2. **Multiple Possible Types**
   - Data that could be quote OR proposal
   - Should return lower confidence and ask

3. **Missing Critical Fields**
   - Work order without customer info
   - Should warn about unmapped required fields

### Browser Tests

Using Agent Browser CLI:

```bash
# Test dashboard magic flow
agent-browser open https://dashboard.glyph.you
agent-browser snapshot -i

# Simulate connecting Airtable (if test mode available)
# Verify magic preview modal appears
# Screenshot each step
```

### Return Format
```json
{
  "overall": "PASS" | "FAIL",
  "testCases": {
    "workOrderData": {
      "status": "PASS|FAIL",
      "detectedType": "...",
      "templateMatched": "...",
      "mappingCoverage": 0.9,
      "issues": []
    },
    "proposalData": {
      "status": "PASS|FAIL",
      // ...
    },
    "edgeCases": {
      "unknownFields": "PASS|FAIL",
      "ambiguousType": "PASS|FAIL",
      "missingFields": "PASS|FAIL"
    }
  },
  "dashboardFlow": "PASS|FAIL",
  "recommendation": "complete" | "fix issues"
}
```
```

### Phase 5 Acceptance Criteria
- [ ] Work order data auto-matches correctly
- [ ] Proposal data auto-matches correctly
- [ ] Edge cases handled gracefully
- [ ] Dashboard magic flow works end-to-end
- [ ] No regressions in existing functionality

---

## State File

### Location
`.claude/magic-data-to-pdf-state.md`

### Template
```markdown
# Magic Data-to-PDF Build State

## Mission
Build the "connect data, see PDF" magic experience.

## Progress
- Current Phase: [0-5]
- Status: [in-progress|completed|blocked]
- Started: [timestamp CST]
- Last Updated: [timestamp CST]

## Phase Completion
- [ ] Phase 0: Audit Current Capabilities
- [ ] Phase 1: One-Call Auto-Generate API
- [ ] Phase 2: Enhanced AI Matching
- [ ] Phase 3: Dashboard Magic Flow
- [ ] Phase 4: Playground Integration
- [ ] Phase 5A: Deploy
- [ ] Phase 5B: Verify with Real Use Cases

## Key Findings from Audit
[From Phase 0]

## Implementation Status
| Component | Status | Files |
|-----------|--------|-------|
| /v1/auto-generate | pending | - |
| Semantic matching | pending | - |
| Magic preview modal | pending | - |
| Quick mapping editor | pending | - |
| Playground integration | pending | - |

## Test Results
[From Phase 5B]

## Blockers
[Any blockers]

## Next Steps
[Next action]
```

---

## Success Criteria

### The Ultimate Test

Nick from E.F. San Juan should be able to:

1. **Connect his Airtable** (Lydia's FWO base)
2. **See a work order PDF immediately** (no config screens)
3. **Verify it mapped his fields correctly** ("Job Number" -> work order number)
4. **Make a small tweak** ("use this logo instead")
5. **Save and generate PDFs** for all his work orders

**Time from connect to first PDF: < 30 seconds**

### Technical Criteria

- [ ] POST /v1/auto-generate works end-to-end
- [ ] Semantic matching handles E.F. San Juan field names
- [ ] Confidence scoring is accurate
- [ ] Dashboard shows magic preview, not config
- [ ] User can correct mappings easily
- [ ] Playground supports linked templates

---

## Final Output

When complete:
```
MAGIC DATA-TO-PDF COMPLETE

Commit: [hash]

Features Live:
- POST /v1/auto-generate - one-call magic generation
- Semantic field matching (Job Number -> work_order_number)
- Document type detection (work order, proposal, etc.)
- Dashboard magic preview on source connect
- Quick mapping corrections
- Playground linked template editing

Verified Use Cases:
- Work Order: PASS (95% field coverage)
- Proposal: PASS (92% field coverage)
- Edge Cases: HANDLED

Time to first PDF from data connection: < 30 seconds

Ready for Nick!
```

---

## BEGIN

Load state file. If starting fresh, begin with Phase 0 audits.

**Arguments:** $ARGUMENTS

**Get current time:** `TZ='America/Chicago' date '+%Y-%m-%d %H:%M CST'`
