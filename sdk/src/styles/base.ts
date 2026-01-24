/**
 * Glyph SDK Base Styles
 * Embedded CSS for Shadow DOM isolation
 */

export const baseStyles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .hidden {
    display: none !important;
  }

  /* ============================================
     Field Autocomplete Styles - Magical UI
     ============================================ */
  .glyph-autocomplete-dropdown {
    position: absolute;
    background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 12px 40px -8px rgba(0, 0, 0, 0.15),
                0 4px 12px -4px rgba(0, 0, 0, 0.1);
    max-height: 420px;
    overflow-y: auto;
    overflow-x: hidden;
    animation: glyph-autocomplete-appear 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    scrollbar-width: thin;
    scrollbar-color: #d1d5db transparent;
  }

  .glyph-autocomplete-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .glyph-autocomplete-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .glyph-autocomplete-dropdown::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  @keyframes glyph-autocomplete-appear {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .glyph-autocomplete-category {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  /* Category color variants */
  .glyph-autocomplete-category--recent .glyph-autocomplete-category-icon {
    color: #8b5cf6;
  }

  .glyph-autocomplete-category--suggestions .glyph-autocomplete-category-icon {
    color: #f59e0b;
  }

  .glyph-autocomplete-category--quick .glyph-autocomplete-category-icon {
    color: #14B8A6;
  }

  .glyph-autocomplete-category--fields .glyph-autocomplete-category-icon {
    color: #3b82f6;
  }

  .glyph-autocomplete-category-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #14B8A6;
    opacity: 0.9;
  }

  .glyph-autocomplete-category-text {
    flex: 1;
  }

  .glyph-autocomplete-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    transition: background-color 0.1s ease, transform 0.1s ease;
    border-bottom: 1px solid #f3f4f6;
  }

  .glyph-autocomplete-item:last-of-type {
    border-bottom: none;
  }

  .glyph-autocomplete-item:hover,
  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.04) 100%);
  }

  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.12) 0%, rgba(20, 184, 166, 0.06) 100%);
  }

  /* Type-specific styling */
  .glyph-autocomplete-item--recent .glyph-autocomplete-item-icon {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }

  .glyph-autocomplete-item--recent.selected .glyph-autocomplete-item-icon {
    background: #8b5cf6;
    color: white;
  }

  .glyph-autocomplete-item--suggestion .glyph-autocomplete-item-icon {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .glyph-autocomplete-item--suggestion.selected .glyph-autocomplete-item-icon {
    background: #f59e0b;
    color: white;
  }

  .glyph-autocomplete-item--action .glyph-autocomplete-item-icon {
    background: rgba(20, 184, 166, 0.1);
    color: #14B8A6;
  }

  .glyph-autocomplete-item--action.selected .glyph-autocomplete-item-icon {
    background: #14B8A6;
    color: white;
  }

  .glyph-autocomplete-item--field .glyph-autocomplete-item-icon {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .glyph-autocomplete-item--field.selected .glyph-autocomplete-item-icon {
    background: #3b82f6;
    color: white;
  }

  .glyph-autocomplete-item-main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .glyph-autocomplete-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(20, 184, 166, 0.1);
    border-radius: 6px;
    color: #14B8A6;
    flex-shrink: 0;
  }

  .glyph-autocomplete-item.selected .glyph-autocomplete-item-icon {
    background: #14B8A6;
    color: white;
  }

  .glyph-autocomplete-item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .glyph-autocomplete-item-name {
    font-size: 13px;
    font-weight: 500;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glyph-autocomplete-item-description {
    font-size: 11px;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glyph-autocomplete-item--field .glyph-autocomplete-item-description {
    font-family: ui-monospace, 'SF Mono', 'Fira Code', monospace;
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    display: inline-block;
    max-width: fit-content;
  }

  /* Legacy path style for backwards compatibility */
  .glyph-autocomplete-item-path {
    font-size: 11px;
    font-family: ui-monospace, 'SF Mono', 'Fira Code', monospace;
    color: #14B8A6;
    background: rgba(20, 184, 166, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    max-width: fit-content;
  }

  .glyph-autocomplete-item.selected .glyph-autocomplete-item-path {
    background: rgba(20, 184, 166, 0.15);
  }

  .glyph-autocomplete-item-example {
    font-size: 12px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    text-align: right;
    flex-shrink: 0;
    font-style: italic;
  }

  /* Keyboard navigation hint */
  .glyph-autocomplete-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px 14px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    font-size: 11px;
    color: #9ca3af;
    border-radius: 0 0 12px 12px;
  }

  .glyph-autocomplete-hint kbd {
    background: #e5e7eb;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 500;
  }

  /* Command input wrapper for relative positioning */
  .glyph-command-wrapper {
    position: relative;
    flex: 1;
  }

  /* Dark theme support */
  @media (prefers-color-scheme: dark) {
    .glyph-autocomplete-dropdown {
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
      border-color: #374151;
    }

    .glyph-autocomplete-category {
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
      border-color: #374151;
      color: #9ca3af;
    }

    .glyph-autocomplete-item {
      border-color: #1f2937;
    }

    .glyph-autocomplete-item:hover,
    .glyph-autocomplete-item.selected {
      background: linear-gradient(90deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.08) 100%);
    }

    .glyph-autocomplete-item-name {
      color: #f3f4f6;
    }

    .glyph-autocomplete-item-description {
      color: #9ca3af;
    }

    .glyph-autocomplete-item--field .glyph-autocomplete-item-description {
      background: rgba(59, 130, 246, 0.2);
    }

    .glyph-autocomplete-item-path {
      background: rgba(20, 184, 166, 0.2);
    }

    .glyph-autocomplete-item-example {
      color: #6b7280;
    }

    .glyph-autocomplete-hint {
      background: #111827;
      border-color: #374151;
    }

    .glyph-autocomplete-hint kbd {
      background: #374151;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .glyph-autocomplete-dropdown {
      animation: none;
    }
  }

  /* ============================================
     Streaming Preview Styles
     ============================================ */

  /* Streaming preview state - slightly transparent to indicate building */
  .glyph-preview-frame.glyph-streaming-frame {
    opacity: 0.8;
    filter: blur(0.3px);
    transition: opacity 0.3s ease, filter 0.3s ease;
  }

  /* Pulse animation for progress bar during streaming */
  .glyph-ai-progress-bar-fill.streaming {
    animation: glyph-stream-pulse 1s ease-in-out infinite;
  }

  @keyframes glyph-stream-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  /* Building indicator for streaming state */
  .glyph-streaming-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(20, 184, 166, 0.9);
    color: white;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 10;
    animation: glyph-streaming-fade-in 0.2s ease;
  }

  @keyframes glyph-streaming-fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .glyph-streaming-indicator::before {
    content: '';
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    animation: glyph-streaming-dot 1s ease-in-out infinite;
  }

  @keyframes glyph-streaming-dot {
    0%, 100% { opacity: 0.5; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }

  /* When streaming is complete, fade out */
  .glyph-streaming-indicator.complete {
    animation: glyph-streaming-fade-out 0.3s ease forwards;
  }

  @keyframes glyph-streaming-fade-out {
    to {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
`;
