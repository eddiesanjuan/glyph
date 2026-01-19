/**
 * GlyphEditor Web Component
 * Main orchestrator for the embeddable PDF editor
 *
 * Usage:
 * <glyph-editor
 *   api-key="your-key"
 *   template="quote-modern"
 *   data='{"companyName": "Acme Corp"}'
 *   theme='{"primaryColor": "#1e3a5f"}'
 * ></glyph-editor>
 */

import { GlyphAPI } from '../lib/api';
import type { GlyphEditorProps, QuoteData, GlyphTheme } from '../lib/types';
import { baseStyles } from '../styles/base';

export class GlyphEditor extends HTMLElement {
  private api: GlyphAPI | null = null;
  private sessionId: string | null = null;
  private currentHtml: string = '';
  private isLoading: boolean = false;
  private selectedRegion: string | null = null;
  private shadow: ShadowRoot;

  // Event callbacks for programmatic usage
  public onSave?: GlyphEditorProps['onSave'];
  public onGenerate?: GlyphEditorProps['onGenerate'];
  public onError?: GlyphEditorProps['onError'];

  static get observedAttributes() {
    return ['api-key', 'template', 'data', 'theme', 'api-url'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.initialize();
  }

  disconnectedCallback() {
    // Cleanup: remove any pending timers or listeners
    this.api = null;
    this.sessionId = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue !== newValue && this.isConnected) {
      if (name === 'data' || name === 'template') {
        this.initialize();
      } else if (name === 'theme') {
        this.applyTheme();
      }
    }
  }

