/**
 * Chat Component
 * AI chat interface for document editing assistance
 */

import type { ChatMessage, GlyphError } from '../lib/types';
import type { GlyphApiClient } from '../lib/api';

export interface ChatOptions {
  documentId: string | null;
  apiClient: GlyphApiClient | null;
}

export class GlyphChat extends HTMLElement {
  private shadow: ShadowRoot;
  private _documentId: string | null = null;
  private _apiClient: GlyphApiClient | null = null;
  private _messages: ChatMessage[] = [];
  private _isLoading = false;

  // Event callbacks
  public onMessage?: (message: ChatMessage) => void;
  public onError?: (error: GlyphError) => void;
  public onAction?: (action: { type: string; data: unknown }) => void;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Configure the chat with document ID and API client
   */
  public configure(documentId: string, apiClient: GlyphApiClient) {
    this._documentId = documentId;
    this._apiClient = apiClient;
  }

  /**
   * Add a message to the chat
   */
  public addMessage(message: ChatMessage) {
    this._messages.push(message);
    this.renderMessages();
    this.scrollToBottom();
  }

  /**
   * Clear chat history
   */
  public clearHistory() {
    this._messages = [];
    this.renderMessages();
  }

  /**
   * Get chat history
   */
  public getHistory(): ChatMessage[] {
    return [...this._messages];
  }

  /**
   * Send a message
   */
  public async sendMessage(content: string): Promise<void> {
    if (!content.trim() || this._isLoading) return;

    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    this.addMessage(userMessage);
    this.onMessage?.(userMessage);

    // Clear input
    const input = this.shadow.querySelector('.chat-input') as HTMLInputElement;
    if (input) input.value = '';

    // Send to API if configured
    if (this._apiClient && this._documentId) {
      this._isLoading = true;
      this.setLoading(true);

      try {
        const response = await this._apiClient.sendChatMessage(
          this._documentId,
          content,
          this._messages.slice(0, -1) // Don't include the message we just sent
        );

        if (response.success && response.data) {
          this.addMessage(response.data);
          this.onMessage?.(response.data);

          // Check for actions in the response
          this.parseAndDispatchActions(response.data.content);
        } else if (response.error) {
          this.onError?.(response.error);
          this.addSystemMessage(`Error: ${response.error.message}`);
        }
      } catch (err) {
        const error: GlyphError = {
          code: 'CHAT_ERROR',
          message: err instanceof Error ? err.message : 'Failed to send message'
        };
        this.onError?.(error);
        this.addSystemMessage(`Error: ${error.message}`);
      }

      this._isLoading = false;
      this.setLoading(false);
    } else {
      // No API configured, add mock response
      this.addSystemMessage('API not configured. Connect with an API key to enable AI assistance.');
    }
  }

  /**
   * Add a system message
   */
  private addSystemMessage(content: string) {
    const message: ChatMessage = {
      id: this.generateId(),
      role: 'system',
      content,
      timestamp: new Date()
    };
    this.addMessage(message);
  }

  /**
   * Parse AI response for action commands
   */
  private parseAndDispatchActions(content: string) {
    // Look for action patterns like [ACTION:fill_field:fieldName:value]
    const actionPattern = /\[ACTION:(\w+):([^\]]+)\]/g;
    let match;

    while ((match = actionPattern.exec(content)) !== null) {
      const [, actionType, actionData] = match;
      this.onAction?.({
        type: actionType,
        data: actionData.includes(':') ? actionData.split(':') : actionData
      });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean) {
    const indicator = this.shadow.querySelector('.loading-indicator');
    if (indicator) {
      indicator.classList.toggle('visible', loading);
    }
  }

