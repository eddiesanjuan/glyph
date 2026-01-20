/**
 * Glyph API Client for CLI
 */

const DEFAULT_API_URL = 'https://api.glyph.so';

export interface GlyphApiConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PreviewResponse {
  html: string;
  sessionId: string;
}

export interface ModifyResponse {
  html: string;
  changes: string[];
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
}

export class GlyphCLIApi {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GlyphApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_API_URL).replace(/\/$/, '');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error((errorData.error as string) || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private async requestBlob(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error((errorData.error as string) || `Request failed with status ${response.status}`);
    }

    return response.blob();
  }

  /**
   * Validate the API key
   */
  async validateKey(): Promise<{ valid: boolean; tier: string }> {
    return this.request('/v1/auth/validate');
  }

  /**
   * Create a preview session
   */
  async preview(template: string, data: Record<string, unknown>): Promise<PreviewResponse> {
    return this.request<PreviewResponse>('/v1/preview', {
      method: 'POST',
      body: JSON.stringify({ template, data })
    });
  }

  /**
   * Modify the current session with an AI prompt
   */
  async modify(sessionId: string, prompt: string, region?: string): Promise<ModifyResponse> {
    return this.request<ModifyResponse>('/v1/modify', {
      method: 'POST',
      body: JSON.stringify({ sessionId, prompt, region })
    });
  }

  /**
   * Generate a PDF from the current session
   */
  async generate(sessionId: string): Promise<Blob> {
    return this.requestBlob('/v1/generate', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  }

  /**
   * List available templates
   */
  async listTemplates(): Promise<TemplateInfo[]> {
    return this.request<TemplateInfo[]>('/v1/templates');
  }

  /**
   * Generate a template from data schema
   */
  async generateTemplate(
    description: string,
    schema: Record<string, unknown>,
    sampleData?: Record<string, unknown>
  ): Promise<{ html: string; css: string }> {
    return this.request('/v1/templates/generate', {
      method: 'POST',
      body: JSON.stringify({ description, schema, sampleData })
    });
  }
}

/**
 * Create a configured API client
 */
export function createApiClient(config: GlyphApiConfig): GlyphCLIApi {
  return new GlyphCLIApi(config);
}