  /**
   * Initialize the editor with current attributes
   */
  private async initialize() {
    const apiKey = this.getAttribute('api-key');
    const template = this.getAttribute('template') || 'quote-modern';
    const dataAttr = this.getAttribute('data');
    const apiUrl = this.getAttribute('api-url') || 'https://api.glyph.so';

    if (!apiKey) {
      this.showError('Missing required attribute: api-key');
      return;
    }

    if (!dataAttr) {
      this.showError('Missing required attribute: data');
      return;
    }

    let data: QuoteData;
    try {
      data = JSON.parse(dataAttr);
    } catch {
      this.showError('Invalid JSON in data attribute');
      return;
    }

    this.api = new GlyphAPI(apiKey, apiUrl);
    this.setLoading(true);

    try {
      const result = await this.api.preview(template, data);
      this.sessionId = result.sessionId;
      this.currentHtml = result.html;
      this.renderPreview();
      this.emit('glyph:ready', { sessionId: this.sessionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load preview';
      this.showError(message);
      this.onError?.({ code: 'PREVIEW_ERROR', message });
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Apply theme from attribute
   */
  private applyTheme() {
    const theme = this.getTheme();
    const container = this.shadow.querySelector('.glyph-container') as HTMLElement;
    if (container) {
      if (theme.primaryColor) {
        container.style.setProperty('--glyph-primary', theme.primaryColor);
      }
      if (theme.fontFamily) {
        container.style.setProperty('--glyph-font', theme.fontFamily);
      }
      if (theme.borderRadius) {
        container.style.setProperty('--glyph-radius', theme.borderRadius);
      }
    }
  }

  /**
   * Render the main component structure
   */
  private render() {
    const theme = this.getTheme();

    this.shadow.innerHTML = `
      <style>
        ${baseStyles}
        :host {
          --glyph-primary: ${theme.primaryColor || '#1e3a5f'};
          --glyph-primary-hover: color-mix(in srgb, var(--glyph-primary) 85%, black);
          --glyph-font: ${theme.fontFamily || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
          --glyph-radius: ${theme.borderRadius || '8px'};
          --glyph-bg: #ffffff;
          --glyph-bg-secondary: #fafafa;
          --glyph-border: #e5e7eb;
          --glyph-text: #1f2937;
          --glyph-text-muted: #6b7280;
          --glyph-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          display: block;
          font-family: var(--glyph-font);
          color: var(--glyph-text);
        }

        .glyph-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 500px;
          background: var(--glyph-bg-secondary);
          border-radius: var(--glyph-radius);
          overflow: hidden;
          box-shadow: var(--glyph-shadow);
          border: 1px solid var(--glyph-border);
        }

        .glyph-preview-area {
          flex: 1;
          overflow: auto;
          background: var(--glyph-bg);
          position: relative;
          min-height: 350px;
        }

        .glyph-preview-frame {
          width: 100%;
          height: 100%;
          border: none;
          background: var(--glyph-bg);
          min-height: 350px;
        }

        .glyph-controls {
          padding: 12px 16px;
          background: var(--glyph-bg);
          border-top: 1px solid var(--glyph-border);
        }

        .glyph-quick-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }

        .glyph-quick-actions::-webkit-scrollbar {
          height: 4px;
        }

        .glyph-quick-actions::-webkit-scrollbar-track {
          background: transparent;
        }

        .glyph-quick-actions::-webkit-scrollbar-thumb {
          background: var(--glyph-border);
          border-radius: 2px;
        }

        .glyph-pill {
          padding: 6px 14px;
          background: #f3f4f6;
          border: 1px solid var(--glyph-border);
          border-radius: 20px;
          font-size: 13px;
          font-family: var(--glyph-font);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
          color: var(--glyph-text);
        }

        .glyph-pill:hover {
          background: var(--glyph-primary);
          color: white;
          border-color: var(--glyph-primary);
        }

        .glyph-pill:active {
          transform: scale(0.98);
        }

        .glyph-pill.loading {
          opacity: 0.6;
          pointer-events: none;
          position: relative;
        }

        .glyph-pill.loading::after {
          content: '';
          position: absolute;
          right: 8px;
          top: 50%;
          width: 12px;
          height: 12px;
          margin-top: -6px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: glyph-spin 0.6s linear infinite;
        }

        .glyph-command-row {
          display: flex;
          gap: 8px;
        }

        .glyph-command-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--glyph-border);
          border-radius: var(--glyph-radius);
          font-size: 14px;
          font-family: var(--glyph-font);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          background: var(--glyph-bg);
          color: var(--glyph-text);
        }

        .glyph-command-input:focus {
          border-color: var(--glyph-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--glyph-primary) 15%, transparent);
        }

        .glyph-command-input::placeholder {
          color: var(--glyph-text-muted);
        }

        .glyph-command-input:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        .glyph-btn {
          padding: 10px 20px;
          background: var(--glyph-primary);
          color: white;
          border: none;
          border-radius: var(--glyph-radius);
          font-size: 14px;
          font-weight: 500;
          font-family: var(--glyph-font);
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
        }

        .glyph-btn:hover {
          opacity: 0.9;
        }

        .glyph-btn:active {
          transform: scale(0.98);
        }

        .glyph-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .glyph-btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid var(--glyph-border);
        }

        .glyph-btn-secondary:hover {
          background: #e5e7eb;
          opacity: 1;
        }

        .glyph-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: var(--glyph-text-muted);
          gap: 12px;
        }

        .glyph-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--glyph-border);
          border-top-color: var(--glyph-primary);
          border-radius: 50%;
          animation: glyph-spin 0.8s linear infinite;
        }

        @keyframes glyph-spin {
          to { transform: rotate(360deg); }
        }

        .glyph-error {
          padding: 24px;
          color: #dc2626;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          height: 100%;
          justify-content: center;
        }

        .glyph-error-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #fef2f2;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .glyph-error-message {
          font-size: 14px;
          max-width: 300px;
        }

        .glyph-toast {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          background: #1f2937;
          color: white;
          padding: 10px 20px;
          border-radius: var(--glyph-radius);
          font-size: 13px;
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          pointer-events: none;
          z-index: 100;
          max-width: 80%;
          text-align: center;
        }

        .glyph-toast.show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        .glyph-toast.error {
          background: #dc2626;
        }

        /* Responsive adjustments */
        @media (max-width: 480px) {
          .glyph-controls {
            padding: 10px 12px;
          }

          .glyph-pill {
            padding: 5px 12px;
            font-size: 12px;
          }

          .glyph-command-input {
            padding: 8px 12px;
            font-size: 14px;
          }

          .glyph-btn {
            padding: 8px 16px;
            font-size: 13px;
          }
        }
      </style>
      <div class="glyph-container">
        <div class="glyph-preview-area">
          <div class="glyph-loading">
            <div class="glyph-spinner"></div>
            <span>Loading preview...</span>
          </div>
        </div>
        <div class="glyph-controls">
          <div class="glyph-quick-actions">
            <button class="glyph-pill" data-action="Add company logo in the header">Add logo</button>
            <button class="glyph-pill" data-action="Apply a professional navy blue and gold color scheme that matches corporate branding">Brand colors</button>
            <button class="glyph-pill" data-action="Make this look more professional and polished with better typography and spacing">More professional</button>
            <button class="glyph-pill" data-action="Make the totals section larger and more prominent with bold styling">Emphasize totals</button>
            <button class="glyph-pill" data-action="Use a more compact layout with less whitespace while maintaining readability">Compact layout</button>
          </div>
          <div class="glyph-command-row">
            <input type="text" class="glyph-command-input" placeholder="Describe what you want to change..." aria-label="Edit command" />
            <button class="glyph-btn glyph-btn-secondary" id="glyph-download" aria-label="Download PDF">Download</button>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners() {
    // Quick action pills
    const pills = this.shadow.querySelectorAll('.glyph-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).getAttribute('data-action');
        if (action) {
          this.executeCommand(action, e.currentTarget as HTMLElement);
        }
      });
    });

    // Command input - Enter key
    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim() && !this.isLoading) {
          this.executeCommand(input.value.trim());
          input.value = '';
        }
      });
    }

    // Download button
    const downloadBtn = this.shadow.getElementById('glyph-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadPdf());
    }
  }

  /**
   * Execute an AI modification command
   */
  private async executeCommand(command: string, pillElement?: HTMLElement) {
    if (!this.api || !this.sessionId || this.isLoading) return;

    if (pillElement) {
      pillElement.classList.add('loading');
    }
    this.setLoading(true);

    try {
      const result = await this.api.modify(
        this.sessionId,
        command,
        this.selectedRegion || undefined
      );

      this.currentHtml = result.html;
      this.renderPreview();

      const changeMessage = result.changes?.[0] || 'Changes applied successfully';
      this.showToast(changeMessage);
      this.emit('glyph:modified', { command, changes: result.changes, region: this.selectedRegion });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply changes';
      this.showToast(message, true);
      this.onError?.({ code: 'MODIFY_ERROR', message });
    } finally {
      if (pillElement) {
        pillElement.classList.remove('loading');
      }
      this.setLoading(false);
    }
  }

  /**
   * Download the current document as PDF
   */
  private async downloadPdf() {
    if (!this.api || !this.sessionId) {
      this.showToast('Document not ready', true);
      return;
    }

    const btn = this.shadow.getElementById('glyph-download') as HTMLButtonElement;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      const blob = await this.api.generate(this.sessionId);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.emit('glyph:saved', { blob, sessionId: this.sessionId });
      this.onGenerate?.(blob);
      this.showToast('PDF downloaded successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate PDF';
      this.showToast(message, true);
      this.onError?.({ code: 'GENERATE_ERROR', message });
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  /**
   * Render the HTML preview in an iframe
   */
  private renderPreview() {
    const previewArea = this.shadow.querySelector('.glyph-preview-area');
    if (!previewArea) return;

    // Create iframe with sandboxed HTML content
    previewArea.innerHTML = `
      <iframe class="glyph-preview-frame" sandbox="allow-same-origin" title="Document preview"></iframe>
      <div class="glyph-toast"></div>
    `;

    const iframe = previewArea.querySelector('iframe') as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    if (doc) {
      doc.open();
      doc.write(this.wrapHtmlWithStyles(this.currentHtml));
      doc.close();

      // Add click handlers for region selection
      this.setupRegionSelection(doc);
    }
  }

  /**
   * Wrap HTML content with necessary styles for region selection
   */
  private wrapHtmlWithStyles(html: string): string {
    const regionStyles = `
      <style>
        [data-glyph-region] {
          cursor: pointer;
          transition: outline 0.15s ease;
        }
        [data-glyph-region]:hover {
          outline: 2px dashed rgba(30, 58, 95, 0.3);
          outline-offset: 2px;
        }
        .glyph-region-highlight {
          outline: 2px solid #1e3a5f !important;
          outline-offset: 2px !important;
          background: rgba(30, 58, 95, 0.05);
        }
      </style>
    `;

    // Inject styles before closing head tag or at the start
    if (html.includes('</head>')) {
      return html.replace('</head>', `${regionStyles}</head>`);
    }
    return regionStyles + html;
  }

  /**
   * Set up click handlers for region-based editing
   */
  private setupRegionSelection(doc: Document) {
    const regions = doc.querySelectorAll('[data-glyph-region]');

    regions.forEach(region => {
      region.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Clear previous selection
        regions.forEach(r => r.classList.remove('glyph-region-highlight'));

        // Highlight new selection
        region.classList.add('glyph-region-highlight');
        this.selectedRegion = region.getAttribute('data-glyph-region');

        // Update placeholder and focus input
        const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
        if (input) {
          input.placeholder = `Edit the ${this.selectedRegion}...`;
          input.focus();
        }

        this.emit('glyph:region-selected', { region: this.selectedRegion });
      });
    });

    // Click outside regions clears selection
    doc.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-glyph-region]')) {
        this.clearRegionSelection(regions);
      }
    });
  }

  /**
   * Clear the current region selection
   */
  private clearRegionSelection(regions: NodeListOf<Element>) {
    regions.forEach(r => r.classList.remove('glyph-region-highlight'));
    this.selectedRegion = null;

    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.placeholder = 'Describe what you want to change...';
    }
  }

  /**
   * Parse theme from attribute
   */
  private getTheme(): GlyphTheme {
    const themeAttr = this.getAttribute('theme');
    if (!themeAttr) return {};

    // Handle preset themes
    if (themeAttr === 'light' || themeAttr === 'dark' || themeAttr === 'auto') {
      if (themeAttr === 'dark') {
        return { primaryColor: '#3b82f6' };
      }
      return {};
    }

    // Handle JSON theme object
    try {
      return JSON.parse(themeAttr);
    } catch {
      console.warn('[Glyph] Invalid theme JSON, using defaults');
      return {};
    }
  }

  /**
   * Set loading state for controls
   */
  private setLoading(loading: boolean) {
    this.isLoading = loading;

    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.disabled = loading;
    }

    const downloadBtn = this.shadow.getElementById('glyph-download') as HTMLButtonElement;
    if (downloadBtn && !loading) {
      // Only re-enable if we have a session
      downloadBtn.disabled = !this.sessionId;
    }
  }

  /**
   * Show error state in preview area
   */
  private showError(message: string) {
    const previewArea = this.shadow.querySelector('.glyph-preview-area');
    if (previewArea) {
      previewArea.innerHTML = `
        <div class="glyph-error">
          <div class="glyph-error-icon">!</div>
          <div class="glyph-error-message">${this.escapeHtml(message)}</div>
        </div>
      `;
    }
    this.emit('glyph:error', { error: message });
  }

  /**
   * Show toast notification
   */
  private showToast(message: string, isError = false) {
    const toast = this.shadow.querySelector('.glyph-toast') as HTMLElement;
    if (toast) {
      toast.textContent = message;
      toast.classList.toggle('error', isError);
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
      }, 2500);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Emit custom event
   */
  private emit(eventName: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true
    }));
  }

  // ============================================
  // PUBLIC API METHODS
  // ============================================

  /**
   * Programmatically set data
   */
  public setData(data: QuoteData) {
    this.setAttribute('data', JSON.stringify(data));
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get current HTML
   */
  public getHtml(): string {
    return this.currentHtml;
  }

  /**
   * Programmatically execute a modification
   */
  public async modify(command: string): Promise<void> {
    await this.executeCommand(command);
  }

  /**
   * Programmatically generate and download PDF
   */
  public async generatePdf(): Promise<Blob | null> {
    if (!this.api || !this.sessionId) {
      return null;
    }

    try {
      return await this.api.generate(this.sessionId);
    } catch {
      return null;
    }
  }
}

// Auto-register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('glyph-editor')) {
  customElements.define('glyph-editor', GlyphEditor);
}
