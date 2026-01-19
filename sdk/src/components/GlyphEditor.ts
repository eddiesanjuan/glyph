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
import { FieldAutocomplete, type FieldDefinition } from './FieldAutocomplete';

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

  // Reduced motion preference
  private prefersReducedMotion: boolean = false;

  // Field autocomplete instance
  private fieldAutocomplete: FieldAutocomplete | null = null;

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
          animation: glyph-fade-in 0.4s ease-out;
        }

        .glyph-preview-area {
          flex: 1;
          overflow: auto;
          background: var(--glyph-bg);
          position: relative;
          min-height: 350px;
          /* CSS containment for performance */
          contain: content;
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
          background: linear-gradient(
            90deg,
            var(--glyph-bg) 0%,
            #f8fafc 50%,
            var(--glyph-bg) 100%
          );
          background-size: 200% 100%;
          animation: glyph-shimmer 2s ease-in-out infinite;
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
              <input type="text" class="glyph-command-input" placeholder="Type 'add' or '{{' for field suggestions..." aria-label="Type an edit command and press Enter" id="glyph-command-input" aria-autocomplete="list" aria-controls="glyph-autocomplete-dropdown" />
            </div>
            <button class="glyph-btn glyph-btn-secondary" id="glyph-download" aria-label="Download document as PDF" title="Download PDF">Download</button>
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
        onSelect: (_field: FieldDefinition, composedPrompt: string) => {
          // Set the composed prompt in the input (field available if needed for future enhancements)
          input.value = composedPrompt;
          input.focus();
          // Position cursor at end
          input.setSelectionRange(input.value.length, input.value.length);
        },
        accentColor: '#14B8A6',
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
          input.placeholder = "Type 'add' or '{{' for field suggestions...";
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
    this.setLoading(true);

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
        input.placeholder = "Type 'add' or '{{' for field suggestions...";
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

      // Celebrate first successful edit with confetti (one-time)
      this.celebrateFirstEdit();

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
      // Single click - select region and show quick actions
      region.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Clear previous selection
        regions.forEach(r => r.classList.remove('glyph-region-highlight'));

        // Highlight new selection
        region.classList.add('glyph-region-highlight');
        this.selectedRegion = region.getAttribute('data-glyph-region');
        this._isEditMode = false;
        this.hideFloatingToolbar();

        // Show region-specific quick actions
        if (this.selectedRegion) {
          this.showRegionActions(this.selectedRegion);
        }

        // Update placeholder and focus input
        const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
        if (input) {
          input.placeholder = `Edit the ${this.selectedRegion}...`;
        }

        this.emit('glyph:region-selected', { region: this.selectedRegion });
      });

      // Double-click - enter edit mode with floating toolbar
      region.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Clear previous selection
        regions.forEach(r => r.classList.remove('glyph-region-highlight'));

        // Highlight selection
        region.classList.add('glyph-region-highlight');
        this.selectedRegion = region.getAttribute('data-glyph-region');
        this._isEditMode = true;

        // Show floating toolbar
        this.showFloatingToolbar(region);

        // Show region-specific quick actions too
        if (this.selectedRegion) {
          this.showRegionActions(this.selectedRegion);
        }

        // Update placeholder
        const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
        if (input) {
          input.placeholder = `Edit the ${this.selectedRegion} (edit mode)...`;
        }

        this.emit('glyph:edit-mode', { region: this.selectedRegion });
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
    this._isEditMode = false;
    this.hideFloatingToolbar();
    this.hideRegionActions();

    const input = this.shadow.querySelector('.glyph-command-input') as HTMLInputElement;
    if (input) {
      input.placeholder = "Type 'add' or '{{' for field suggestions...";
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

    // Position toolbar above the region
    const previewRect = previewArea.getBoundingClientRect();
    const top = regionRect.top - previewRect.top - 50;
    const left = Math.max(10, regionRect.left - previewRect.left);

    toolbar.style.top = `${Math.max(10, top)}px`;
    toolbar.style.left = `${left}px`;

    previewArea.appendChild(toolbar);

    // Add event listeners to toolbar buttons
    toolbar.querySelectorAll('.glyph-toolbar-btn, .glyph-toolbar-color-picker').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        if (action) {
          this.applyToolbarAction(action, btn);
        }
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
}

// Auto-register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('glyph-editor')) {
  customElements.define('glyph-editor', GlyphEditor);
}
