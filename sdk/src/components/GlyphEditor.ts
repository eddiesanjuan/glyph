/**
 * GlyphEditor Web Component
 * Main embeddable editor component for PDF generation
 */

import { GlyphApiClient, createApiClient } from '../lib/api';
import type { GlyphEditorProps, GlyphTemplate, GlyphDocument, GlyphError } from '../lib/types';
import baseStyles from '../styles/base.css?inline';

export class GlyphEditor extends HTMLElement {
  static get observedAttributes() {
    return ['api-key', 'template', 'data', 'theme'];
  }

  private shadow: ShadowRoot;
  private apiClient: GlyphApiClient | null = null;
  private currentTemplate: GlyphTemplate | null = null;
  private currentDocument: GlyphDocument | null = null;
  private _data: Record<string, unknown> = {};

  // Event callbacks
  public onSave?: GlyphEditorProps['onSave'];
  public onGenerate?: GlyphEditorProps['onGenerate'];
  public onError?: GlyphEditorProps['onError'];

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.initialize();
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'api-key':
        this.initializeApiClient(newValue);
        break;
      case 'template':
        this.loadTemplate(newValue);
        break;
      case 'data':
        try {
          this._data = JSON.parse(newValue);
          this.updatePreview();
        } catch {
          this.handleError({ code: 'INVALID_DATA', message: 'Invalid JSON in data attribute' });
        }
        break;
      case 'theme':
        // Theme is handled via CSS :host selectors
        break;
    }
  }

  /**
   * Initialize the editor
   */
  private async initialize() {
    const apiKey = this.getAttribute('api-key');
    if (apiKey) {
      this.initializeApiClient(apiKey);
    }

    const templateId = this.getAttribute('template');
    if (templateId) {
      await this.loadTemplate(templateId);
    }

    const dataAttr = this.getAttribute('data');
    if (dataAttr) {
      try {
        this._data = JSON.parse(dataAttr);
      } catch {
        // Ignore invalid JSON on init
      }
    }
  }

  /**
   * Initialize API client with key
   */
  private initializeApiClient(apiKey: string) {
    this.apiClient = createApiClient({ apiKey });
  }

  /**
   * Load template by ID
   */
  private async loadTemplate(templateId: string) {
    if (!this.apiClient) {
      this.handleError({ code: 'NO_API_KEY', message: 'API key required to load template' });
      return;
    }

    this.setLoading(true);

    const response = await this.apiClient.getTemplate(templateId);

    if (response.success && response.data) {
      this.currentTemplate = response.data;
      this.updatePreview();
    } else if (response.error) {
      this.handleError(response.error);
    }

    this.setLoading(false);
  }

  /**
   * Public method to set data programmatically
   */
  public setData(data: Record<string, unknown>) {
    this._data = data;
    this.updatePreview();
  }

  /**
   * Public method to get current data
   */
  public getData(): Record<string, unknown> {
    return { ...this._data };
  }

  /**
   * Generate PDF
   */
  public async generatePdf(): Promise<Blob | null> {
    if (!this.apiClient || !this.currentDocument) {
      this.handleError({ code: 'NOT_READY', message: 'Document not ready for PDF generation' });
      return null;
    }

    const response = await this.apiClient.generatePdf(this.currentDocument.id);

    if (response.success && response.data) {
      const pdfResponse = await fetch(response.data.url);
      const blob = await pdfResponse.blob();
      this.onGenerate?.(blob);
      return blob;
    } else if (response.error) {
      this.handleError(response.error);
    }

    return null;
  }

  /**
   * Handle errors
   */
  private handleError(error: GlyphError) {
    console.error('[Glyph]', error.code, error.message);
    this.onError?.(error);
    this.showError(error.message);
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean) {
    const container = this.shadow.querySelector('.glyph-container');
    if (container) {
      container.classList.toggle('loading', loading);
    }
  }

  /**
   * Show error in UI
   */
  private showError(message: string) {
    const errorEl = this.shadow.querySelector('.glyph-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  /**
   * Update the preview pane
   */
  private updatePreview() {
    // Will be implemented in Phase 3
    const preview = this.shadow.querySelector('.glyph-preview-content');
    if (preview) {
      preview.innerHTML = `<p>Template: ${this.currentTemplate?.name || 'None'}</p>`;
    }
  }

  /**
   * Render the component
   */
  private render() {
    const theme = this.getAttribute('theme') || 'auto';

    this.shadow.innerHTML = `
      <style>${baseStyles}</style>
      <div class="glyph-container" data-theme="${theme}">
        <div class="glyph-editor-layout">
          <div class="glyph-preview">
            <div class="glyph-preview-page">
              <div class="glyph-preview-content glyph-loading">
                <div class="glyph-spinner"></div>
              </div>
            </div>
          </div>
          <div class="glyph-chat">
            <div class="glyph-chat-header">AI Assistant</div>
            <div class="glyph-chat-messages">
              <p style="color: var(--glyph-text-muted); font-size: 14px;">
                Ask me to help edit your document, fill in fields, or generate content.
              </p>
            </div>
            <div class="glyph-chat-input">
              <input type="text" class="glyph-input" placeholder="Type a message..." />
            </div>
          </div>
        </div>
        <div class="glyph-error hidden"></div>
      </div>
    `;

    // Set theme attribute on host for CSS selectors
    if (theme) {
      this.setAttribute('theme', theme);
    }
  }
}

// Auto-register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('glyph-editor')) {
  customElements.define('glyph-editor', GlyphEditor);
}
