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
     Field Autocomplete Styles - World-class UI
     ============================================ */
  .glyph-autocomplete-dropdown {
    position: absolute;
    background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 12px 40px -8px rgba(0, 0, 0, 0.15),
                0 4px 12px -4px rgba(0, 0, 0, 0.1);
    max-height: 380px;
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

  .glyph-autocomplete-item:last-child {
    border-bottom: none;
    border-radius: 0 0 12px 12px;
  }

  .glyph-autocomplete-item:hover,
  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.04) 100%);
  }

  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.12) 0%, rgba(20, 184, 166, 0.06) 100%);
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
    width: 24px;
    height: 24px;
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
`;
