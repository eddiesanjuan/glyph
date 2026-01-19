/**
 * Preview Component
 * Renders PDF preview with page navigation
 */

import type { GlyphTemplate, PageLayout } from '../lib/types';

export interface PreviewOptions {
  template: GlyphTemplate | null;
  data: Record<string, unknown>;
  currentPage: number;
  zoom: number;
}

export class GlyphPreview extends HTMLElement {
  private shadow: ShadowRoot;
  private _template: GlyphTemplate | null = null;
  private _data: Record<string, unknown> = {};
  private _currentPage = 1;
  private _zoom = 100;

  static get observedAttributes() {
    return ['zoom', 'page'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    switch (name) {
      case 'zoom':
        this._zoom = parseInt(newValue, 10) || 100;
        this.updateZoom();
        break;
      case 'page':
        this._currentPage = parseInt(newValue, 10) || 1;
        this.renderPage();
        break;
    }
  }

  /**
   * Set template and data for preview
   */
  public setContent(template: GlyphTemplate | null, data: Record<string, unknown>) {
    this._template = template;
    this._data = data;
    this.renderPage();
  }

  /**
   * Navigate to specific page
   */
  public goToPage(pageNumber: number) {
    const totalPages = this._template?.layout.pages.length || 1;
    this._currentPage = Math.max(1, Math.min(pageNumber, totalPages));
    this.renderPage();
    this.dispatchEvent(new CustomEvent('pagechange', { detail: { page: this._currentPage } }));
  }

  /**
   * Navigate to next page
   */
  public nextPage() {
    this.goToPage(this._currentPage + 1);
  }

  /**
   * Navigate to previous page
   */
  public prevPage() {
    this.goToPage(this._currentPage - 1);
  }

  /**
   * Set zoom level (50-200)
   */
  public setZoom(zoom: number) {
    this._zoom = Math.max(50, Math.min(200, zoom));
    this.updateZoom();
  }

  /**
   * Update zoom display
   */
  private updateZoom() {
    const page = this.shadow.querySelector('.preview-page') as HTMLElement;
    if (page) {
      page.style.transform = `scale(${this._zoom / 100})`;
    }
  }

  /**
   * Render current page
   */
  private renderPage() {
    const content = this.shadow.querySelector('.preview-content');
    if (!content) return;

    if (!this._template) {
      content.innerHTML = '<div class="preview-empty">No template loaded</div>';
      return;
    }

    const pageLayout = this._template.layout.pages[this._currentPage - 1];
    if (!pageLayout) {
      content.innerHTML = '<div class="preview-empty">Page not found</div>';
      return;
    }

    content.innerHTML = this.renderPageLayout(pageLayout);
  }

  /**
   * Render page layout to HTML
   */
  private renderPageLayout(layout: PageLayout): string {
    const { size, orientation, margins, elements } = layout;

    // Determine page dimensions
    let width = 8.5; // inches
    let height = 11;

    if (typeof size === 'object') {
      width = size.width;
      height = size.height;
    } else if (size === 'a4') {
      width = 8.27;
      height = 11.69;
    } else if (size === 'legal') {
      width = 8.5;
      height = 14;
    }

    if (orientation === 'landscape') {
      [width, height] = [height, width];
    }

    // Render elements
    const elementsHtml = elements.map(el => this.renderElement(el)).join('');

    return `
      <div class="preview-page" style="
        width: ${width}in;
        height: ${height}in;
        padding: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
        position: relative;
      ">
        ${elementsHtml}
      </div>
    `;
  }

  /**
   * Render individual layout element
   */
  private renderElement(element: PageLayout['elements'][0]): string {
    const { type, id, x, y, width, height, properties } = element;
    const style = `position: absolute; left: ${x}in; top: ${y}in; width: ${width}in; height: ${height}in;`;

    switch (type) {
      case 'text':
        const textContent = this.resolveBinding(properties.content as string);
        return `<div class="element-text" style="${style}">${textContent}</div>`;

      case 'image':
        const src = this.resolveBinding(properties.src as string);
        return `<img class="element-image" style="${style}" src="${src}" alt="" />`;

      case 'field':
        const fieldValue = this._data[id] || properties.placeholder || '';
        return `<div class="element-field" style="${style}">${fieldValue}</div>`;

      default:
        return `<div class="element-unknown" style="${style}" data-type="${type}"></div>`;
    }
  }

  /**
   * Resolve data binding in content
   */
  private resolveBinding(content: string): string {
    if (!content) return '';

    return content.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return String(this._data[key] ?? '');
    });
  }

  /**
   * Render component
   */
  private render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          background: #f1f5f9;
          overflow: auto;
          padding: 24px;
        }

        .preview-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100%;
        }

        .preview-content {
          transform-origin: top center;
          transition: transform 0.2s ease;
        }

        .preview-page {
          background: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          box-sizing: border-box;
        }

        .preview-empty {
          padding: 48px;
          text-align: center;
          color: #64748b;
        }

        .preview-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 8px 12px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
        }

        .toolbar-btn {
          padding: 4px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }

        .toolbar-btn:hover {
          background: #f8fafc;
        }

        .toolbar-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-info {
          font-size: 14px;
          color: #64748b;
        }

        .element-text,
        .element-field {
          font-size: 12px;
          line-height: 1.4;
        }

        .element-image {
          object-fit: contain;
        }
      </style>

      <div class="preview-container">
        <div class="preview-toolbar">
          <button class="toolbar-btn" id="prev-btn" title="Previous page">&#8249;</button>
          <span class="page-info">
            Page <span id="current-page">1</span> of <span id="total-pages">1</span>
          </span>
          <button class="toolbar-btn" id="next-btn" title="Next page">&#8250;</button>
          <span style="margin-left: auto;"></span>
          <button class="toolbar-btn" id="zoom-out" title="Zoom out">-</button>
          <span class="page-info" id="zoom-level">100%</span>
          <button class="toolbar-btn" id="zoom-in" title="Zoom in">+</button>
        </div>
        <div class="preview-content">
          <div class="preview-empty">No template loaded</div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Set up toolbar event listeners
   */
  private setupEventListeners() {
    this.shadow.getElementById('prev-btn')?.addEventListener('click', () => this.prevPage());
    this.shadow.getElementById('next-btn')?.addEventListener('click', () => this.nextPage());
    this.shadow.getElementById('zoom-in')?.addEventListener('click', () => this.setZoom(this._zoom + 10));
    this.shadow.getElementById('zoom-out')?.addEventListener('click', () => this.setZoom(this._zoom - 10));
  }
}

// Auto-register
if (typeof customElements !== 'undefined' && !customElements.get('glyph-preview')) {
  customElements.define('glyph-preview', GlyphPreview);
}
