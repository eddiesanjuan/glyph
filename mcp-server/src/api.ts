/**
 * Glyph API Client
 * Handles all communication with the Glyph API
 */

const API_BASE = "https://api.glyph.you";

export interface GlyphSession {
  sessionId: string;
  html: string;
  template: string;
  data: Record<string, unknown>;
}

export interface PreviewResult {
  sessionId: string;
  html: string;
}

export interface ModifyResult {
  html: string;
  changes: string[];
  tokensUsed?: number;
  validationWarnings?: string[];
}

export interface GenerateResult {
  url: string;
  format: "pdf" | "png";
  size: number;
  expiresAt: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
}

export interface TemplateSchema {
  tableName?: string;
  fields: Array<{
    name: string;
    type: string;
    description?: string;
    examples?: unknown[];
    required?: boolean;
  }>;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
}

export interface AnalyzeResult {
  documentType: string;
  confidence: number;
  suggestedTemplate: string;
  fieldMappings: Array<{
    source: string;
    target: string;
    example?: unknown;
    confidence: number;
    required?: boolean;
  }>;
  missingFields: Array<{ field: string; reason: string }>;
  warnings: string[];
  previewUrl: string;
}

export interface CreateResult {
  success: boolean;
  format: "pdf" | "png" | "html";
  url: string;
  size: number;
  analysis: {
    documentType: string;
    confidence: number;
    template: string;
    fieldMappings: Array<{ source: string; target: string; mapped: boolean }>;
    missingFields: Array<{ field: string; reason: string }>;
    warnings: string[];
  };
  sessionId: string;
}

// =============================================================================
// Saved Templates Types
// =============================================================================

export type TemplateType =
  | "invoice"
  | "quote"
  | "report"
  | "certificate"
  | "letter"
  | "receipt"
  | "contract"
  | "custom";

export type TemplateStyle =
  | "stripe-clean"
  | "professional"
  | "minimal"
  | "bold"
  | "classic"
  | "corporate"
  | "modern"
  | "vibrant";

