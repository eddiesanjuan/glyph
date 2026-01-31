/**
 * Auto-Generate Routes
 * The "magic" endpoint - connect data, get PDF in ONE call
 *
 * POST /v1/auto-generate - Complete auto-generation from source or raw data
 * POST /v1/auto-generate/accept - Persist auto-generated template + mapping
 */

import { Hono } from "hono";
import { z } from "zod";
import { getSupabase, supabase } from "../lib/supabase.js";
import {
  findMatchingTemplates,
  detectDocumentType,
  generateSuggestedMappings,
  getBuiltInTemplates,
} from "../services/autoMatcher.js";
import { createConnector } from "../services/connectors/index.js";
import { templateEngine } from "../services/template.js";
import { createDevSession, generateDevSessionId, getDevSession, isDevSessionId } from "../lib/devSessions.js";
import { generatePDF, generatePNG } from "../services/pdf.js";
import { storeDocument } from "../lib/documentStore.js";
import { extractMustachePlaceholders } from "../lib/mustacheUtils.js";
import Mustache from "mustache";
import type { Context } from "hono";

// Monthly PDF generation limits by tier (imported from rateLimit.ts pattern)
const MONTHLY_LIMITS: Record<string, number> = {
  demo: 10,
  free: 100,
  starter: 1000,
  pro: 10000,
  enterprise: 100000,
};

// Helper to get base URL for hosted documents
function getBaseUrl(c: Context): string {
  const host = c.req.header("host") || "api.glyph.you";
  const proto = c.req.header("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

/**
 * Check monthly PDF quota for an API key
 * Returns whether generation is allowed and usage details
 */
async function checkPdfQuota(
  apiKeyId: string | null,
  tier: string
): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: string;
}> {
  const monthlyLimit = MONTHLY_LIMITS[tier] || MONTHLY_LIMITS.free;
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Demo tier with no apiKeyId always allowed (in-memory only)
  if (!apiKeyId || tier === "demo") {
    return {
      allowed: true,
      used: 0,
      limit: monthlyLimit,
      resetsAt: nextMonth.toISOString(),
    };
  }

  // Enterprise has unlimited
  if (monthlyLimit >= 100000) {
    return {
      allowed: true,
      used: 0,
      limit: monthlyLimit,
      resetsAt: nextMonth.toISOString(),
    };
  }

  if (!supabase) {
    // No database, allow but log warning
    console.warn("[Auto-Generate] Supabase not configured, skipping quota check");
    return {
      allowed: true,
      used: 0,
      limit: monthlyLimit,
      resetsAt: nextMonth.toISOString(),
    };
  }

  try {
    // Count current month's PDF generations
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count } = await getSupabase()
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .eq("pdf_generated", true)
      .gte("created_at", startOfMonth.toISOString());

    const used = count || 0;

    return {
      allowed: used < monthlyLimit,
      used,
      limit: monthlyLimit,
      resetsAt: nextMonth.toISOString(),
    };
  } catch (error) {
    console.error("[Auto-Generate] Quota check failed:", error);
    // On error, allow but log
    return {
      allowed: true,
      used: 0,
      limit: monthlyLimit,
      resetsAt: nextMonth.toISOString(),
    };
  }
}

/**
 * Track PDF generation usage (fire and forget)
 */
function trackPdfUsage(
  apiKeyId: string | null,
  tier: string,
  format: string,
  templateId: string
): void {
  // Only track for non-demo tiers with valid API key ID and Supabase configured
  if (!apiKeyId || tier === "demo" || !supabase) {
    return;
  }

  getSupabase()
    .from("usage")
    .insert({
      api_key_id: apiKeyId,
      endpoint: "auto-generate",
      template: templateId,
      pdf_generated: format === "pdf" || format === "png",
    })
    .then(({ error }) => {
      if (error) {
        console.error("[Auto-Generate] Usage tracking error:", error);
      }
    });
}

const autoGenerate = new Hono();

// Request schema - either sourceId OR rawData required
const autoGenerateSchema = z
  .object({
    // Primary input - one of these is required
    sourceId: z.string().uuid().optional(),
    rawData: z.record(z.unknown()).optional(),

    // Optional: specific record from source
    recordId: z.string().optional(),

    // Optional overrides (skip auto-detection)
    templateId: z.string().optional(), // UUID or built-in template name
    mappingOverrides: z.record(z.string()).optional(),

    // Output options
    format: z.enum(["preview", "html", "pdf", "png"]).default("preview"),

    // Confidence options
    confidenceThreshold: z.number().min(0).max(1).default(0.7),
    autoAcceptAboveThreshold: z.boolean().default(true),
  })
  .refine((data) => data.sourceId || data.rawData, {
    message: "Either sourceId or rawData is required",
  });

