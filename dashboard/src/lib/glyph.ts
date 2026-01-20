/**
 * Glyph Client Module
 * Reusable module for PDF generation
 */

const GLYPH_API_URL = 'https://api.glyph.you';

export interface GlyphClientConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface Session {
  sessionId: string;
  html: string;
}

export class GlyphClient {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: GlyphClientConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || GLYPH_API_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a preview session from template and data
   */
  async preview(
    template: string,
    data: Record<string, unknown>
  ): Promise<Session> {
    return this.request<Session>('/v1/preview', {
      method: 'POST',
      body: JSON.stringify({ template, data }),
    });
  }

  /**
   * Modify the document with an AI prompt
   */
  async modify(
    sessionId: string,
    prompt: string
  ): Promise<{ html: string; changes: string[] }> {
    return this.request('/v1/modify', {
      method: 'POST',
      body: JSON.stringify({ sessionId, prompt }),
    });
  }

  /**
   * Generate PDF from session
   */
  async generate(sessionId: string): Promise<Buffer> {
    const response = await fetch(`${this.apiUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Convenience method: preview -> generate in one call
   */
  async generatePdf(
    template: string,
    data: Record<string, unknown>
  ): Promise<Buffer> {
    const { sessionId } = await this.preview(template, data);
    return this.generate(sessionId);
  }
}

/**
 * Create a Glyph client instance
 */
export function createClient(apiKey: string): GlyphClient {
  return new GlyphClient({ apiKey });
}
