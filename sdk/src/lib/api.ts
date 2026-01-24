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
  GlyphError,
  QuoteData
} from './types';

const DEFAULT_API_URL = 'https://api.glyph.you';

export interface ApiClientConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * SSE events for streaming modify
 */
export type ModifyStreamEvent =
  | { type: 'start'; sessionId: string; model: string; estimatedTime: number }
  | { type: 'delta'; html: string; index: number }
  | { type: 'changes'; changes: string[] }
  | { type: 'complete'; html: string; changes: string[]; tokensUsed: number; fastPath?: boolean; selfCheckPassed?: boolean }
  | { type: 'error'; error: string; code: string };

/**
 * Main API client for traditional request/response patterns
 */
export class GlyphApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ApiClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_API_URL).replace(/\/$/, '');
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

// ============================================
// GlyphAPI - Simplified API for the editor
// ============================================

/**
 * Simplified API client for the GlyphEditor component
 * Uses the session-based workflow: preview -> modify -> generate
 */
export class GlyphAPI {
  private apiKey: string;
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(apiKey: string, baseUrl = DEFAULT_API_URL, timeout = 30000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultTimeout = timeout;
  }

  /**
   * Create an AbortController with timeout
   */
  private createTimeoutController(timeoutMs: number): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
  }

  /**
   * Map HTTP status codes to user-friendly messages
   */
  private getErrorMessage(status: number, serverError?: string): string {
    if (serverError) return serverError;

    switch (status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Invalid API key. Please verify your credentials.';
      case 403:
        return 'Access denied. Your API key may be deactivated or lacks permissions.';
      case 404:
        return 'Resource not found. The session may have expired.';
      case 410:
        return 'Session expired. Please reload to start a new session.';
      case 429:
        return 'Rate limit exceeded. Please wait a moment and try again.';
      case 500:
        return 'Server error. Our team has been notified. Please try again.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again in a moment.';
      default:
        return `Request failed (Error ${status}). Please try again.`;
    }
  }

  /**
   * Make authenticated request with error handling and timeout
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout?: number
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const { controller, timeoutId } = this.createTimeoutController(timeout || this.defaultTimeout);

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Content-Type', 'application/json');

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = this.getErrorMessage(response.status, errorData.error || errorData.message);
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        // Handle abort/timeout
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. The server may be busy - please try again.');
        }
        // Handle network errors
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        // Re-throw formatted errors
        throw err;
      }

      throw new Error('An unexpected error occurred. Please try again.');
    }
  }

  /**
   * Make request that returns a Blob (for PDF generation)
   * Uses longer timeout (60s) for PDF generation which can be slow
   */
  private async requestBlob(
    endpoint: string,
    options: RequestInit = {},
    timeout = 60000
  ): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint}`;
    const { controller, timeoutId } = this.createTimeoutController(timeout);

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Content-Type', 'application/json');

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = this.getErrorMessage(response.status, errorData.error || errorData.message);
        throw new Error(errorMessage);
      }

      return response.blob();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('PDF generation timed out. Please try again with a simpler document.');
        }
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
          throw new Error('Network error during PDF generation. Please check your connection.');
        }
        throw err;
      }

      throw new Error('Failed to generate PDF. Please try again.');
    }
  }

  /**
   * Create a preview session from template and data
   * Returns the rendered HTML and a session ID for modifications
   */
  async preview(
    template: string,
    data: QuoteData
  ): Promise<{ html: string; sessionId: string }> {
    return this.request<{ html: string; sessionId: string }>('/v1/preview', {
      method: 'POST',
      body: JSON.stringify({ template, data })
    });
  }

  /**
   * Modify the current session with an AI prompt
   * Optionally target a specific region of the document
   * Uses 45s timeout since AI modifications can take longer
   */
  async modify(
    sessionId: string,
    prompt: string,
    region?: string
  ): Promise<{ html: string; changes: string[] }> {
    return this.request<{ html: string; changes: string[] }>(
      '/v1/modify',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId, prompt, region })
      },
      45000 // 45s timeout for AI operations
    );
  }

  /**
   * Modify with streaming - yields events as AI generates response
   * This provides real-time feedback as the document is being modified.
   *
   * Events:
   * - start: AI processing has begun
   * - delta: Chunk of HTML from AI (partial response)
   * - changes: List of changes being made
   * - complete: Final HTML and metadata
   * - error: Something went wrong
   */
  async *modifyStream(
    sessionId: string,
    prompt: string,
    region?: string
  ): AsyncGenerator<ModifyStreamEvent> {
    const url = `${this.baseUrl}/v1/modify?stream=true`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, prompt, region }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            // Empty line = end of event
            try {
              const parsed = JSON.parse(currentData);

              // Debug logging
              if (typeof localStorage !== 'undefined' && localStorage.getItem('GLYPH_DEBUG_STREAM')) {
                console.log('[Glyph Stream]', currentEvent, parsed);
              }

              yield { type: currentEvent, ...parsed } as ModifyStreamEvent;
            } catch {
              console.warn('[Glyph] Failed to parse SSE data:', currentData);
            }
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate a PDF from the current session state
   * Returns the PDF as a Blob for download
   */
  async generate(sessionId: string): Promise<Blob> {
    return this.requestBlob('/v1/generate', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  }
}
