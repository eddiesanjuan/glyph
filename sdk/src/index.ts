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

// API Client
import { GlyphApiClient, createApiClient } from './lib/api';
import type { ApiClientConfig } from './lib/api';

// Types
import type {
  GlyphTheme,
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
  GeneratePdfOptions
} from './lib/types';

// Version
const VERSION = '0.1.0';

// Export components
export {
  GlyphEditor,
  GlyphPreview,
  GlyphChat,
  GlyphApiClient,
  createApiClient,
  VERSION
};

// Export types
export type {
  ApiClientConfig,
  GlyphTheme,
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
  GeneratePdfOptions
};

// Expose on window for IIFE/CDN usage
if (typeof window !== 'undefined') {
  const glyphGlobal = {
    VERSION,
    GlyphEditor,
    GlyphPreview,
    GlyphChat,
    createApiClient
  };

  (window as Window & { Glyph?: typeof glyphGlobal }).Glyph = glyphGlobal;
}