export interface SavedTemplate {
  id: string;
  name: string;
  type: TemplateType | null;
  description: string | null;
  html?: string;
  schema?: {
    fields?: Array<{
      name: string;
      type: string;
      required?: boolean;
    }>;
  };
  style: TemplateStyle | null;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListTemplatesResult {
  success: boolean;
  templates: SavedTemplate[];
  total: number;
  limit: number;
  offset: number;
}

export interface SaveTemplateParams {
  name: string;
  html: string;
  type?: TemplateType;
  description?: string;
  schema?: {
    fields?: Array<{
      name: string;
      type: string;
      required?: boolean;
    }>;
  };
  style?: TemplateStyle;
  isDefault?: boolean;
}

export interface SaveTemplateResult {
  success: boolean;
  template: SavedTemplate;
}

export interface GetTemplateResult {
  success: boolean;
  template: SavedTemplate;
}

export interface UpdateTemplateParams {
  name?: string;
  html?: string;
  type?: TemplateType;
  description?: string;
  schema?: {
    fields?: Array<{
      name: string;
      type: string;
      required?: boolean;
    }>;
  };
  style?: TemplateStyle;
  isDefault?: boolean;
}

export interface UpdateTemplateResult {
  success: boolean;
  template: SavedTemplate;
}

export interface DeleteTemplateResult {
  success: boolean;
  deleted: string;
}

// =============================================================================
// Data Sources Types
// =============================================================================

export type SourceType = "airtable" | "rest_api" | "webhook";

export interface DataSource {
  id: string;
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  status: "active" | "inactive" | "error";
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSourceParams {
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
}

export interface CreateSourceResult {
  success: boolean;
  source: DataSource;
}

export interface ListSourcesResult {
  success: boolean;
  sources: DataSource[];
  total: number;
}

export interface FieldMapping {
  templateField: string;
  sourceField: string;
  transform?: string;
}

export interface SuggestMappingsResult {
  success: boolean;
  suggestions: Array<{
    templateField: string;
    sourceField: string;
    confidence: number;
    reason: string;
  }>;
  unmappedTemplateFields: string[];
  unmappedSourceFields: string[];
}

export interface LinkTemplateParams {
  templateId: string;
  sourceId: string;
  fieldMappings: Record<string, string>;
  isDefault?: boolean;
}

export interface LinkTemplateResult {
  success: boolean;
  mapping: {
    id: string;
    templateId: string;
    sourceId: string;
    fieldMappings: Record<string, string>;
    isDefault: boolean;
    createdAt: string;
  };
}

export interface GenerateFromSourceParams {
  templateId: string;
  sourceId?: string;
  recordId?: string;
  filter?: {
    formula?: string;
    limit?: number;
  };
  outputPath?: string;
}

export interface GenerateFromSourceResult {
  success: boolean;
  generated: Array<{
    recordId: string;
    url: string;
    format: "pdf" | "png";
    size: number;
  }>;
  total: number;
  errors?: Array<{
    recordId: string;
    error: string;
  }>;
}

// =============================================================================
// Data-First Workflow Types
// =============================================================================

export interface CloneTemplateParams {
  builtInTemplateId: string;
  name?: string;
  linkToSource?: string;
}

export interface CloneTemplateResult {
  success: boolean;
  template: SavedTemplate;
  mapping?: {
    id: string;
    templateId: string;
    sourceId: string;
  };
}

export interface CreateSessionFromMappingParams {
  mappingId: string;
  recordId?: string;
}

export interface CreateSessionFromMappingResult {
  success: boolean;
  sessionId: string;
  preview: {
    html: string;
    record_id: string;
  };
  template: {
    id: string;
    name: string;
  };
  source: {
    id: string;
    name: string;
  };
}

export interface SaveTemplateFromSessionParams {
  sessionId: string;
  saveAs?: "update" | "variant";
  variantName?: string;
}

export interface SaveTemplateFromSessionResult {
  success: boolean;
  template: SavedTemplate;
  placeholdersPreserved: number;
  warnings?: string[];
}

export class GlyphApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "GlyphApiError";
    this.code = code;
    this.details = details;
  }
}

