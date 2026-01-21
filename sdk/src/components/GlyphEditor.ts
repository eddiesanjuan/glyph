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
import { FieldAutocomplete, type AutocompleteSuggestion } from './FieldAutocomplete';

export class GlyphEditor extends HTMLElement {
  private api: GlyphAPI | null = null;
  private sessionId: string | null = null;
  private currentHtml: string = '';
  private isLoading: boolean = false;
  private selectedRegion: string | null = null;
  private shadow: ShadowRoot;
  private _isEditMode: boolean = false;

  // Undo/Redo history
  private history: string[] = [];
  private historyIndex: number = -1;
  private readonly maxHistory: number = 20;

  // Debounce timer for command input
  private commandDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly commandDebounceMs: number = 300;

  // Toast management
  private activeToasts: Set<string> = new Set();
  private readonly maxToasts: number = 3;

  // First edit celebration tracking
  private static readonly CELEBRATION_KEY = 'glyph-first-edit-celebrated';

  // Template storage key
  private static readonly TEMPLATES_KEY = 'glyph_templates';

  // Reduced motion preference
  private prefersReducedMotion: boolean = false;

  // Track if user has made modifications (for enabling save button)
  private hasModifications: boolean = false;

  // Current base template name
  private baseTemplate: string = 'quote-modern';

  // Field autocomplete instance
  private fieldAutocomplete: FieldAutocomplete | null = null;

  // AI operation timer state
  private aiOperationStartTime: number = 0;
  private aiOperationTimer: ReturnType<typeof setInterval> | null = null;
  private hasShownLongWaitMessage: boolean = false;