  /**
   * Scroll chat to bottom
   */
  private scrollToBottom() {
    const messages = this.shadow.querySelector('.chat-messages');
    if (messages) {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  /**
   * Render messages
   */
  private renderMessages() {
    const container = this.shadow.querySelector('.chat-messages');
    if (!container) return;

    if (this._messages.length === 0) {
      container.innerHTML = `
        <div class="chat-empty">
          <p>Ask me to help with your document:</p>
          <ul>
            <li>Fill in form fields</li>
            <li>Generate content</li>
            <li>Format text</li>
            <li>Answer questions</li>
          </ul>
        </div>
      `;
      return;
    }

    container.innerHTML = this._messages.map(msg => `
      <div class="chat-message chat-message-${msg.role}">
        <div class="message-content">${this.escapeHtml(msg.content)}</div>
        <div class="message-time">${this.formatTime(msg.timestamp)}</div>
      </div>
    `).join('');
  }

  /**
   * Escape HTML in message content
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format timestamp
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners() {
    const input = this.shadow.querySelector('.chat-input') as HTMLInputElement;
    const sendBtn = this.shadow.querySelector('.send-btn');

    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage(input.value);
      }
    });

    sendBtn?.addEventListener('click', () => {
      if (input) this.sendMessage(input.value);
    });
  }

  /**
   * Render component
   */
  private render() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--glyph-bg, #fff);
          font-family: var(--glyph-font, system-ui, sans-serif);
        }

        .chat-header {
          padding: 16px;
          border-bottom: 1px solid var(--glyph-border, #e2e8f0);
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .chat-empty {
          color: var(--glyph-text-muted, #64748b);
          font-size: 14px;
        }

        .chat-empty ul {
          margin: 12px 0 0 0;
          padding-left: 20px;
        }

        .chat-empty li {
          margin: 4px 0;
        }

        .chat-message {
          margin-bottom: 16px;
          max-width: 85%;
        }

        .chat-message-user {
          margin-left: auto;
        }

        .chat-message-user .message-content {
          background: var(--glyph-primary, #2563eb);
          color: white;
          border-radius: 16px 16px 4px 16px;
        }

        .chat-message-assistant .message-content,
        .chat-message-system .message-content {
          background: var(--glyph-bg-secondary, #f8fafc);
          color: var(--glyph-text, #1e293b);
          border-radius: 16px 16px 16px 4px;
        }

        .chat-message-system .message-content {
          font-style: italic;
          opacity: 0.8;
        }

        .message-content {
          padding: 10px 14px;
          font-size: 14px;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .message-time {
          font-size: 11px;
          color: var(--glyph-text-muted, #64748b);
          margin-top: 4px;
          padding: 0 4px;
        }

        .chat-message-user .message-time {
          text-align: right;
        }

        .chat-input-container {
          padding: 16px;
          border-top: 1px solid var(--glyph-border, #e2e8f0);
          display: flex;
          gap: 8px;
        }

        .chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--glyph-border, #e2e8f0);
          border-radius: 20px;
          font-size: 14px;
          outline: none;
          background: var(--glyph-bg, #fff);
          color: var(--glyph-text, #1e293b);
        }

        .chat-input:focus {
          border-color: var(--glyph-primary, #2563eb);
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--glyph-primary, #2563eb);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }

        .send-btn:hover {
          background: var(--glyph-primary-hover, #1d4ed8);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-indicator {
          display: none;
          padding: 8px 16px;
          font-size: 12px;
          color: var(--glyph-text-muted, #64748b);
        }

        .loading-indicator.visible {
          display: block;
        }
      </style>

      <div class="chat-header">
        <span>AI Assistant</span>
      </div>

      <div class="chat-messages">
        <div class="chat-empty">
          <p>Ask me to help with your document:</p>
          <ul>
            <li>Fill in form fields</li>
            <li>Generate content</li>
            <li>Format text</li>
            <li>Answer questions</li>
          </ul>
        </div>
      </div>

      <div class="loading-indicator">AI is typing...</div>

      <div class="chat-input-container">
        <input type="text" class="chat-input" placeholder="Type a message..." />
        <button class="send-btn" title="Send">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    `;
  }
}

// Auto-register
if (typeof customElements !== 'undefined' && !customElements.get('glyph-chat')) {
  customElements.define('glyph-chat', GlyphChat);
}
