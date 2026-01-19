/**
 * Glyph SDK
 * Embeddable PDF editor with AI-powered document generation
 *
 * @packageDocumentation
 */

// Components
import { GlyphEditor } from './components/GlyphEditor';
import { GlyphPreview } from './components/Preview';
import { GlyphChat } from './components/Chat';
import { FieldAutocomplete, autocompleteStyles } from './components/FieldAutocomplete';
import type { FieldDefinition, FieldAutocompleteOptions } from './components/FieldAutocomplete';

// API Client
import { GlyphApiClient, GlyphAPI, createApiClient } from './lib/api';
import type { ApiClientConfig } from './lib/api';

// Types
import type {
  GlyphTheme,
  GlyphThemePreset,
  GlyphEditorProps,
  GlyphTemplate,
  TemplateSchema,
  TemplateField,
  FieldValidation,
  TemplateLayout,
  PageLayout,
  LayoutElement,
  GlyphDocument,
  GlyphError,
  ApiResponse,
  ChatMessage,
  GeneratePdfOptions,
  QuoteData,
  QuoteLineItem
} from './lib/types';

// Version
const VERSION = '0.5.0';

// Export components
export {
  GlyphEditor,
  GlyphPreview,
  GlyphChat,
  FieldAutocomplete,
  autocompleteStyles,
  GlyphApiClient,
  GlyphAPI,
  createApiClient,
  VERSION
};

// Export types
export type {
  ApiClientConfig,
  GlyphTheme,
  GlyphThemePreset,
  GlyphEditorProps,
  GlyphTemplate,
  TemplateSchema,
  TemplateField,
  FieldValidation,
  TemplateLayout,
  PageLayout,
  LayoutElement,
  GlyphDocument,
  GlyphError,
  ApiResponse,
  ChatMessage,
  GeneratePdfOptions,
  QuoteData,
  QuoteLineItem,
  FieldDefinition,
  FieldAutocompleteOptions
};

// Expose on window for IIFE/CDN usage
if (typeof window !== 'undefined') {
  const glyphGlobal = {
    VERSION,
    GlyphEditor,
    GlyphPreview,
    GlyphChat,
    FieldAutocomplete,
    GlyphAPI,
    createApiClient
  };

  (window as Window & { Glyph?: typeof glyphGlobal }).Glyph = glyphGlobal;
}