autoGenerate.post("/", async (c: Context) => {
  const apiKeyId = c.get("apiKeyId") as string | null;

  // Parse and validate request
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        error: "Invalid JSON body",
        code: "INVALID_JSON",
      },
      400
    );
  }

  const validation = autoGenerateSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: validation.error.issues,
      },
      400
    );
  }

  const {
    sourceId,
    rawData,
    recordId,
    templateId: overrideTemplateId,
    mappingOverrides,
    format,
    confidenceThreshold,
    autoAcceptAboveThreshold,
  } = validation.data;

  try {
    // STEP 1: Get the data
    let sourceData: Record<string, unknown>;
    let sourceSchema: { fields: Array<{ name: string; path?: string; type?: string }> } | null =
      null;
    let sourceName = "Raw Data";

    if (sourceId) {
      // Fetch from registered data source - MUST scope by api_key_id for tenant isolation
      if (!apiKeyId) {
        return c.json(
          {
            success: false,
            error: "API key required to access data sources",
            code: "AUTH_REQUIRED",
          },
          401
        );
      }

      const { data: source, error: sourceError } = await getSupabase()
        .from("data_sources")
        .select("*")
        .eq("id", sourceId)
        .eq("api_key_id", apiKeyId)  // SECURITY: tenant isolation
        .single();

      if (sourceError || !source) {
        return c.json(
          {
            success: false,
            error: "Data source not found",
            code: "SOURCE_NOT_FOUND",
          },
          404
        );
      }

      sourceName = source.name;
      sourceSchema = source.discovered_schema;

      // Create connector and fetch record(s)
      const connector = createConnector(source);

      if (recordId) {
        const record = await connector.fetchRecord(recordId);
        if (!record) {
          return c.json(
            {
              success: false,
              error: "Record not found in data source",
              code: "RECORD_NOT_FOUND",
            },
            404
          );
        }
        sourceData = record.fields || (record as unknown as Record<string, unknown>);
      } else {
        // Fetch first record as sample
        const records = await connector.fetchRecords({ limit: 1 });
        if (!records || records.length === 0) {
          return c.json(
            {
              success: false,
              error: "No records found in data source",
              code: "NO_RECORDS",
            },
            400
          );
        }
        sourceData = records[0].fields || (records[0] as unknown as Record<string, unknown>);
      }
    } else {
      // Use raw data directly
      sourceData = rawData!;
    }

    // Build schema from source data if not available
    if (!sourceSchema) {
      sourceSchema = {
        fields: Object.keys(sourceData).map((k) => ({
          name: k,
          path: k,
          type: typeof sourceData[k] as string,
        })),
      };
    }

    // STEP 2: Detect document type
    // Ensure fields have required properties for detectDocumentType
    const schemaForDetection = {
      fields: sourceSchema.fields.map((f) => ({
        name: f.name,
        path: f.path || f.name,
        type: f.type || "string",
      })),
    };
    const docType = detectDocumentType(schemaForDetection);

    // STEP 3: Find best matching template (unless overridden)
    let selectedTemplate: {
      id: string;
      name: string;
      html_template: string;
      fields?: string[];
    } | null = null;
    let templateConfidence: number;
    let templateReasoning: string;
    let isBuiltIn = false;

    if (overrideTemplateId) {
      // User specified template - use it directly
      // Check if it's a built-in template name
      const builtInTemplates = getBuiltInTemplates();
      const builtInMatch = builtInTemplates.find((t) => t.id === overrideTemplateId);

      if (builtInMatch) {
        // Load the actual HTML template
        try {
          const templateHtml = await templateEngine.getTemplateHtml(overrideTemplateId);
          selectedTemplate = {
            id: overrideTemplateId,
            name: builtInMatch.name,
            html_template: templateHtml,
            fields: builtInMatch.fields,
          };
          isBuiltIn = true;
        } catch {
          return c.json(
            {
              success: false,
              error: `Built-in template '${overrideTemplateId}' not found on disk`,
              code: "TEMPLATE_NOT_FOUND",
            },
            404
          );
        }
      } else {
        // Try as UUID for saved template - MUST scope by api_key_id for tenant isolation
        const savedTemplateQuery = getSupabase()
          .from("saved_templates")
          .select("*")
          .eq("id", overrideTemplateId);

        // Only scope by api_key_id if we have one (demo tier won't have it)
        if (apiKeyId) {
          savedTemplateQuery.eq("api_key_id", apiKeyId);
        }

        const { data: savedTemplate } = await savedTemplateQuery.single();

        if (!savedTemplate) {
          return c.json(
            {
              success: false,
              error: "Specified template not found",
              code: "TEMPLATE_NOT_FOUND",
            },
            404
          );
        }
        selectedTemplate = {
          id: savedTemplate.id,
          name: savedTemplate.name,
          html_template: savedTemplate.html_template,
        };
      }
      templateConfidence = 1.0;
      templateReasoning = "User specified template";
    } else {
      // Auto-select best template
      const matches = await findMatchingTemplates(
        sourceSchema as { fields: Array<{ name: string; path: string; type: string }> },
        apiKeyId,
        { maxResults: 3, minConfidence: 0.3 }
      );

      if (matches.length === 0) {
        return c.json(
          {
            success: false,
            error: "No matching template found for your data",
            code: "NO_TEMPLATE_MATCH",
            detectedType: docType.type,
            suggestion: "Try specifying a templateId or create a custom template",
          },
          400
        );
      }

      const bestMatch = matches[0];
      templateConfidence = bestMatch.confidence;
      templateReasoning = bestMatch.reasoning || `Best match for ${docType.type} document`;
      isBuiltIn = bestMatch.isBuiltIn;

      // Check confidence threshold
      if (templateConfidence < confidenceThreshold && !autoAcceptAboveThreshold) {
        return c.json(
          {
            success: false,
            code: "LOW_CONFIDENCE",
            confidence: templateConfidence,
            reasoning: templateReasoning,
            detectedType: docType.type,
            suggestedTemplates: matches.slice(0, 3).map((m) => ({
              id: m.templateId,
              name: m.templateName,
              confidence: m.confidence,
              isBuiltIn: m.isBuiltIn,
            })),
            message: `Best match confidence (${Math.round(templateConfidence * 100)}%) is below threshold (${Math.round(confidenceThreshold * 100)}%). Confirm template selection.`,
          },
          200
        ); // 200 because it's not an error, just needs confirmation
      }

      // Fetch the template
      if (isBuiltIn) {
        try {
          const templateHtml = await templateEngine.getTemplateHtml(bestMatch.templateId);
          const builtInInfo = getBuiltInTemplates().find((t) => t.id === bestMatch.templateId);
          selectedTemplate = {
            id: bestMatch.templateId,
            name: bestMatch.templateName,
            html_template: templateHtml,
            fields: builtInInfo?.fields,
          };
        } catch {
          return c.json(
            {
              success: false,
              error: `Built-in template '${bestMatch.templateId}' failed to load`,
              code: "TEMPLATE_LOAD_ERROR",
            },
            500
          );
        }
      } else {
        // Fetch saved template - scope by api_key_id for tenant isolation
        const savedTemplateQuery = getSupabase()
          .from("saved_templates")
          .select("*")
          .eq("id", bestMatch.templateId);

        if (apiKeyId) {
          savedTemplateQuery.eq("api_key_id", apiKeyId);
        }

        const { data: savedTemplate } = await savedTemplateQuery.single();

        if (savedTemplate) {
          selectedTemplate = {
            id: savedTemplate.id,
            name: savedTemplate.name,
            html_template: savedTemplate.html_template,
          };
        }
      }
    }

    if (!selectedTemplate || !selectedTemplate.html_template) {
      return c.json(
        {
          success: false,
          error: "Template content not found",
          code: "TEMPLATE_EMPTY",
        },
        500
      );
    }

    // STEP 4: Auto-map fields
    // Extract template fields from Mustache placeholders
    const templateFieldsRegex = /\{\{([^#/^][^}]*)\}\}/g;
    const templateFields: string[] = [];
    let match;
    while ((match = templateFieldsRegex.exec(selectedTemplate.html_template)) !== null) {
      const field = match[1].trim();
      if (!templateFields.includes(field)) {
        templateFields.push(field);
      }
    }

    // Generate field mappings
    const sourceFields = Object.keys(sourceData);
    let fieldMappings: Record<string, string> = {};
    let unmappedFields: string[] = [];

    // Use auto-matcher's suggestion algorithm
    const suggestions = generateSuggestedMappings(templateFields, sourceFields);

    for (const suggestion of suggestions) {
      if (suggestion.confidence > 0.5 && suggestion.sourceField) {
        fieldMappings[suggestion.templateField] = suggestion.sourceField;
      } else {
        unmappedFields.push(suggestion.templateField);
      }
    }

    // Apply any user overrides
    if (mappingOverrides) {
      fieldMappings = { ...fieldMappings, ...mappingOverrides };
      // Remove overridden fields from unmapped
      unmappedFields = unmappedFields.filter((f) => !mappingOverrides[f]);
    }

    // Calculate mapping coverage
    const mappedCount = Object.keys(fieldMappings).length;
    const mappingConfidence = templateFields.length > 0 ? mappedCount / templateFields.length : 1;

    // STEP 5: Transform source data using mappings
    const mappedData: Record<string, unknown> = {};

    for (const [templateField, sourceField] of Object.entries(fieldMappings)) {
      // Handle nested fields (e.g., "customer.name" -> look for "customer.name" or "Customer Name")
      const value = getNestedValue(sourceData, sourceField);
      setNestedValue(mappedData, templateField, value);
    }

    // Also add all source data directly for flexible templates
    // This allows templates to access {{fieldName}} directly if no mapping is needed
    for (const [key, value] of Object.entries(sourceData)) {
      if (!(key in mappedData)) {
        mappedData[key] = value;
      }
    }

    // STEP 6: Render template
    let renderedHtml: string;
    try {
      renderedHtml = Mustache.render(selectedTemplate.html_template, mappedData);
    } catch (renderError) {
      return c.json(
        {
          success: false,
          error: "Failed to render template with mapped data",
          code: "RENDER_ERROR",
          details: renderError instanceof Error ? renderError.message : "Unknown render error",
        },
        500
      );
    }

    // STEP 7: Create session for subsequent operations
    // For real API keys, persist to Supabase; for demo tier, use in-memory dev session
    let sessionId: string;
    let sessionSourceId: string | null = sourceId || null;

    if (apiKeyId && supabase) {
      // Real API key - persist to database for later /accept
      try {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        const { data: session, error } = await getSupabase()
          .from("sessions")
          .insert({
            api_key_id: apiKeyId,
            template: selectedTemplate.id,
            current_html: renderedHtml,
            original_html: renderedHtml,
            template_html: selectedTemplate.html_template,
            data: {
              mappedData,
              sourceId: sessionSourceId,
              fieldMappings,
              templateUsed: {
                id: selectedTemplate.id,
                name: selectedTemplate.name,
                isBuiltIn,
              },
            },
            modifications: [],
            expires_at: expiresAt.toISOString(),
          })
          .select("id")
          .single();

        if (error || !session) {
          console.warn("[Auto-Generate] DB session creation failed, falling back to dev session:", error);
          // Fallback to dev session on DB error
          sessionId = generateDevSessionId();
          createDevSession(sessionId, selectedTemplate.id, renderedHtml, selectedTemplate.html_template, mappedData);
        } else {
          sessionId = session.id;
          console.info(`[Auto-Generate] Created DB session: ${sessionId} for api_key: ${apiKeyId}`);
        }
      } catch (dbError) {
        console.error("[Auto-Generate] DB session creation threw:", dbError);
        // Fallback to dev session
        sessionId = generateDevSessionId();
        createDevSession(sessionId, selectedTemplate.id, renderedHtml, selectedTemplate.html_template, mappedData);
      }
    } else {
      // Demo tier or no Supabase - in-memory session
      sessionId = generateDevSessionId();
      createDevSession(sessionId, selectedTemplate.id, renderedHtml, selectedTemplate.html_template, mappedData);
      console.info(`[Auto-Generate] Created dev session: ${sessionId}`);
    }

    // Build result object
    const result = {
      success: true,
      sessionId, // Now returns sessionId for /v1/modify and /v1/generate
      preview: {
        html: renderedHtml,
        templateHtml: selectedTemplate.html_template, // For editing
      },
      templateUsed: {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        confidence: templateConfidence,
        reasoning: templateReasoning,
        isBuiltIn,
      },
      documentType: {
        detected: docType.type,
        confidence: docType.confidence,
      },
      mappings: {
        applied: fieldMappings,
        unmapped: unmappedFields,
        coverage: mappingConfidence,
        suggestions: suggestions
          .filter((s) => s.confidence < 0.5)
          .map((s) => ({
            templateField: s.templateField,
            possibleSourceFields: sourceFields
              .filter((sf) =>
                sf.toLowerCase().includes(s.templateField.split(".").pop()?.toLowerCase() || "")
              )
              .slice(0, 3),
          })),
      },
      source: {
        name: sourceName,
        recordCount: 1,
        sourceId: sourceId || null,
      },
      _links: {
        modify: `POST /v1/modify with sessionId: ${sessionId}`,
        generate: `POST /v1/generate with sessionId: ${sessionId}`,
      },
    };

    if (format === "preview" || format === "html") {
      return c.json(result);
    }

    // STEP 8: Check quota BEFORE PDF generation (P0.2)
    const tier = (c.get("tier") as string) || "demo";
    const quotaCheck = await checkPdfQuota(apiKeyId, tier);

    if (!quotaCheck.allowed) {
      return c.json(
        {
          ...result,
          output: {
            error: "Monthly PDF generation limit exceeded",
            code: "QUOTA_EXCEEDED",
            limit: quotaCheck.limit,
            used: quotaCheck.used,
            resetsAt: quotaCheck.resetsAt,
            upgrade: "https://glyph.you/pricing",
          },
        },
        429
      );
    }

    // STEP 9: Generate PDF/PNG if requested
    try {
      let outputBuffer: Buffer;
      let filename: string;

      if (format === "pdf") {
        outputBuffer = await generatePDF(renderedHtml);
        filename = `glyph-auto-${selectedTemplate.id}-${Date.now()}.pdf`;
      } else {
        outputBuffer = await generatePNG(renderedHtml);
        filename = `glyph-auto-${selectedTemplate.id}-${Date.now()}.png`;
      }

      // Store document and get hosted URL
      const storedDoc = storeDocument({
        buffer: outputBuffer,
        format: format as "pdf" | "png",
        filename,
        source: { type: "data", templateId: selectedTemplate.id },
        sessionId,
        ttlSeconds: 3600, // 1 hour
      });

      const baseUrl = getBaseUrl(c);
      const hostedUrl = `${baseUrl}/v1/documents/${storedDoc.id}`;

      // Track usage AFTER successful generation
      trackPdfUsage(apiKeyId, tier, format, selectedTemplate.id);

      return c.json({
        ...result,
        output: {
          format,
          url: hostedUrl,
          size: outputBuffer.length,
          filename,
          expiresAt: storedDoc.expiresAt,
        },
      });
    } catch (pdfError) {
      console.error("[Auto-Generate] PDF generation failed:", pdfError);
      return c.json({
        ...result,
        output: {
          error: "PDF generation failed",
          details: pdfError instanceof Error ? pdfError.message : "Unknown error",
          fallback: `Use POST /v1/generate with sessionId: ${sessionId}`,
        },
      });
    }
  } catch (error) {
    console.error("[Auto-Generate] Error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Auto-generation failed",
        code: "AUTO_GENERATE_ERROR",
      },
      500
    );
  }
});

// Helper: Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  // First try exact match
  if (obj[path] !== undefined) return obj[path];

  // Try case-insensitive match
  const lowerPath = path.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lowerPath) return obj[key];
    // Also try with spaces/underscores normalized
    if (key.toLowerCase().replace(/[\s_-]/g, "") === lowerPath.replace(/[\s_-]/g, "")) {
      return obj[key];
    }
  }

  // Try nested path
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Helper: Set nested value in object using dot notation
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// =============================================================================
// POST /v1/auto-generate/accept - Persist auto-generated template + mapping
// =============================================================================

const acceptSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  templateName: z.string().min(1).max(255).optional(),
  setAsDefault: z.boolean().optional().default(true),
  mappingOverrides: z.record(z.string()).optional(),
});

interface SessionData {
  mappedData: Record<string, unknown>;
  sourceId: string | null;
  fieldMappings: Record<string, string>;
  templateUsed: {
    id: string;
    name: string;
    isBuiltIn: boolean;
  };
}

autoGenerate.post("/accept", async (c: Context) => {
  const apiKeyId = c.get("apiKeyId") as string | null;

  // P0.3: Demo tier cannot persist
  if (!apiKeyId) {
    return c.json(
      {
        success: false,
        error: "Template persistence requires a registered API key. Sign up at https://glyph.you to save templates.",
        code: "DEMO_TIER_LIMITATION",
        previewStillAvailable: true,
        message: "You can still generate a one-time PDF using POST /v1/generate with sessionId",
      },
      403
    );
  }

  if (!supabase) {
    return c.json(
      {
        success: false,
        error: "Database is not configured",
        code: "DATABASE_NOT_CONFIGURED",
      },
      503
    );
  }

  // Parse and validate request
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        error: "Invalid JSON body",
        code: "INVALID_JSON",
      },
      400
    );
  }

  const validation = acceptSchema.safeParse(body);
  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: validation.error.issues,
      },
      400
    );
  }

  const { sessionId, templateName, setAsDefault, mappingOverrides } = validation.data;

  try {
    // STEP 1: Fetch session - check for dev session vs DB session
    let session: {
      id: string;
      template_html: string;
      data: SessionData;
      api_key_id: string | null;
      template: string;
    } | null = null;

    if (isDevSessionId(sessionId)) {
      // Demo session - cannot persist
      const devSession = getDevSession(sessionId);
      if (!devSession) {
        return c.json(
          {
            success: false,
            error: "Session not found or expired",
            code: "SESSION_NOT_FOUND",
          },
          404
        );
      }

      // Dev sessions cannot be accepted (demo tier limitation)
      return c.json(
        {
          success: false,
          error: "Template persistence requires a registered API key. This session was created in demo mode.",
          code: "DEMO_TIER_LIMITATION",
          previewStillAvailable: true,
          sessionId,
          message: "You can still generate a one-time PDF using POST /v1/generate with sessionId",
        },
        403
      );
    }

    // Fetch from database
    const { data: dbSession, error: sessionError } = await getSupabase()
      .from("sessions")
      .select("id, template_html, data, api_key_id, template, expires_at")
      .eq("id", sessionId)
      .single();

    if (sessionError || !dbSession) {
      return c.json(
        {
          success: false,
          error: "Session not found or expired",
          code: "SESSION_NOT_FOUND",
        },
        404
      );
    }

    // Check expiration
    if (new Date(dbSession.expires_at) < new Date()) {
      return c.json(
        {
          success: false,
          error: "Session has expired",
          code: "SESSION_EXPIRED",
        },
        410
      );
    }

    // SECURITY: Verify session belongs to this API key (tenant isolation)
    if (dbSession.api_key_id !== apiKeyId) {
      return c.json(
        {
          success: false,
          error: "Session not found",
          code: "SESSION_NOT_FOUND",
        },
        404
      );
    }

    session = {
      id: dbSession.id,
      template_html: dbSession.template_html,
      data: dbSession.data as SessionData,
      api_key_id: dbSession.api_key_id,
      template: dbSession.template,
    };

    // STEP 2: Extract session metadata
    const sessionData = session.data;
    const templateUsed = sessionData?.templateUsed;
    const fieldMappings = sessionData?.fieldMappings || {};
    const sourceId = sessionData?.sourceId;

    if (!templateUsed || !session.template_html) {
      return c.json(
        {
          success: false,
          error: "Session is missing required template data. Please re-run auto-generate.",
          code: "INVALID_SESSION_DATA",
        },
        400
      );
    }

    // STEP 3: Merge mapping overrides
    const finalMappings = mappingOverrides
      ? { ...fieldMappings, ...mappingOverrides }
      : fieldMappings;

    // STEP 4: Clone or create template
    let savedTemplateId: string;
    let savedTemplateName: string;
    let isClone = false;
    let clonedFrom: string | null = null;

    const finalTemplateName = templateName || `${templateUsed.name} - Auto Generated`;

    // Extract required fields from template HTML
    const requiredFields = extractMustachePlaceholders(session.template_html);

    if (templateUsed.isBuiltIn) {
      // Clone built-in template to user's saved templates
      const { data: newTemplate, error: insertError } = await getSupabase()
        .from("templates")
        .insert({
          api_key_id: apiKeyId,
          name: finalTemplateName,
          type: "auto-generated",
          description: `Auto-generated from ${templateUsed.name}`,
          html_template: session.template_html,
          schema: {},
          style: null,
          is_default: false,
          required_fields: requiredFields,
          sample_data: sessionData?.mappedData || {},
          ai_metadata: {
            source: "auto-generate",
            cloned_from: templateUsed.id,
            created_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (insertError || !newTemplate) {
        console.error("[Auto-Generate] Template clone failed:", insertError);
        return c.json(
          {
            success: false,
            error: "Failed to save template",
            code: "DATABASE_ERROR",
            details: insertError?.message,
          },
          500
        );
      }

      savedTemplateId = newTemplate.id;
      savedTemplateName = finalTemplateName;
      isClone = true;
      clonedFrom = templateUsed.id;
      console.info(`[Auto-Generate] Cloned built-in template ${templateUsed.id} to ${savedTemplateId}`);
    } else {
      // Use existing saved template (update sample_data if provided)
      savedTemplateId = templateUsed.id;
      savedTemplateName = templateUsed.name;

      // Optionally update sample_data on existing template
      if (sessionData?.mappedData) {
        await getSupabase()
          .from("templates")
          .update({ sample_data: sessionData.mappedData })
          .eq("id", savedTemplateId)
          .eq("api_key_id", apiKeyId);
      }
    }

    // STEP 5: Create or update template_source_mapping
    let mappingId: string | null = null;

    if (sourceId) {
      // Verify source belongs to this API key
      const { data: source, error: sourceError } = await getSupabase()
        .from("data_sources")
        .select("id")
        .eq("id", sourceId)
        .eq("api_key_id", apiKeyId)
        .is("deleted_at", null)
        .single();

      if (sourceError || !source) {
        console.warn("[Auto-Generate] Source not found or not owned:", sourceId);
        // Continue without creating mapping - template is still saved
      } else {
        // Check for existing mapping
        const { data: existingMapping } = await getSupabase()
          .from("template_source_mappings")
          .select("id")
          .eq("template_id", savedTemplateId)
          .eq("source_id", sourceId)
          .single();

        if (existingMapping) {
          // Update existing mapping
          const { error: updateError } = await getSupabase()
            .from("template_source_mappings")
            .update({
              field_mappings: finalMappings,
              is_default: setAsDefault,
              validation_status: "valid",
              last_validated_at: new Date().toISOString(),
            })
            .eq("id", existingMapping.id);

          if (updateError) {
            console.error("[Auto-Generate] Mapping update failed:", updateError);
          } else {
            mappingId = existingMapping.id;
          }
        } else {
          // Create new mapping
          const { data: newMapping, error: mappingError } = await getSupabase()
            .from("template_source_mappings")
            .insert({
              template_id: savedTemplateId,
              source_id: sourceId,
              field_mappings: finalMappings,
              transformations: {},
              is_default: setAsDefault,
              validation_status: "valid",
              last_validated_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (mappingError || !newMapping) {
            console.error("[Auto-Generate] Mapping creation failed:", mappingError);
          } else {
            mappingId = newMapping.id;
            console.info(`[Auto-Generate] Created mapping ${mappingId} for template ${savedTemplateId} -> source ${sourceId}`);
          }
        }

        // STEP 6: If setAsDefault, update template's default_source_id
        if (setAsDefault) {
          await getSupabase()
            .from("templates")
            .update({ default_source_id: sourceId })
            .eq("id", savedTemplateId)
            .eq("api_key_id", apiKeyId);
        }
      }
    }

    // STEP 7: Return comprehensive response
    return c.json(
      {
        success: true,
        savedTemplate: {
          id: savedTemplateId,
          name: savedTemplateName,
          type: "auto-generated",
          version: 1,
          isClone,
          clonedFrom,
        },
        mapping: mappingId
          ? {
              id: mappingId,
              templateId: savedTemplateId,
              sourceId,
              fieldMappings: finalMappings,
              isDefault: setAsDefault,
            }
          : null,
        defaultSet: setAsDefault && mappingId !== null,
        message: mappingId
          ? `Template saved and ${setAsDefault ? "set as default" : "linked"} for this source. Generate PDFs with POST /v1/generate/smart`
          : "Template saved. Connect a data source to generate PDFs automatically.",
        _actions: {
          generateSingle: "POST /v1/generate/smart { sourceId, recordId }",
          generateBatch: "POST /v1/generate/smart/batch { sourceId }",
          editMapping: mappingId ? `PUT /v1/mappings/${mappingId}` : null,
          editTemplate: `PUT /v1/templates/saved/${savedTemplateId}`,
        },
      },
      201
    );
  } catch (error) {
    console.error("[Auto-Generate] Accept error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to accept template",
        code: "ACCEPT_ERROR",
      },
      500
    );
  }
});

export default autoGenerate;
