/**
 * Glyph API Client
 * Handles all communication with Glyph backend services
 */

import type {
  ApiResponse,
  GlyphTemplate,
  GlyphDocument,
  GeneratePdfOptions,
  ChatMessage,
  GlyphError
} from './types';

const DEFAULT_API_URL = 'https://api.glyph.dev';

export interface ApiClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class GlyphApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_API_URL;
  }

  /**
   * Make authenticated request to Glyph API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Content-Type', 'application/json');

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'API_ERROR',
            message: `Request failed with status ${response.status}`
          }
        };
      }

      return { success: true, data };
    } catch (err) {
      const error: GlyphError = {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown network error'
      };
      return { success: false, error };
    }
  }

  /**
   * Fetch a template by ID
   */
  async getTemplate(templateId: string): Promise<ApiResponse<GlyphTemplate>> {
    return this.request<GlyphTemplate>(`/v1/templates/${templateId}`);
  }

  /**
   * List available templates
   */
  async listTemplates(): Promise<ApiResponse<GlyphTemplate[]>> {
    return this.request<GlyphTemplate[]>('/v1/templates');
  }

  /**
   * Create a new document from template
   */
  async createDocument(
    templateId: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<GlyphDocument>> {
    return this.request<GlyphDocument>('/v1/documents', {
      method: 'POST',
      body: JSON.stringify({ templateId, data })
    });
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    documentId: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<GlyphDocument>> {
    return this.request<GlyphDocument>(`/v1/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ data })
    });
  }

  /**
   * Generate PDF from document
   */
  async generatePdf(
    documentId: string,
    options: GeneratePdfOptions = {}
  ): Promise<ApiResponse<{ url: string; expiresAt: string }>> {
    return this.request(`/v1/documents/${documentId}/pdf`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  /**
   * Send chat message for AI assistance
   */
  async sendChatMessage(
    documentId: string,
    message: string,
    history: ChatMessage[] = []
  ): Promise<ApiResponse<ChatMessage>> {
    return this.request<ChatMessage>(`/v1/documents/${documentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history })
    });
  }

  /**
   * Validate API key
   */
  async validateKey(): Promise<ApiResponse<{ valid: boolean; tier: string }>> {
    return this.request('/v1/auth/validate');
  }
}

/**
 * Create a configured API client instance
 */
export function createApiClient(config: ApiClientConfig): GlyphApiClient {
  return new GlyphApiClient(config);
}