export class GlyphApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = API_BASE) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      throw new GlyphApiError(
        (data.error as string) || "API request failed",
        (data.code as string) || "API_ERROR",
        data.details
      );
    }

    return data as T;
  }

  /**
   * Create a preview session with data
   * Returns a session ID for subsequent modifications
   */
  async createPreview(
    template: string,
    data: Record<string, unknown>
  ): Promise<PreviewResult> {
    const result = await this.request<{ html: string; sessionId?: string }>(
      "/v1/preview",
      {
        method: "POST",
        body: JSON.stringify({ template, data }),
      }
    );

    return {
      sessionId: result.sessionId || "",
      html: result.html,
    };
  }

  /**
   * Modify a document using natural language
   */
  async modify(sessionId: string, prompt: string, region?: string): Promise<ModifyResult> {
    const result = await this.request<ModifyResult>("/v1/modify", {
      method: "POST",
      body: JSON.stringify({ sessionId, prompt, region }),
    });

    return result;
  }

  /**
   * Modify HTML directly (without session)
   */
  async modifyDirect(
    html: string,
    instruction: string,
    context?: Record<string, unknown>
  ): Promise<ModifyResult> {
    const result = await this.request<ModifyResult>("/v1/modify", {
      method: "POST",
      body: JSON.stringify({ html, instruction, context }),
    });

    return result;
  }

  /**
   * Generate final PDF or PNG from HTML
   */
  async generate(
    html: string,
    format: "pdf" | "png" = "pdf",
    options?: { width?: number; height?: number; scale?: number }
  ): Promise<GenerateResult> {
    const result = await this.request<GenerateResult>("/v1/generate", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: JSON.stringify({ html, format, options }),
    });

    return result;
  }

  /**
   * Get available templates
   */
  async getTemplates(): Promise<Template[]> {
    const result = await this.request<{ templates: Template[] }>(
      "/v1/preview/templates",
      { method: "GET" }
    );

    return result.templates;
  }

  /**
   * Get style presets
   */
  async getStyles(): Promise<StylePreset[]> {
    const result = await this.request<{ styles: StylePreset[] }>(
      "/v1/templates/styles",
      { method: "GET" }
    );

    return result.styles;
  }

  /**
   * Check API health
   */
  async health(): Promise<{ status: string; version: string }> {
    const result = await this.request<{ status: string; version: string }>(
      "/health",
      { method: "GET" }
    );

    return result;
  }

  /**
   * Analyze data structure to detect document type and field mappings
   */
  async analyze(
    data: Record<string, unknown>,
    intent?: string
  ): Promise<AnalyzeResult> {
    const result = await this.request<AnalyzeResult>("/v1/analyze", {
      method: "POST",
      body: JSON.stringify({ data, intent }),
    });

    return result;
  }

  // ===========================================================================
  // Saved Templates API
  // ===========================================================================

  /**
   * List all saved templates for the current API key
   */
  async listSavedTemplates(options?: {
    type?: TemplateType;
    limit?: number;
    offset?: number;
  }): Promise<ListTemplatesResult> {
    const params = new URLSearchParams();
    if (options?.type) params.set("type", options.type);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));

    const queryString = params.toString();
    const endpoint = `/v1/templates/saved${queryString ? "?" + queryString : ""}`;

    return this.request<ListTemplatesResult>(endpoint, { method: "GET" });
  }

  /**
   * Save a new template
   */
  async saveTemplate(params: SaveTemplateParams): Promise<SaveTemplateResult> {
    return this.request<SaveTemplateResult>("/v1/templates/saved", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Get a saved template by ID (includes full HTML)
   */
  async getSavedTemplate(id: string): Promise<GetTemplateResult> {
    return this.request<GetTemplateResult>(`/v1/templates/saved/${id}`, {
      method: "GET",
    });
  }

  /**
   * Update a saved template
   */
  async updateSavedTemplate(
    id: string,
    params: UpdateTemplateParams
  ): Promise<UpdateTemplateResult> {
    return this.request<UpdateTemplateResult>(`/v1/templates/saved/${id}`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
  }

  /**
   * Delete a saved template
   */
  async deleteSavedTemplate(id: string): Promise<DeleteTemplateResult> {
    return this.request<DeleteTemplateResult>(`/v1/templates/saved/${id}`, {
      method: "DELETE",
    });
  }

  // ===========================================================================
  // Data Sources API
  // ===========================================================================

  /**
   * Create a new data source connection
   */
  async createSource(params: CreateSourceParams): Promise<CreateSourceResult> {
    return this.request<CreateSourceResult>("/v1/sources", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * List all connected data sources
   */
  async listSources(type?: SourceType): Promise<ListSourcesResult> {
    const params = new URLSearchParams();
    if (type) params.set("type", type);

    const queryString = params.toString();
    const endpoint = `/v1/sources${queryString ? "?" + queryString : ""}`;

    return this.request<ListSourcesResult>(endpoint, { method: "GET" });
  }

  /**
   * Get AI-powered field mapping suggestions
   */
  async suggestMappings(
    templateId: string,
    sourceId: string
  ): Promise<SuggestMappingsResult> {
    return this.request<SuggestMappingsResult>("/v1/ai/suggest-mappings", {
      method: "POST",
      body: JSON.stringify({ templateId, sourceId }),
    });
  }

  /**
   * Link a template to a data source with field mappings
   */
  async linkTemplate(params: LinkTemplateParams): Promise<LinkTemplateResult> {
    return this.request<LinkTemplateResult>("/v1/mappings", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Generate PDF(s) from a saved template and connected data source
   */
  async generateFromSource(
    params: GenerateFromSourceParams
  ): Promise<GenerateFromSourceResult> {
    return this.request<GenerateFromSourceResult>("/v1/generate/smart", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ===========================================================================
  // Data-First Workflow API
  // ===========================================================================

  /**
   * Clone a built-in template to saved templates
   */
  async cloneTemplate(params: CloneTemplateParams): Promise<CloneTemplateResult> {
    return this.request<CloneTemplateResult>("/v1/templates/clone", {
      method: "POST",
      body: JSON.stringify({
        builtInTemplateId: params.builtInTemplateId,
        name: params.name,
        linkToSource: params.linkToSource,
      }),
    });
  }

  /**
   * Create an editable session from a template-source mapping
   */
  async createSessionFromMapping(
    params: CreateSessionFromMappingParams
  ): Promise<CreateSessionFromMappingResult> {
    return this.request<CreateSessionFromMappingResult>("/v1/sessions/from-mapping", {
      method: "POST",
      body: JSON.stringify({
        mapping_id: params.mappingId,
        record_id: params.recordId,
      }),
    });
  }

  /**
   * Save a template from an editing session, preserving Mustache placeholders
   */
  async saveTemplateFromSession(
    templateId: string,
    params: SaveTemplateFromSessionParams
  ): Promise<SaveTemplateFromSessionResult> {
    return this.request<SaveTemplateFromSessionResult>(
      `/v1/templates/saved/${templateId}/save-from-session`,
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: params.sessionId,
          saveAs: params.saveAs,
          variantName: params.variantName,
        }),
      }
    );
  }

  /**
   * Create a PDF from raw data in one shot (analyze + preview + generate)
   * Uses auto-detection to determine document type and layout
   */
  async create(params: {
    data: Record<string, unknown>;
    intent?: string;
    style?: string;
    format?: "pdf" | "png" | "html";
  }): Promise<CreateResult> {
    // Step 1: Create preview with auto-detection
    const previewResult = await this.request<{
      sessionId: string;
      html: string;
      analysis: {
        documentType: string;
        confidence: number;
        template: string;
        fieldMappings: Array<{ source: string; target: string; mapped: boolean }>;
        missingFields: Array<{ field: string; reason: string }>;
        warnings: string[];
      };
    }>("/v1/preview/auto", {
      method: "POST",
      body: JSON.stringify({
        data: params.data,
        template: params.style, // Use style as template hint
      }),
    });

    // If only HTML is requested, return early
    if (params.format === "html") {
      return {
        success: true,
        format: "html",
        url: `data:text/html;base64,${Buffer.from(previewResult.html).toString("base64")}`,
        size: previewResult.html.length,
        analysis: previewResult.analysis,
        sessionId: previewResult.sessionId,
      };
    }

    // Step 2: Generate final document (PDF or PNG)
    const generateResult = await this.request<GenerateResult>("/v1/generate", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: JSON.stringify({
        html: previewResult.html,
        format: params.format || "pdf",
      }),
    });

    return {
      success: true,
      format: generateResult.format,
      url: generateResult.url,
      size: generateResult.size,
      analysis: previewResult.analysis,
      sessionId: previewResult.sessionId,
    };
  }
}

// Session storage for tracking active preview sessions
const sessions = new Map<
  string,
  {
    html: string;
    template: string;
    data: Record<string, unknown>;
    createdAt: Date;
  }
>();

export function storeSession(
  sessionId: string,
  html: string,
  template: string,
  data: Record<string, unknown>
): void {
  sessions.set(sessionId, {
    html,
    template,
    data,
    createdAt: new Date(),
  });
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function updateSessionHtml(sessionId: string, html: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.html = html;
  }
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Clean up old sessions (older than 1 hour)
export function cleanupSessions(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.createdAt.getTime() < oneHourAgo) {
      sessions.delete(id);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupSessions, 15 * 60 * 1000);
