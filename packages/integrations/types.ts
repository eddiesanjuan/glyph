/**
 * Glyph Agent Framework Integrations - Shared Types
 *
 * Common TypeScript types used across all framework integrations.
 * These mirror the Glyph REST API request/response shapes.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface GlyphConfig {
  /** Glyph API key (gk_...) */
  apiKey: string;
  /** Base URL for the Glyph API. Defaults to https://api.glyph.you */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Create PDF
// ---------------------------------------------------------------------------

export interface CreatePdfParams {
  /**
   * Document data to populate the template. Required unless `html` or `url`
   * is provided.
   */
  data?: Record<string, unknown>;
  /**
   * Built-in template ID (e.g. "invoice-clean", "quote-modern").
   * When omitted the API auto-detects the best template from the data.
   */
  templateId?: string;
  /** Raw HTML string to convert directly to PDF. */
  html?: string;
  /** Public URL to capture as PDF. */
  url?: string;
  /**
   * Natural language hint describing the desired output
   * (e.g. "formal invoice with blue accent").
   */
  intent?: string;
  /** Visual style preset. */
  style?: "stripe-clean" | "bold" | "minimal" | "corporate";
  /** Output format. Defaults to "pdf". */
  format?: "pdf" | "png";
  /** Page layout options. */
  options?: PageOptions;
}

export interface PageOptions {
  pageSize?: "A4" | "letter" | "legal";
  orientation?: "portrait" | "landscape";
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  scale?: number;
}

export interface CreatePdfResult {
  success: boolean;
  format: "pdf" | "png";
  /** Base64 data-URL of the generated file. */
  url: string;
  /** File size in bytes. */
  size: number;
  filename: string;
  expiresAt: string;
  analysis?: {
    detectedType: string;
    confidence: number;
    fieldsIdentified: string[];
    layoutDecisions: string[];
  };
  /** Session ID for subsequent modifications via /v1/modify. */
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// List Templates
// ---------------------------------------------------------------------------

export interface ListTemplatesParams {
  /** Filter by category (e.g. "invoice", "quote", "contract"). */
  category?: string;
  /** Full-text search across template names and descriptions. */
  search?: string;
  /** Filter by visual style preset (e.g. "modern", "traditional", "minimal"). */
  style?: string;
  /** Filter by tag (e.g. "bold", "clean", "formal"). */
  tag?: string;
}

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  style: string | null;
  tags: string[];
  sampleData: Record<string, unknown>;
}

export interface ListTemplatesResult {
  templates: TemplateEntry[];
  count: number;
}

// ---------------------------------------------------------------------------
// Get Template Schema
// ---------------------------------------------------------------------------

export interface GetTemplateSchemaParams {
  /** Template ID (e.g. "invoice-clean"). */
  templateId: string;
}

export interface TemplateSchemaResult {
  id: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  sampleData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Modify Document (session-based)
// ---------------------------------------------------------------------------

export interface ModifyDocumentParams {
  /** Session ID obtained from a prior create or preview call. */
  sessionId: string;
  /** Natural language instruction (e.g. "make the header blue"). */
  prompt: string;
  /** Optional region ID to scope the modification. */
  region?: string;
}

export interface ModifyDocumentResult {
  html: string;
  changes: string[];
  tokensUsed: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    processingTimeMs: number;
    model: string;
  };
}

// ---------------------------------------------------------------------------
// API Client (shared implementation)
// ---------------------------------------------------------------------------

export class GlyphApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "GlyphApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Lightweight API client used by all framework handler functions.
 * Uses native `fetch` -- zero dependencies.
 */
export class GlyphClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: GlyphConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.glyph.you").replace(
      /\/$/,
      ""
    );
  }

  // ---- Core methods -------------------------------------------------------

  async createPdf(params: CreatePdfParams): Promise<CreatePdfResult> {
    // If raw HTML or URL is provided, use /v1/generate flow.
    // Otherwise use /v1/create (data-driven one-shot generation).
    if (params.html) {
      return this.post<CreatePdfResult>("/v1/generate", {
        html: params.html,
        format: params.format ?? "pdf",
        options: params.options,
      });
    }

    if (params.url) {
      // For URL capture, fetch HTML first then generate
      const response = await fetch(params.url);
      const html = await response.text();
      return this.post<CreatePdfResult>("/v1/generate", {
        html,
        format: params.format ?? "pdf",
        options: params.options,
      });
    }

    // Data-driven creation via /v1/create
    return this.post<CreatePdfResult>("/v1/create", {
      data: params.data,
      intent: params.intent,
      style: params.style,
      format: params.format ?? "pdf",
      options: params.options,
    });
  }

  async listTemplates(
    params?: ListTemplatesParams
  ): Promise<ListTemplatesResult> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    if (params?.style) qs.set("style", params.style);
    if (params?.tag) qs.set("tag", params.tag);

    const query = qs.toString();
    const path = query ? `/v1/templates?${query}` : "/v1/templates";
    return this.get<ListTemplatesResult>(path);
  }

  async getTemplateSchema(
    params: GetTemplateSchemaParams
  ): Promise<TemplateSchemaResult> {
    return this.get<TemplateSchemaResult>(
      `/v1/templates/${encodeURIComponent(params.templateId)}`
    );
  }

  async modifyDocument(
    params: ModifyDocumentParams
  ): Promise<ModifyDocumentResult> {
    return this.post<ModifyDocumentResult>("/v1/modify", {
      sessionId: params.sessionId,
      prompt: params.prompt,
      region: params.region,
    });
  }

  // ---- HTTP helpers -------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      throw new GlyphApiError(
        (json.error as string) ?? `HTTP ${res.status}`,
        res.status,
        (json.code as string) ?? "UNKNOWN_ERROR",
        json.details
      );
    }

    return json as T;
  }
}
