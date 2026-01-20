/**
 * Glyph API Client
 * Handles all communication with the Glyph API
 */

const API_BASE = "https://glyph-api-production-3f73.up.railway.app";

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