  // First visit hint tracking
  private static readonly FIRST_VISIT_KEY = 'glyph-first-visit-hinted';
  private hasShownRegionHint: boolean = false;

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
    // Detect reduced motion preference
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
    });

    this.render();
    this.initialize();
  }

  disconnectedCallback() {
    // Cleanup: remove any pending timers or listeners
    if (this.commandDebounceTimer) {
      clearTimeout(this.commandDebounceTimer);
    }
    if (this.fieldAutocomplete) {
      this.fieldAutocomplete.destroy();
      this.fieldAutocomplete = null;
    }
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
    const apiUrl = this.getAttribute('api-url') || 'https://api.glyph.you';

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
    this.baseTemplate = template; // Store the base template name
    this.setLoading(true);

    try {
      const result = await this.api.preview(template, data);
      this.sessionId = result.sessionId;
      this.currentHtml = result.html;
      this.saveToHistory(); // Save initial state
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
          --glyph-success: #22c55e;
          --glyph-warning: #f59e0b;
          --glyph-error: #dc2626;
          --glyph-transition-fast: 0.15s;
          --glyph-transition-normal: 0.25s;
          --glyph-transition-slow: 0.4s;
          display: block;
          font-family: var(--glyph-font);
          color: var(--glyph-text);
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          :host {
            --glyph-transition-fast: 0.01ms;
            --glyph-transition-normal: 0.01ms;
            --glyph-transition-slow: 0.01ms;
          }

          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Focus visible styles for accessibility */
        :focus-visible {
          outline: 2px solid var(--glyph-primary);
          outline-offset: 2px;
        }

        :focus:not(:focus-visible) {
          outline: none;
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
          animation: glyph-appear 0.3s ease-out;
        }

        .glyph-preview-area {
          flex: 1;
          overflow: auto;
          background: var(--glyph-bg);
          position: relative;
          min-height: 350px;
          /* CSS containment for performance */
          contain: content;
          transition: opacity 0.3s ease;
        }

        .glyph-preview-area.thinking {
          animation: glyph-preview-thinking 2s ease-in-out infinite;
        }

        @keyframes glyph-preview-thinking {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }

        .glyph-preview-frame {
          width: 100%;
          height: 100%;
          border: none;
          background: var(--glyph-bg);
          min-height: 350px;
        }

        .glyph-controls {
          padding: 14px 18px;
          background: linear-gradient(180deg, var(--glyph-bg) 0%, #fafafa 100%);
          border-top: 1px solid var(--glyph-border);
          transition: box-shadow 0.2s ease;
          animation: glyph-content-appear 0.25s ease-out 0.1s both;
        }

        .glyph-controls:focus-within {
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
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
          padding: 8px 16px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid var(--glyph-border);
          border-radius: 24px;
          font-size: 13px;
          font-weight: 500;
          font-family: var(--glyph-font);
          cursor: pointer;
          white-space: nowrap;
          transition: transform var(--glyph-transition-normal) cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow var(--glyph-transition-normal) ease,
                      border-color var(--glyph-transition-normal) ease,
                      color var(--glyph-transition-normal) ease;
          color: var(--glyph-text);
          position: relative;
          overflow: hidden;
          /* GPU acceleration for smooth animations */
          will-change: transform;
        }

        .glyph-pill::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--glyph-primary);
          opacity: 0;
          transition: opacity var(--glyph-transition-normal) ease;
          border-radius: inherit;
        }

        /* Pill focus state for keyboard navigation */
        .glyph-pill:focus-visible {
          outline: 2px solid var(--glyph-primary);
          outline-offset: 2px;
          border-color: var(--glyph-primary);
        }

        .glyph-pill.pill-focused {
          border-color: var(--glyph-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--glyph-primary) 20%, transparent);
        }

        .glyph-pill span {
          position: relative;
          z-index: 1;
        }

        .glyph-pill:hover {
          border-color: var(--glyph-primary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .glyph-pill:hover::before {
          opacity: 1;
        }

        .glyph-pill:hover {
          color: white;
        }

        .glyph-pill:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }

        .glyph-pill.loading {
          pointer-events: none;
          position: relative;
        }

        .glyph-pill.loading::before {
          opacity: 1;
          background: linear-gradient(
            90deg,
            var(--glyph-primary) 0%,
            color-mix(in srgb, var(--glyph-primary) 70%, white) 50%,
            var(--glyph-primary) 100%
          );
          background-size: 200% 100%;
          animation: glyph-shimmer 1.5s ease-in-out infinite;
        }

        .glyph-pill.loading {
          color: white;
        }

        .glyph-pill.success {
          background: #22c55e !important;
          border-color: #22c55e !important;
          color: white;
          animation: glyph-success-pop 0.4s ease-out;
        }

        .glyph-pill.success::before {
          opacity: 0 !important;
        }

        .glyph-command-row {
          display: flex;
          gap: 8px;
        }

        .glyph-command-input {
          flex: 1;
          padding: 12px 16px;
          border: 1.5px solid var(--glyph-border);
          border-radius: var(--glyph-radius);
          font-size: 14px;
          font-family: var(--glyph-font);
          outline: none;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: var(--glyph-bg);
          color: var(--glyph-text);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .glyph-command-input:hover:not(:disabled):not(:focus) {
          border-color: color-mix(in srgb, var(--glyph-primary) 50%, var(--glyph-border));
        }

        .glyph-command-input:focus {
          border-color: var(--glyph-primary);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--glyph-primary) 12%, transparent),
                      inset 0 1px 2px rgba(0, 0, 0, 0.03);
          transform: translateY(-1px);
        }

        .glyph-command-input::placeholder {
          color: var(--glyph-text-muted);
          transition: color 0.2s ease;
        }

        .glyph-command-input:focus::placeholder {
          color: color-mix(in srgb, var(--glyph-text-muted) 60%, transparent);
        }

        .glyph-command-input:disabled {
          background: #f9fafb;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .glyph-command-input.processing {
          animation: glyph-thinking-pulse 1.8s ease-in-out infinite;
        }

        @keyframes glyph-thinking-pulse {
          0%, 100% {
            border-color: var(--glyph-primary);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--glyph-primary) 8%, transparent);
          }
          50% {
            border-color: color-mix(in srgb, var(--glyph-primary) 60%, transparent);
            box-shadow: 0 0 0 5px color-mix(in srgb, var(--glyph-primary) 4%, transparent);
          }
        }

        .glyph-btn {
          padding: 11px 22px;
          background: linear-gradient(135deg, var(--glyph-primary) 0%, var(--glyph-primary-hover) 100%);
          color: white;
          border: none;
          border-radius: var(--glyph-radius);
          font-size: 14px;
          font-weight: 600;
          font-family: var(--glyph-font);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }

        .glyph-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,
            rgba(255,255,255,0.15) 0%,
            transparent 50%,
            rgba(0,0,0,0.1) 100%
          );
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .glyph-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(30, 58, 95, 0.25), 0 2px 6px rgba(30, 58, 95, 0.15);
        }

        .glyph-btn:hover::before {
          opacity: 1;
        }

        .glyph-btn:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 8px rgba(30, 58, 95, 0.2);
        }

        .glyph-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .glyph-btn.generating {
          background: linear-gradient(
            90deg,
            var(--glyph-primary) 0%,
            color-mix(in srgb, var(--glyph-primary) 70%, white) 50%,
            var(--glyph-primary) 100%
          );
          background-size: 200% 100%;
          animation: glyph-shimmer 1.5s ease-in-out infinite;
        }

        .glyph-btn-secondary {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          color: #374151;
          border: 1px solid var(--glyph-border);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .glyph-btn-secondary:hover {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-color: var(--glyph-primary);
          color: var(--glyph-primary);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .glyph-btn-secondary:hover::before {
          opacity: 0;
        }

        .glyph-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          color: var(--glyph-text-muted);
          gap: 16px;
          animation: glyph-fade-in 0.3s ease-out;
        }

        .glyph-loading-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .glyph-spinner {
          width: 28px;
          height: 28px;
          border: 2.5px solid var(--glyph-border);
          border-top-color: var(--glyph-primary);
          border-radius: 50%;
          animation: glyph-spin 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .glyph-loading-text {
          font-size: 14px;
          font-weight: 500;
        }

        .glyph-loading-dots {
          display: inline-flex;
          gap: 4px;
          margin-left: 4px;
        }

        .glyph-loading-dots span {
          width: 4px;
          height: 4px;
          background: var(--glyph-text-muted);
          border-radius: 50%;
          animation: glyph-pulse 1.2s ease-in-out infinite;
        }

        .glyph-loading-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .glyph-loading-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        /* Skeleton shimmer for preview area */
        .glyph-skeleton {
          width: 90%;
          max-width: 400px;
          padding: 20px;
          background: var(--glyph-bg);
          border-radius: 8px;
          border: 1px solid var(--glyph-border);
        }

        .glyph-skeleton-line {
          height: 12px;
          background: linear-gradient(
            90deg,
            var(--glyph-border) 0%,
            #f0f0f0 50%,
            var(--glyph-border) 100%
          );
          background-size: 200% 100%;
          animation: glyph-shimmer 1.5s ease-in-out infinite;
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .glyph-skeleton-line:nth-child(2) { width: 80%; }
        .glyph-skeleton-line:nth-child(3) { width: 60%; }
        .glyph-skeleton-line:nth-child(4) { width: 90%; margin-bottom: 0; }

        @keyframes glyph-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes glyph-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glyph-appear {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Content appears after container */
        @keyframes glyph-content-appear {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes glyph-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @keyframes glyph-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes glyph-success-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes glyph-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }

        .glyph-error {
          padding: 32px 24px;
          color: #dc2626;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          height: 100%;
          justify-content: center;
          animation: glyph-fade-in 0.3s ease-out;
        }

        .glyph-error-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
          animation: glyph-shake 0.5s ease-in-out;
        }

        .glyph-error-message {
          font-size: 14px;
          max-width: 300px;
          line-height: 1.5;
        }

        .glyph-error-retry {
          margin-top: 8px;
          padding: 8px 20px;
          background: transparent;
          border: 1px solid #dc2626;
          border-radius: 6px;
          color: #dc2626;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .glyph-error-retry:hover {
          background: #dc2626;
          color: white;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
        }

        /* Toast Stack Container */
        .glyph-toast-container {
          position: absolute;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column-reverse;
          gap: 8px;
          z-index: 100;
          pointer-events: none;
        }

        .glyph-toast {
          position: relative;
          transform: translateX(100%) scale(0.95);
          background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
          color: white;
          padding: 12px 20px 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          opacity: 0;
          transition: transform var(--glyph-transition-slow) cubic-bezier(0.34, 1.56, 0.64, 1),
                      opacity var(--glyph-transition-slow) ease;
          pointer-events: auto;
          max-width: 320px;
          min-width: 200px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(8px);
          overflow: hidden;
        }

        .glyph-toast::before {
          content: '';
          display: inline-flex;
          width: 20px;
          height: 20px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Progress bar for auto-dismiss */
        .glyph-toast::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          width: 100%;
          background: rgba(255, 255, 255, 0.3);
          transform-origin: left;
          animation: glyph-toast-progress 3s linear forwards;
        }

        @keyframes glyph-toast-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        .glyph-toast.show {
          opacity: 1;
          transform: translateX(0) scale(1);
        }

        .glyph-toast.hiding {
          opacity: 0;
          transform: translateX(100%) scale(0.95);
        }

        .glyph-toast.success::before {
          background: var(--glyph-success);
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
        }

        .glyph-toast.warning {
          background: linear-gradient(135deg, var(--glyph-warning) 0%, #d97706 100%);
        }

        .glyph-toast.warning::before {
          background: #fef3c7;
        }

        .glyph-toast.error {
          background: linear-gradient(135deg, var(--glyph-error) 0%, #b91c1c 100%);
        }

        .glyph-toast.error::before {
          background: #fecaca;
        }

        .glyph-toast-message {
          flex: 1;
        }

        .glyph-toast-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 4px;
          margin: -4px -8px -4px 0;
          font-size: 16px;
          line-height: 1;
          transition: color var(--glyph-transition-fast) ease;
        }

        .glyph-toast-close:hover {
          color: white;
        }

        /* Confetti celebration animation */
        .glyph-confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 1000;
        }

        .glyph-confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: glyph-confetti-fall 2s ease-out forwards;
        }

        @keyframes glyph-confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        /* Change highlight animation for modified areas */
        .glyph-change-highlight {
          animation: glyph-highlight-flash 0.6s ease-out;
        }

        @keyframes glyph-highlight-flash {
          0% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
          }
          50% {
            box-shadow: 0 0 20px 10px rgba(251, 191, 36, 0.4);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
          }
        }

        /* Success checkmark animation */
        .glyph-success-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: var(--glyph-success);
          border-radius: 50%;
          animation: glyph-check-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .glyph-success-check svg {
          width: 14px;
          height: 14px;
          stroke: white;
          stroke-width: 3;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 20;
          stroke-dashoffset: 20;
          animation: glyph-check-draw 0.3s ease-out 0.2s forwards;
        }

        @keyframes glyph-check-pop {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        @keyframes glyph-check-draw {
          to { stroke-dashoffset: 0; }
        }

        /* Floating Region Toolbar */
        .glyph-region-toolbar {
          position: absolute;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid var(--glyph-border);
          border-radius: 10px;
          padding: 8px;
          display: flex;
          gap: 4px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          animation: glyph-toolbar-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: auto;
        }

        @keyframes glyph-toolbar-pop {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .glyph-toolbar-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: var(--glyph-text);
          transition: all 0.15s ease;
        }

        .glyph-toolbar-btn:hover {
          background: #f1f5f9;
          border-color: var(--glyph-border);
        }

        .glyph-toolbar-btn:active {
          transform: scale(0.95);
        }

        .glyph-toolbar-btn.active {
          background: var(--glyph-primary);
          color: white;
          border-color: var(--glyph-primary);
        }

        .glyph-toolbar-divider {
          width: 1px;
          background: var(--glyph-border);
          margin: 4px 4px;
        }

        .glyph-toolbar-color-picker {
          width: 32px;
          height: 32px;
          padding: 0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          background: transparent;
        }

        .glyph-toolbar-color-picker::-webkit-color-swatch-wrapper {
          padding: 4px;
        }

        .glyph-toolbar-color-picker::-webkit-color-swatch {
          border-radius: 4px;
          border: 1px solid var(--glyph-border);
        }

        /* Undo/Redo Controls */
        .glyph-history-controls {
          display: flex;
          gap: 4px;
          margin-right: 8px;
        }

        .glyph-history-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--glyph-bg);
          border: 1px solid var(--glyph-border);
          border-radius: var(--glyph-radius);
          cursor: pointer;
          color: var(--glyph-text);
          transition: all 0.15s ease;
        }

        .glyph-history-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: var(--glyph-primary);
          color: var(--glyph-primary);
        }

        .glyph-history-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .glyph-history-btn svg {
          width: 16px;
          height: 16px;
        }

        /* Command wrapper for autocomplete positioning */
        .glyph-command-wrapper {
          position: relative;
          flex: 1;
        }

        /* Region Quick Actions (context-specific pills) */
        .glyph-region-actions {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
          flex-wrap: wrap;
          animation: glyph-fade-in 0.2s ease-out;
        }

        .glyph-region-action-pill {
          padding: 6px 12px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #93c5fd;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          color: #1e40af;
          transition: all 0.15s ease;
        }

        .glyph-region-action-pill:hover {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
        }

        /* AI Progress Indicator */
        .glyph-ai-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          text-align: center;
        }

        .glyph-ai-progress-time {
          font-size: 24px;
          font-weight: 600;
          color: var(--glyph-primary);
          font-variant-numeric: tabular-nums;
        }

        .glyph-ai-progress-message {
          font-size: 14px;
          color: var(--glyph-text);
          font-weight: 500;
          transition: opacity 0.3s ease;
        }

        .glyph-ai-progress-submessage {
          font-size: 12px;
          color: var(--glyph-text-muted);
          margin-top: 4px;
        }

        .glyph-ai-progress-bar {
          width: 200px;
          height: 4px;
          background: var(--glyph-border);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 8px;
        }

        .glyph-ai-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--glyph-primary), color-mix(in srgb, var(--glyph-primary) 70%, white));
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .glyph-ai-progress-warning {
          color: var(--glyph-warning);
          font-size: 13px;
          margin-top: 8px;
          animation: glyph-fade-in 0.3s ease-out;
        }

        /* Region Visual Hint */
        .glyph-region-hint {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
          color: white;
          padding: 10px 20px;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 500;
          z-index: 100;
          animation: glyph-hint-appear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          white-space: nowrap;
        }

        .glyph-region-hint::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #111827;
        }

        @keyframes glyph-hint-appear {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes glyph-hint-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(30, 58, 95, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(30, 58, 95, 0);
          }
        }

        /* Validation Status Indicator */
        .glyph-validation-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          margin-left: 8px;
          transition: all 0.2s ease;
        }

        .glyph-validation-status.validating {
          background: #fef3c7;
          color: #92400e;
        }

        .glyph-validation-status.valid {
          background: #dcfce7;
          color: #166534;
        }

        .glyph-validation-status.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .glyph-validation-icon {
          width: 12px;
          height: 12px;
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

          .glyph-region-toolbar {
            padding: 6px;
          }

          .glyph-toolbar-btn {
            width: 28px;
            height: 28px;
          }
        }

        /* Template Controls */
        .glyph-template-controls {
          display: flex;
          gap: 8px;
          margin-right: 8px;
        }

        .glyph-btn-save, .glyph-btn-load {
          display: flex;
          align-items: center;
          padding: 8px 14px;
          font-size: 13px;
        }

        .glyph-btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Load Dropdown */
        .glyph-load-dropdown {
          position: relative;
        }

        .glyph-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 200px;
          max-height: 300px;
          overflow-y: auto;
          background: var(--glyph-bg);
          border: 1px solid var(--glyph-border);
          border-radius: var(--glyph-radius);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          z-index: 100;
          animation: glyph-dropdown-appear 0.15s ease-out;
        }

        @keyframes glyph-dropdown-appear {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .glyph-dropdown-item {
          display: flex;
          flex-direction: column;
          padding: 12px 16px;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          transition: background 0.15s ease;
        }

        .glyph-dropdown-item:hover {
          background: #f3f4f6;
        }

        .glyph-dropdown-item-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--glyph-text);
        }

        .glyph-dropdown-item-date {
          font-size: 11px;
          color: var(--glyph-text-muted);
          margin-top: 2px;
        }

        .glyph-dropdown-empty {
          padding: 16px;
          text-align: center;
          color: var(--glyph-text-muted);
          font-size: 13px;
        }

        .glyph-dropdown-item-delete {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--glyph-text-muted);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          opacity: 0;
          transition: opacity 0.15s ease, color 0.15s ease;
        }

        .glyph-dropdown-item:hover .glyph-dropdown-item-delete {
          opacity: 1;
        }

        .glyph-dropdown-item-delete:hover {
          color: var(--glyph-error);
          background: #fef2f2;
        }

        .glyph-dropdown-item {
          position: relative;
        }

        /* Modal Styles */
        .glyph-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: glyph-fade-in 0.2s ease-out;
          backdrop-filter: blur(2px);
        }

        .glyph-modal {
          background: var(--glyph-bg);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 90%;
          max-width: 400px;
          animation: glyph-modal-appear 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes glyph-modal-appear {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .glyph-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--glyph-border);
        }

        .glyph-modal-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--glyph-text);
          margin: 0;
        }

        .glyph-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: var(--glyph-text-muted);
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: color 0.15s ease;
        }

        .glyph-modal-close:hover {
          color: var(--glyph-text);
        }

        .glyph-modal-body {
          padding: 24px;
        }

        .glyph-input-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--glyph-text);
          margin-bottom: 8px;
        }

        .glyph-modal-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid var(--glyph-border);
          border-radius: var(--glyph-radius);
          font-size: 14px;
          font-family: var(--glyph-font);
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .glyph-modal-input:focus {
          border-color: var(--glyph-primary);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--glyph-primary) 12%, transparent);
        }

        .glyph-input-hint {
          font-size: 12px;
          color: var(--glyph-text-muted);
          margin-top: 8px;
          margin-bottom: 0;
        }

        .glyph-modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px 20px;
          border-top: 1px solid var(--glyph-border);
        }
      </style>
      <div class="glyph-container" role="application" aria-label="Glyph PDF Editor">
        <div class="glyph-preview-area" role="region" aria-label="Document preview" aria-live="polite">
          <div class="glyph-loading" role="status" aria-label="Loading document preview">
            <div class="glyph-loading-content">
              <div class="glyph-spinner" aria-hidden="true"></div>
              <span class="glyph-loading-text">Loading preview<span class="glyph-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span></span>
            </div>
            <div class="glyph-skeleton" aria-hidden="true">
              <!-- Document-shaped skeleton: header, content blocks, footer -->
              <div class="glyph-skeleton-header">
                <div class="glyph-skeleton-line" style="width: 40%; height: 16px; margin-bottom: 8px;"></div>
                <div class="glyph-skeleton-line" style="width: 60%; height: 10px;"></div>
              </div>
              <div class="glyph-skeleton-body" style="margin-top: 20px;">
                <div class="glyph-skeleton-line" style="width: 100%;"></div>
                <div class="glyph-skeleton-line" style="width: 85%;"></div>
                <div class="glyph-skeleton-line" style="width: 70%;"></div>
                <div class="glyph-skeleton-line" style="width: 90%;"></div>
              </div>
              <div class="glyph-skeleton-footer" style="margin-top: 20px;">
                <div class="glyph-skeleton-line" style="width: 50%; margin-left: auto;"></div>
              </div>
            </div>
          </div>
          <div class="glyph-toast-container" id="glyph-toast-container" role="region" aria-label="Notifications" aria-live="polite"></div>
        </div>
        <div class="glyph-controls" role="toolbar" aria-label="Editing controls">
          <div class="glyph-quick-actions" role="group" aria-label="Quick actions">
            <button class="glyph-pill" data-action="Add company logo in the header" tabindex="0" aria-label="Add company logo to the document header">Add logo</button>
            <button class="glyph-pill" data-action="Apply a professional navy blue and gold color scheme that matches corporate branding" tabindex="0" aria-label="Apply professional brand colors">Brand colors</button>
            <button class="glyph-pill" data-action="Make this look more professional and polished with better typography and spacing" tabindex="0" aria-label="Make document more professional">More professional</button>
            <button class="glyph-pill" data-action="Make the totals section larger and more prominent with bold styling" tabindex="0" aria-label="Emphasize the totals section">Emphasize totals</button>
            <button class="glyph-pill" data-action="Use a more compact layout with less whitespace while maintaining readability" tabindex="0" aria-label="Apply compact layout">Compact layout</button>
          </div>
          <div class="glyph-region-actions" id="glyph-region-actions" style="display: none;" role="group" aria-label="Region-specific actions"></div>
          <div class="glyph-command-row">
            <div class="glyph-history-controls" role="group" aria-label="History controls">
              <button class="glyph-history-btn" id="glyph-undo" aria-label="Undo last change (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                </svg>
              </button>
              <button class="glyph-history-btn" id="glyph-redo" aria-label="Redo last undone change (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
                </svg>
              </button>
            </div>
            <div class="glyph-command-wrapper" id="glyph-command-wrapper">
              <input type="text" class="glyph-command-input" placeholder="What would you like to change?" aria-label="Type an edit command and press Enter" id="glyph-command-input" aria-autocomplete="list" aria-controls="glyph-autocomplete-dropdown" />
            </div>
            <div class="glyph-template-controls" role="group" aria-label="Template controls">
              <button class="glyph-btn glyph-btn-secondary glyph-btn-save" id="glyph-save-template" aria-label="Save template" title="Save Template" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16" style="margin-right: 4px;">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save
              </button>
              <div class="glyph-load-dropdown" id="glyph-load-dropdown">
                <button class="glyph-btn glyph-btn-secondary glyph-btn-load" id="glyph-load-template" aria-label="Load saved template" title="Load Template" aria-haspopup="listbox" aria-expanded="false">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16" style="margin-right: 4px;">
                    <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  Load
                </button>
                <div class="glyph-dropdown-menu" id="glyph-template-list" role="listbox" aria-label="Saved templates" style="display: none;"></div>
              </div>
            </div>
            <button class="glyph-btn glyph-btn-secondary" id="glyph-download" aria-label="Download document as PDF" title="Download PDF">Download</button>
          </div>
        </div>
      </div>
      <!-- Save Template Modal -->
      <div class="glyph-modal-overlay" id="glyph-save-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="glyph-modal-title">
        <div class="glyph-modal">
          <div class="glyph-modal-header">
            <h3 id="glyph-modal-title" class="glyph-modal-title">Save Template</h3>
            <button class="glyph-modal-close" id="glyph-modal-close" aria-label="Close modal">&times;</button>
          </div>
          <div class="glyph-modal-body">
            <label for="glyph-template-name" class="glyph-input-label">Template Name</label>
            <input type="text" id="glyph-template-name" class="glyph-modal-input" placeholder="My Custom Template" maxlength="50" />
            <p class="glyph-input-hint">Give your template a memorable name</p>
          </div>
          <div class="glyph-modal-footer">
            <button class="glyph-btn glyph-btn-secondary" id="glyph-modal-cancel">Cancel</button>
            <button class="glyph-btn" id="glyph-modal-save">Save Template</button>
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
    // Quick action pills with keyboard navigation
    const pills = this.shadow.querySelectorAll('.glyph-pill');
    const pillsArray = Array.from(pills) as HTMLElement[];

    pills.forEach((pill, index) => {
      pill.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).getAttribute('data-action');
        if (action) {
          this.executeCommand(action, e.currentTarget as HTMLElement);
        }
      });

      // Arrow key navigation for pills
      pill.addEventListener('keydown', (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (index + 1) % pillsArray.length;
          this.focusPill(pillsArray, nextIndex);
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = (index - 1 + pillsArray.length) % pillsArray.length;
          this.focusPill(pillsArray, prevIndex);
        } else if (key === 'Escape') {
          // Clear pill focus and move to input
          const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
          if (input) input.focus();
        }
      });
    });

    // Command input - Enter key with debounce
    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    const commandWrapper = this.shadow.getElementById('glyph-command-wrapper');

    if (input && commandWrapper) {
      // Initialize field autocomplete
      this.fieldAutocomplete = new FieldAutocomplete({
        inputElement: input,
        container: commandWrapper,
        onSelect: (_suggestion: AutocompleteSuggestion, composedPrompt: string) => {
          // Set the composed prompt in the input (_suggestion available if needed for future enhancements)
          input.value = composedPrompt;
          input.focus();
          // Position cursor at end
          input.setSelectionRange(input.value.length, input.value.length);
        },
        accentColor: '#14B8A6',
        getDocumentHtml: () => {
          // Return current preview HTML for document context analysis
          const preview = this.shadow.querySelector('.glyph-preview-content');
          return preview ? preview.innerHTML : '';
        },
      });

      input.addEventListener('keydown', (e) => {
        // Don't handle Enter if autocomplete is handling it
        if (e.key === 'Enter' && input.value.trim() && !this.isLoading) {
          // Check if autocomplete dropdown is visible - if so, let it handle Enter
          const autocompleteDropdown = commandWrapper.querySelector('.glyph-autocomplete-dropdown') as HTMLElement;
          if (autocompleteDropdown && autocompleteDropdown.style.display !== 'none') {
            return; // Let autocomplete handle it
          }

          // Debounce rapid Enter presses
          if (this.commandDebounceTimer) {
            clearTimeout(this.commandDebounceTimer);
          }
          this.commandDebounceTimer = setTimeout(() => {
            this.executeCommand(input.value.trim());
            input.value = '';
            this.commandDebounceTimer = null;
          }, this.commandDebounceMs);
        } else if (e.key === 'Escape') {
          // Clear selection and input
          input.value = '';
          this.selectedRegion = null;
          this.hideRegionActions();
          input.placeholder = "What would you like to change?";
        }
      });
    }

    // Download button
    const downloadBtn = this.shadow.getElementById('glyph-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadPdf());
    }

    // Undo/Redo buttons
    const undoBtn = this.shadow.getElementById('glyph-undo');
    const redoBtn = this.shadow.getElementById('glyph-redo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
    }
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
    }

    // Keyboard shortcuts for undo/redo
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          this.redo();
        } else {
          e.preventDefault();
          this.undo();
        }
      }
    });

    // Template save/load event listeners
    const saveBtn = this.shadow.getElementById('glyph-save-template');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.openSaveModal());
    }

    const loadBtn = this.shadow.getElementById('glyph-load-template');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.toggleLoadDropdown());
    }

    const modalClose = this.shadow.getElementById('glyph-modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeSaveModal());
    }

    const modalCancel = this.shadow.getElementById('glyph-modal-cancel');
    if (modalCancel) {
      modalCancel.addEventListener('click', () => this.closeSaveModal());
    }

    const modalSave = this.shadow.getElementById('glyph-modal-save');
    if (modalSave) {
      modalSave.addEventListener('click', () => this.saveTemplate());
    }

    const modalOverlay = this.shadow.getElementById('glyph-save-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeSaveModal();
        }
      });
    }

    const templateNameInput = this.shadow.getElementById('glyph-template-name') as HTMLInputElement;
    if (templateNameInput) {
      templateNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.saveTemplate();
        } else if (e.key === 'Escape') {
          this.closeSaveModal();
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = this.shadow.getElementById('glyph-load-dropdown');
      const target = e.target as Node;
      if (dropdown && !dropdown.contains(target)) {
        this.closeLoadDropdown();
      }
    });
  }

  /**
   * Focus a pill by index for keyboard navigation
   */
  private focusPill(pills: HTMLElement[], index: number) {
    // Remove focus from all pills
    pills.forEach(p => p.classList.remove('pill-focused'));

    // Focus the target pill
    const targetPill = pills[index];
    if (targetPill) {
      targetPill.classList.add('pill-focused');
      targetPill.focus();
    }
  }

  /**
   * Execute an AI modification command
   */
  private async executeCommand(command: string, pillElement?: HTMLElement) {
    if (!this.api || !this.sessionId || this.isLoading) return;

    // CRITICAL: Save current state to history BEFORE modification
    // This ensures we can undo even if AI regenerates/wipes content
    this.saveToHistory();

    // Add processing state to input
    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.classList.add('processing');
    }

    if (pillElement) {
      pillElement.classList.add('loading');
    }
    this.setLoading(true, true); // true = isAiOperation

    try {
      const result = await this.api.modify(
        this.sessionId,
        command,
        this.selectedRegion || undefined
      );

      this.currentHtml = result.html;
      this.saveToHistory(); // Also save the new state so we can redo
      this.renderPreview();

      // Clear region selection after successful modification
      this.selectedRegion = null;
      this.hideRegionActions();
      const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
      if (input) {
        input.placeholder = "What would you like to change?";
      }

      // Show success state on pill
      if (pillElement) {
        pillElement.classList.remove('loading');
        pillElement.classList.add('success');
        setTimeout(() => {
          pillElement.classList.remove('success');
        }, 1500);
      }

      const changeMessage = result.changes?.[0] || 'Changes applied successfully';
      this.showToast(changeMessage);

      // Show validation success toast
      this.showValidationToast(true);

      // Celebrate first successful edit with confetti (one-time)
      this.celebrateFirstEdit();

      // Enable save button after successful modification
      this.hasModifications = true;
      this.updateSaveButtonState();

      this.emit('glyph:modified', { command, changes: result.changes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply changes';
      this.showToast(message, true);
      this.onError?.({ code: 'MODIFY_ERROR', message });

      // Shake the input on error
      if (input) {
        input.style.animation = 'glyph-shake 0.5s ease-in-out';
        setTimeout(() => {
          input.style.animation = '';
        }, 500);
      }

      if (pillElement) {
        pillElement.classList.remove('loading');
      }
    } finally {
      if (input) {
        input.classList.remove('processing');
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
    btn.classList.add('generating');

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

      // Brief success state
      btn.textContent = 'Downloaded!';
      btn.style.background = '#22c55e';
      setTimeout(() => {
        btn.style.background = '';
        btn.textContent = originalText;
      }, 1500);

      this.showToast('PDF downloaded successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate PDF';
      this.showToast(message, true);
      this.onError?.({ code: 'GENERATE_ERROR', message });
      btn.textContent = originalText;
    } finally {
      btn.disabled = false;
      btn.classList.remove('generating');
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
      <iframe class="glyph-preview-frame" sandbox="allow-same-origin" title="Document preview" style="opacity: 0; transition: opacity 0.3s ease-out;"></iframe>
      <div class="glyph-toast"></div>
    `;

    const iframe = previewArea.querySelector('iframe') as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    if (doc) {
      doc.open();
      doc.write(this.wrapHtmlWithStyles(this.currentHtml));
      doc.close();

      // Fade in the iframe once content is ready
      requestAnimationFrame(() => {
        iframe.style.opacity = '1';
      });

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
        /* Region visual affordance - make it clear sections are clickable */
        [data-glyph-region] {
          cursor: pointer;
          transition: outline 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
          position: relative;
          border-radius: 4px;
        }

        /* Subtle pulse animation on page load to draw attention */
        @keyframes glyph-region-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(30, 58, 95, 0.1); }
          50% { box-shadow: 0 0 0 4px rgba(30, 58, 95, 0.05); }
        }

        [data-glyph-region] {
          animation: glyph-region-pulse 2s ease-in-out 1;
        }

        /* Hover state - clear visual feedback */
        [data-glyph-region]:hover {
          outline: 2px dashed rgba(30, 58, 95, 0.4);
          outline-offset: 3px;
          background-color: rgba(30, 58, 95, 0.02);
          box-shadow: 0 2px 8px rgba(30, 58, 95, 0.1);
        }

        /* Touch device hover equivalent */
        @media (hover: none) {
          [data-glyph-region]:active {
            outline: 2px dashed rgba(30, 58, 95, 0.4);
            outline-offset: 3px;
            background-color: rgba(30, 58, 95, 0.02);
          }
        }

        /* Selected/highlighted state */
        .glyph-region-highlight {
          outline: 2px solid #1e3a5f !important;
          outline-offset: 3px !important;
          background: rgba(30, 58, 95, 0.05) !important;
          box-shadow: 0 4px 12px rgba(30, 58, 95, 0.15) !important;
        }

        /* Reduce motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          [data-glyph-region] {
            animation: none;
          }
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
   * Set up click and touch handlers for region-based editing
   */
  private setupRegionSelection(doc: Document) {
    const regions = doc.querySelectorAll('[data-glyph-region]');

    // Show first-visit hint
    this.showRegionHintIfFirstVisit();

    // Track touch state for long-press
    let touchStartTime = 0;
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    const LONG_PRESS_DURATION = 500; // ms

    regions.forEach(region => {
      // Handle region selection (shared logic for click and touch)
      const handleRegionSelect = (enterEditMode: boolean = false) => {
        // Clear previous selection
        regions.forEach(r => r.classList.remove('glyph-region-highlight'));

        // Highlight new selection
        region.classList.add('glyph-region-highlight');
        this.selectedRegion = region.getAttribute('data-glyph-region');

        // Hide the hint once user interacts
        this.hideRegionHint();

        if (enterEditMode) {
          this._isEditMode = true;
          this.showFloatingToolbar(region);
        } else {
          this._isEditMode = false;
          this.hideFloatingToolbar();
        }

        // Show region-specific quick actions
        if (this.selectedRegion) {
          this.showRegionActions(this.selectedRegion);
        }

        // Update placeholder and focus input
        const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
        if (input) {
          const suffix = enterEditMode ? ' (edit mode)' : '';
          input.placeholder = `Edit the ${this.selectedRegion}${suffix}...`;
        }

        const eventName = enterEditMode ? 'glyph:edit-mode' : 'glyph:region-selected';
        this.emit(eventName, { region: this.selectedRegion });
      };

      // Single click - select region and show quick actions
      region.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleRegionSelect(false);
      });

      // Double-click - enter edit mode with floating toolbar
      region.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleRegionSelect(true);
      });

      // Touch start - begin tracking for long-press
      region.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();

        // Start long-press timer for edit mode
        touchTimer = setTimeout(() => {
          e.preventDefault();
          handleRegionSelect(true); // Enter edit mode on long press
          // Provide haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }, LONG_PRESS_DURATION);
      }, { passive: false });

      // Touch end - handle tap or cancel long-press
      region.addEventListener('touchend', (e) => {
        const touchDuration = Date.now() - touchStartTime;

        // Clear long-press timer
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }

        // If it was a quick tap (not long press), treat as regular selection
        if (touchDuration < LONG_PRESS_DURATION) {
          e.preventDefault();
          handleRegionSelect(false);
        }
      });

      // Touch cancel - clear timer
      region.addEventListener('touchcancel', () => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      });

      // Touch move - cancel long-press if user moves finger
      region.addEventListener('touchmove', () => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      });
    });

    // Click/touch outside regions clears selection
    doc.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-glyph-region]')) {
        this.clearRegionSelection(regions);
      }
    });

    doc.body.addEventListener('touchend', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-glyph-region]')) {
        this.clearRegionSelection(regions);
      }
    });
  }

  /**
   * Show hint for first-time visitors about clicking regions
   */
  private showRegionHintIfFirstVisit() {
    if (this.hasShownRegionHint) return;

    try {
      if (localStorage.getItem(GlyphEditor.FIRST_VISIT_KEY)) return;
    } catch {
      // localStorage not available, skip hint
      return;
    }

    const previewArea = this.shadow.querySelector('.glyph-preview-area');
    if (!previewArea) return;

    // Create hint element
    const hint = document.createElement('div');
    hint.className = 'glyph-region-hint';
    hint.id = 'glyph-region-hint';
    hint.innerHTML = 'Click any section to customize it';
    hint.setAttribute('role', 'tooltip');

    previewArea.appendChild(hint);
    this.hasShownRegionHint = true;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideRegionHint();
      try {
        localStorage.setItem(GlyphEditor.FIRST_VISIT_KEY, 'true');
      } catch {
        // Ignore localStorage errors
      }
    }, 5000);
  }

  /**
   * Hide the region hint
   */
  private hideRegionHint() {
    const hint = this.shadow.getElementById('glyph-region-hint');
    if (hint) {
      hint.style.opacity = '0';
      hint.style.transform = 'translateX(-50%) translateY(-10px)';
      setTimeout(() => hint.remove(), 300);
    }
  }

  /**
   * Clear the current region selection
   */
  private clearRegionSelection(regions: NodeListOf<Element>) {
    regions.forEach(r => r.classList.remove('glyph-region-highlight'));
    this.selectedRegion = null;
    this._isEditMode = false;
    this.hideFloatingToolbar();
    this.hideRegionActions();

    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.placeholder = "What would you like to change?";
    }
  }

  // ============================================
  // UNDO/REDO HISTORY MANAGEMENT
  // ============================================

  /**
   * Save current HTML state to history
   */
  private saveToHistory() {
    // If we're not at the end of history, truncate future states
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add current state
    this.history.push(this.currentHtml);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.updateHistoryButtons();
  }

  /**
   * Undo last modification
   */
  public undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentHtml = this.history[this.historyIndex];
      this.renderPreview();
      this.updateHistoryButtons();
      this.showToast('Undone');
      this.emit('glyph:undo', { historyIndex: this.historyIndex });
    }
  }

  /**
   * Redo previously undone modification
   */
  public redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.currentHtml = this.history[this.historyIndex];
      this.renderPreview();
      this.updateHistoryButtons();
      this.showToast('Redone');
      this.emit('glyph:redo', { historyIndex: this.historyIndex });
    }
  }

  /**
   * Update undo/redo button states
   */
  private updateHistoryButtons() {
    const undoBtn = this.shadow.getElementById('glyph-undo') as HTMLButtonElement;
    const redoBtn = this.shadow.getElementById('glyph-redo') as HTMLButtonElement;

    if (undoBtn) {
      undoBtn.disabled = this.historyIndex <= 0;
    }
    if (redoBtn) {
      redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
  }

  // ============================================
  // REGION QUICK ACTIONS
  // ============================================

  /**
   * Get context-specific quick actions for a region
   */
  private getRegionQuickActions(region: string): Array<{ label: string; action: string }> {
    const actionsByRegion: Record<string, Array<{ label: string; action: string }>> = {
      'header': [
        { label: 'Add logo', action: 'Add a company logo to the header' },
        { label: 'Change company name style', action: 'Make the company name more prominent with larger text and bold styling' },
        { label: 'Add contact info', action: 'Add company phone and email below the company name' },
      ],
      'client-info': [
        { label: 'Add phone number', action: 'Add the client phone number {{client.phone}} to the client info section' },
        { label: 'Add email', action: 'Add the client email address {{client.email}} to the client info section' },
        { label: 'Compact layout', action: 'Make the client info section more compact' },
      ],
      'line-items': [
        { label: 'Add column', action: 'Add a new column for item code/SKU to the line items table' },
        { label: 'Alternate row colors', action: 'Add alternating row colors to the line items table for better readability' },
        { label: 'Compact rows', action: 'Reduce the spacing in the line items table for a more compact look' },
        { label: 'Add details column', action: 'Add a details column to show item descriptions' },
      ],
      'totals': [
        { label: 'Emphasize total', action: 'Make the final total larger and more prominent with bold styling and a highlight color' },
        { label: 'Add discount row', action: 'Add a discount row showing {{totals.discount}} to the totals section' },
        { label: 'Currency format', action: 'Format all currency values with proper currency symbols and thousands separators' },
        { label: 'Show tax rate', action: 'Display the tax rate percentage next to the tax amount' },
      ],
      'footer': [
        { label: 'Add terms', action: 'Add the terms and conditions {{meta.terms}} to the footer' },
        { label: 'Add signature line', action: 'Add signature lines for client and company representative' },
        { label: 'Add page number', action: 'Add page numbering to the footer' },
      ],
    };

    return actionsByRegion[region] || [
      { label: 'Make prominent', action: `Make the ${region} section more prominent and visually emphasized` },
      { label: 'Compact', action: `Make the ${region} section more compact with less spacing` },
      { label: 'Edit with AI', action: '' }, // Special case - focuses input
    ];
  }

  /**
   * Show region-specific quick actions
   */
  private showRegionActions(region: string) {
    const container = this.shadow.getElementById('glyph-region-actions');
    if (!container) return;

    const actions = this.getRegionQuickActions(region);
    let html = '';

    for (const action of actions) {
      if (action.action === '') {
        // Edit with AI button
        html += `<button class="glyph-region-action-pill" data-focus-input="true">Edit with AI</button>`;
      } else {
        html += `<button class="glyph-region-action-pill" data-action="${this.escapeHtml(action.action)}">${this.escapeHtml(action.label)}</button>`;
      }
    }

    container.innerHTML = html;
    container.style.display = 'flex';

    // Add click handlers
    container.querySelectorAll('.glyph-region-action-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const action = pill.getAttribute('data-action');
        const focusInput = pill.getAttribute('data-focus-input');

        if (focusInput) {
          const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
          if (input) input.focus();
        } else if (action) {
          this.executeCommand(action, pill as HTMLElement);
        }
      });
    });
  }

  /**
   * Hide region quick actions
   */
  private hideRegionActions() {
    const container = this.shadow.getElementById('glyph-region-actions');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }

  // ============================================
  // FLOATING TOOLBAR (Edit Mode)
  // ============================================

  /**
   * Show floating toolbar near selected region
   */
  private showFloatingToolbar(region: Element) {
    // Remove existing toolbar if any
    this.hideFloatingToolbar();

    const previewArea = this.shadow.querySelector('.glyph-preview-area');
    if (!previewArea) return;

    // Get region position relative to iframe
    const iframe = previewArea.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) return;

    const regionRect = region.getBoundingClientRect();

    // Create toolbar element
    const toolbar = document.createElement('div');
    toolbar.className = 'glyph-region-toolbar';
    toolbar.id = 'glyph-floating-toolbar';

    toolbar.innerHTML = `
      <button class="glyph-toolbar-btn" data-action="increase-font" title="Increase font size">A+</button>
      <button class="glyph-toolbar-btn" data-action="decrease-font" title="Decrease font size">A-</button>
      <div class="glyph-toolbar-divider"></div>
      <button class="glyph-toolbar-btn" data-action="bold" title="Bold">B</button>
      <div class="glyph-toolbar-divider"></div>
      <input type="color" class="glyph-toolbar-color-picker" data-action="color" value="#1e3a5f" title="Text color">
      <div class="glyph-toolbar-divider"></div>
      <button class="glyph-toolbar-btn" data-action="spacing-increase" title="Increase spacing">+</button>
      <button class="glyph-toolbar-btn" data-action="spacing-decrease" title="Decrease spacing">-</button>
      <div class="glyph-toolbar-divider"></div>
      <button class="glyph-toolbar-btn" data-action="ai-edit" title="Edit with AI">AI</button>
    `;

    // Position toolbar - mobile-friendly positioning
    const previewRect = previewArea.getBoundingClientRect();
    const isMobile = window.innerWidth <= 480;

    if (isMobile) {
      // On mobile, position toolbar at top center of preview area
      toolbar.style.top = '10px';
      toolbar.style.left = '50%';
      toolbar.style.transform = 'translateX(-50%)';
    } else {
      // On desktop, position above the selected region
      const top = regionRect.top - previewRect.top - 50;
      const left = regionRect.left - previewRect.left;

      // Ensure toolbar stays within preview area bounds
      const toolbarWidth = 300; // approximate width
      const maxLeft = previewRect.width - toolbarWidth - 10;

      toolbar.style.top = `${Math.max(10, top)}px`;
      toolbar.style.left = `${Math.min(maxLeft, Math.max(10, left))}px`;
    }

    previewArea.appendChild(toolbar);

    // Add event listeners to toolbar buttons (both click and touch)
    toolbar.querySelectorAll('.glyph-toolbar-btn, .glyph-toolbar-color-picker').forEach(btn => {
      const handleAction = (e: Event) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        if (action) {
          this.applyToolbarAction(action, btn);
        }
      };

      btn.addEventListener('click', handleAction);
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleAction(e);
      });

      if (btn.classList.contains('glyph-toolbar-color-picker')) {
        btn.addEventListener('input', (e) => {
          const color = (e.target as HTMLInputElement).value;
          this.applyToolbarAction('color', btn, color);
        });
      }
    });
  }

  /**
   * Hide floating toolbar
   */
  private hideFloatingToolbar() {
    const toolbar = this.shadow.getElementById('glyph-floating-toolbar');
    if (toolbar) {
      toolbar.remove();
    }
  }

  /**
   * Apply toolbar action to selected region
   */
  private applyToolbarAction(action: string, _button: Element, value?: string) {
    if (!this.selectedRegion) return;

    const commands: Record<string, string> = {
      'increase-font': `Increase the font size in the ${this.selectedRegion} section`,
      'decrease-font': `Decrease the font size in the ${this.selectedRegion} section`,
      'bold': `Make the text in the ${this.selectedRegion} section bold`,
      'color': `Change the text color in the ${this.selectedRegion} section to ${value || '#1e3a5f'}`,
      'spacing-increase': `Increase the spacing/padding in the ${this.selectedRegion} section`,
      'spacing-decrease': `Decrease the spacing/padding in the ${this.selectedRegion} section`,
      'ai-edit': '', // Special case - focuses input
    };

    const command = commands[action];
    if (command === '') {
      // Focus the command input for AI editing
      const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    } else if (command) {
      this.executeCommand(command);
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
  private setLoading(loading: boolean, isAiOperation: boolean = false) {
    this.isLoading = loading;

    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.disabled = loading;
    }

    // Add subtle thinking animation to preview during AI processing
    const previewArea = this.shadow.querySelector('.glyph-preview-area');
    if (previewArea) {
      if (loading && this.sessionId) {
        // Only show thinking state during modifications, not initial load
        previewArea.classList.add('thinking');

        // Show AI progress indicator for AI operations
        if (isAiOperation) {
          this.showAiProgressIndicator(previewArea as HTMLElement);
        }
      } else {
        previewArea.classList.remove('thinking');
        this.hideAiProgressIndicator();
      }
    }

    const downloadBtn = this.shadow.getElementById('glyph-download') as HTMLButtonElement;
    if (downloadBtn && !loading) {
      // Only re-enable if we have a session
      downloadBtn.disabled = !this.sessionId;
    }
  }

  /**
   * Show AI progress indicator with elapsed time and context messages
   */
  private showAiProgressIndicator(previewArea: HTMLElement) {
    // Start timer
    this.aiOperationStartTime = Date.now();
    this.hasShownLongWaitMessage = false;

    // Create progress overlay
    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'glyph-ai-progress';
    progressOverlay.id = 'glyph-ai-progress';
    progressOverlay.innerHTML = `
      <div class="glyph-spinner" aria-hidden="true"></div>
      <div class="glyph-ai-progress-time" id="glyph-ai-elapsed">0s</div>
      <div class="glyph-ai-progress-message" id="glyph-ai-message">Analyzing your request...</div>
      <div class="glyph-ai-progress-submessage" id="glyph-ai-submessage">AI is reading the document</div>
      <div class="glyph-ai-progress-bar">
        <div class="glyph-ai-progress-bar-fill" id="glyph-ai-progress-fill" style="width: 5%;"></div>
      </div>
      <div class="glyph-ai-progress-warning" id="glyph-ai-warning" style="display: none;"></div>
    `;

    // Insert at top of preview area
    const existingProgress = previewArea.querySelector('#glyph-ai-progress');
    if (existingProgress) {
      existingProgress.remove();
    }
    previewArea.insertBefore(progressOverlay, previewArea.firstChild);

    // Update timer every second
    this.aiOperationTimer = setInterval(() => {
      this.updateAiProgressIndicator();
    }, 1000);
  }

  /**
   * Update the AI progress indicator
   */
  private updateAiProgressIndicator() {
    const elapsedMs = Date.now() - this.aiOperationStartTime;
    const elapsedSec = Math.floor(elapsedMs / 1000);

    const elapsedEl = this.shadow.getElementById('glyph-ai-elapsed');
    const messageEl = this.shadow.getElementById('glyph-ai-message');
    const submessageEl = this.shadow.getElementById('glyph-ai-submessage');
    const progressFill = this.shadow.getElementById('glyph-ai-progress-fill');
    const warningEl = this.shadow.getElementById('glyph-ai-warning');

    if (elapsedEl) {
      elapsedEl.textContent = `${elapsedSec}s`;
    }

    // Update progress bar (estimate ~45s max)
    if (progressFill) {
      const progress = Math.min(95, (elapsedSec / 45) * 100);
      progressFill.style.width = `${progress}%`;
    }

    // Update context message based on elapsed time
    if (messageEl && submessageEl) {
      if (elapsedSec < 5) {
        messageEl.textContent = 'Analyzing your request...';
        submessageEl.textContent = 'AI is reading the document';
      } else if (elapsedSec < 15) {
        messageEl.textContent = 'Generating modifications...';
        submessageEl.textContent = 'Creating the perfect changes';
      } else if (elapsedSec < 30) {
        messageEl.textContent = 'Applying changes...';
        submessageEl.textContent = 'Almost there';
      } else {
        messageEl.textContent = 'Finalizing...';
        submessageEl.textContent = 'Wrapping up the details';
      }
    }

    // Show warning if taking longer than expected
    if (elapsedSec >= 20 && !this.hasShownLongWaitMessage && warningEl) {
      this.hasShownLongWaitMessage = true;
      warningEl.style.display = 'block';
      warningEl.textContent = 'This is taking longer than usual. Complex changes need more time.';
    }
  }

  /**
   * Hide AI progress indicator
   */
  private hideAiProgressIndicator() {
    if (this.aiOperationTimer) {
      clearInterval(this.aiOperationTimer);
      this.aiOperationTimer = null;
    }

    const progressEl = this.shadow.getElementById('glyph-ai-progress');
    if (progressEl) {
      progressEl.remove();
    }
  }

  /**
   * Show error state in preview area with retry button
   */
  private showError(message: string) {
    const previewArea = this.shadow.querySelector('.glyph-preview-area');
    if (previewArea) {
      previewArea.innerHTML = `
        <div class="glyph-error">
          <div class="glyph-error-icon">!</div>
          <div class="glyph-error-message">${this.escapeHtml(message)}</div>
          <button class="glyph-error-retry">Try Again</button>
        </div>
      `;

      // Add retry button handler
      const retryBtn = previewArea.querySelector('.glyph-error-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.initialize();
        });
      }
    }
    this.emit('glyph:error', { error: message });
  }

  /**
   * Show toast notification with stacking support
   */
  private showToast(message: string, isError = false) {
    const container = this.shadow.getElementById('glyph-toast-container');
    if (!container) return;

    // Generate unique ID for this toast
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // If we have max toasts, remove the oldest one
    if (this.activeToasts.size >= this.maxToasts) {
      const oldestToast = container.firstElementChild as HTMLElement;
      if (oldestToast) {
        this.removeToast(oldestToast, oldestToast.dataset.toastId || '');
      }
    }

    // Create toast element using safe DOM methods (XSS prevention)
    const toast = document.createElement('div');
    toast.className = `glyph-toast ${isError ? 'error' : 'success'}`;
    toast.dataset.toastId = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const messageSpan = document.createElement('span');
    messageSpan.className = 'glyph-toast-message';
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'glyph-toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '\u00d7'; // × character
    closeBtn.addEventListener('click', () => this.removeToast(toast, toastId));

    toast.appendChild(messageSpan);
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    this.activeToasts.add(toastId);

    // Trigger show animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      this.removeToast(toast, toastId);
    }, 3000);
  }

  /**
   * Remove a toast from the stack
   */
  private removeToast(toast: HTMLElement, toastId: string) {
    if (!this.activeToasts.has(toastId)) return;

    toast.classList.remove('show');
    toast.classList.add('hiding');

    // Remove after animation
    setTimeout(() => {
      toast.remove();
      this.activeToasts.delete(toastId);
    }, 400);
  }

  /**
   * Show validation status toast after AI modification
   */
  private showValidationToast(passed: boolean) {
    const container = this.shadow.getElementById('glyph-toast-container');
    if (!container) return;

    // Small delay to not overlap with main change toast
    setTimeout(() => {
      const toastId = `validation-${Date.now()}`;
      const toast = document.createElement('div');

      if (passed) {
        toast.className = 'glyph-toast success';
        toast.innerHTML = `
          <span class="glyph-toast-message">
            <svg class="glyph-validation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Changes verified safe
          </span>
          <button class="glyph-toast-close" aria-label="Dismiss">\u00d7</button>
        `;
      } else {
        toast.className = 'glyph-toast warning';
        toast.innerHTML = `
          <span class="glyph-toast-message">
            <svg class="glyph-validation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; width: 14px; height: 14px; vertical-align: middle; margin-right: 6px;">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Minor issues detected, auto-corrected
          </span>
          <button class="glyph-toast-close" aria-label="Dismiss">\u00d7</button>
        `;
      }

      toast.dataset.toastId = toastId;
      toast.setAttribute('role', 'alert');

      const closeBtn = toast.querySelector('.glyph-toast-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.removeToast(toast, toastId));
      }

      container.appendChild(toast);
      this.activeToasts.add(toastId);

      requestAnimationFrame(() => {
        toast.classList.add('show');
      });

      // Shorter auto-dismiss for validation toast
      setTimeout(() => {
        this.removeToast(toast, toastId);
      }, 2500);
    }, 500);
  }

  /**
   * Celebrate first successful edit with confetti
   */
  private celebrateFirstEdit() {
    // Skip if already celebrated or reduced motion preferred
    if (this.prefersReducedMotion) return;

    try {
      if (localStorage.getItem(GlyphEditor.CELEBRATION_KEY)) return;
      localStorage.setItem(GlyphEditor.CELEBRATION_KEY, 'true');
    } catch {
      // localStorage not available, skip celebration
      return;
    }

    const container = this.shadow.querySelector('.glyph-preview-area');
    if (!container) return;

    // Create confetti container
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'glyph-confetti-container';
    confettiContainer.setAttribute('aria-hidden', 'true');

    // Generate confetti pieces
    const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'glyph-confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.top = '-20px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      confetti.style.animationDuration = `${1.5 + Math.random()}s`;

      // Random shapes
      if (Math.random() > 0.5) {
        confetti.style.borderRadius = '50%';
      } else {
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      }

      confettiContainer.appendChild(confetti);
    }

    container.appendChild(confettiContainer);

    // Remove confetti after animation
    setTimeout(() => {
      confettiContainer.remove();
    }, 2500);
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
   * Check if a region is in edit mode (double-clicked)
   */
  public isInEditMode(): boolean {
    return this._isEditMode;
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

  // ============================================
  // TEMPLATE SAVE/LOAD METHODS
  // ============================================

  /**
   * Open the save template modal
   */
  private openSaveModal() {
    const modal = this.shadow.getElementById('glyph-save-modal');
    const input = this.shadow.getElementById('glyph-template-name') as HTMLInputElement;

    if (modal) {
      modal.style.display = 'flex';

      // Generate default name with timestamp
      const now = new Date();
      const defaultName = `My Template ${now.toLocaleDateString()}`;
      if (input) {
        input.value = defaultName;
        // Focus and select the text
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
      }
    }
  }

  /**
   * Close the save template modal
   */
  private closeSaveModal() {
    const modal = this.shadow.getElementById('glyph-save-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Save the current template to localStorage
   */
  private saveTemplate() {
    const input = this.shadow.getElementById('glyph-template-name') as HTMLInputElement;
    const name = input?.value.trim() || `Template ${Date.now()}`;

    // Check localStorage availability
    if (!this.isLocalStorageAvailable()) {
      this.showToast('Cannot save: storage not available in this browser mode', true);
      this.closeSaveModal();
      return;
    }

    try {
      // Get existing templates
      const templates = this.getSavedTemplates();

      // Create new template entry
      const newTemplate = {
        id: this.generateUUID(),
        name: name,
        baseTemplate: this.baseTemplate,
        html: this.currentHtml,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to templates array
      templates.push(newTemplate);

      // Save to localStorage
      localStorage.setItem(GlyphEditor.TEMPLATES_KEY, JSON.stringify(templates));

      // Close modal and show success
      this.closeSaveModal();
      this.showToast(`Template saved! It's ready for all your future quotes.`);

      // Emit event
      this.emit('glyph:template-saved', { template: newTemplate });

    } catch (error) {
      // Handle quota exceeded or other errors
      const message = error instanceof Error && error.name === 'QuotaExceededError'
        ? 'Storage full. Delete some templates to save new ones.'
        : 'Failed to save template';
      this.showToast(message, true);
    }
  }

  /**
   * Toggle the load template dropdown
   */
  private toggleLoadDropdown() {
    const dropdown = this.shadow.getElementById('glyph-template-list');
    const loadBtn = this.shadow.getElementById('glyph-load-template');

    if (dropdown && loadBtn) {
      const isVisible = dropdown.style.display !== 'none';

      if (isVisible) {
        this.closeLoadDropdown();
      } else {
        // Populate dropdown with saved templates
        this.populateTemplateDropdown();
        dropdown.style.display = 'block';
        loadBtn.setAttribute('aria-expanded', 'true');
      }
    }
  }

  /**
   * Close the load template dropdown
   */
  private closeLoadDropdown() {
    const dropdown = this.shadow.getElementById('glyph-template-list');
    const loadBtn = this.shadow.getElementById('glyph-load-template');

    if (dropdown) {
      dropdown.style.display = 'none';
    }
    if (loadBtn) {
      loadBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Populate the template dropdown with saved templates
   */
  private populateTemplateDropdown() {
    const dropdown = this.shadow.getElementById('glyph-template-list');
    if (!dropdown) return;

    const templates = this.getSavedTemplates();

    if (templates.length === 0) {
      dropdown.innerHTML = `
        <div class="glyph-dropdown-empty">
          No saved templates yet.<br>
          Make some edits and save your first template!
        </div>
      `;
      return;
    }

    // Sort by most recently updated
    templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Build dropdown items using safe DOM methods
    dropdown.innerHTML = '';

    templates.forEach(template => {
      const item = document.createElement('button');
      item.className = 'glyph-dropdown-item';
      item.setAttribute('role', 'option');
      item.dataset.templateId = template.id;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'glyph-dropdown-item-name';
      nameSpan.textContent = template.name;

      const dateSpan = document.createElement('span');
      dateSpan.className = 'glyph-dropdown-item-date';
      dateSpan.textContent = this.formatDate(template.updatedAt);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'glyph-dropdown-item-delete';
      deleteBtn.setAttribute('aria-label', `Delete ${template.name}`);
      deleteBtn.textContent = '\u00d7'; // x character
      deleteBtn.dataset.templateId = template.id;

      item.appendChild(nameSpan);
      item.appendChild(dateSpan);
      item.appendChild(deleteBtn);

      // Load template on click
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('glyph-dropdown-item-delete')) {
          return; // Let delete handler handle it
        }
        this.loadTemplate(template.id);
      });

      // Delete template
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTemplate(template.id, template.name);
      });

      dropdown.appendChild(item);
    });
  }

  /**
   * Load a saved template by ID
   */
  private loadTemplate(templateId: string) {
    const templates = this.getSavedTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      this.showToast('Template not found', true);
      return;
    }

    // Save current state to history before loading
    this.saveToHistory();

    // Load the template HTML
    this.currentHtml = template.html;
    this.baseTemplate = template.baseTemplate;
    this.renderPreview();

    // Save the new state to history
    this.saveToHistory();

    // Close dropdown and show success
    this.closeLoadDropdown();
    this.showToast(`Loaded "${template.name}"`);

    // Mark as modified (so they can save modifications)
    this.hasModifications = true;
    this.updateSaveButtonState();

    // Emit event
    this.emit('glyph:template-loaded', { template });
  }

  /**
   * Delete a saved template
   */
  private deleteTemplate(templateId: string, templateName: string) {
    const templates = this.getSavedTemplates();
    const filtered = templates.filter(t => t.id !== templateId);

    try {
      localStorage.setItem(GlyphEditor.TEMPLATES_KEY, JSON.stringify(filtered));

      // Refresh the dropdown
      this.populateTemplateDropdown();

      this.showToast(`Deleted "${templateName}"`);
      this.emit('glyph:template-deleted', { templateId, templateName });
    } catch {
      this.showToast('Failed to delete template', true);
    }
  }

  /**
   * Get saved templates from localStorage
   */
  private getSavedTemplates(): Array<{
    id: string;
    name: string;
    baseTemplate: string;
    html: string;
    createdAt: string;
    updatedAt: string;
  }> {
    if (!this.isLocalStorageAvailable()) {
      return [];
    }

    try {
      const stored = localStorage.getItem(GlyphEditor.TEMPLATES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__glyph_storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a UUID for template IDs
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Format date for display
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Update save button enabled state
   */
  private updateSaveButtonState() {
    const saveBtn = this.shadow.getElementById('glyph-save-template') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = !this.hasModifications;
    }
  }

  /**
   * Get saved templates (public API)
   */
  public getSavedTemplatesList(): Array<{ id: string; name: string; updatedAt: string }> {
    return this.getSavedTemplates().map(t => ({
      id: t.id,
      name: t.name,
      updatedAt: t.updatedAt,
    }));
  }

  /**
   * Programmatically load a template by ID
   */
  public loadSavedTemplate(templateId: string): boolean {
    const templates = this.getSavedTemplates();
    const template = templates.find(t => t.id === templateId);
    if (template) {
      this.loadTemplate(templateId);
      return true;
    }
    return false;
  }
}

// Auto-register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('glyph-editor')) {
  customElements.define('glyph-editor', GlyphEditor);
}
