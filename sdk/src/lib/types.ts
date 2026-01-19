/**
 * Glyph SDK Type Definitions
 */

/** Theme options for the editor */
export type GlyphTheme = 'light' | 'dark' | 'auto';

/** Editor configuration props */
export interface GlyphEditorProps {
  /** API key for Glyph services */
  apiKey: string;
  /** Template ID or inline template definition */
  template?: string | GlyphTemplate;
  /** Data to populate the template */
  data?: Record<string, unknown>;
  /** Theme preference */
  theme?: GlyphTheme;
  /** Callback when document is saved */
  onSave?: (document: GlyphDocument) => void;
  /** Callback when PDF is generated */
  onGenerate?: (pdf: Blob) => void;
  /** Callback on errors */
  onError?: (error: GlyphError) => void;
}

/** Template definition */
export interface GlyphTemplate {
  id: string;
  name: string;
  version: string;
  schema: TemplateSchema;
  layout: TemplateLayout;
}

/** Template schema for data binding */
export interface TemplateSchema {
  fields: TemplateField[];
}

/** Individual field in template schema */
export interface TemplateField {
  name: string;
  type: 'text' | 'number' | 'date' | 'image' | 'signature' | 'table';
  required?: boolean;
  default?: unknown;
  validation?: FieldValidation;
}

/** Field validation rules */
export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

/** Template layout definition */
export interface TemplateLayout {
  pages: PageLayout[];
  styles?: Record<string, string>;
}

/** Page layout within a template */
export interface PageLayout {
  size: 'letter' | 'a4' | 'legal' | { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  elements: LayoutElement[];
}

/** Layout element on a page */
export interface LayoutElement {
  type: 'text' | 'image' | 'shape' | 'field';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

/** Generated document representation */
export interface GlyphDocument {
  id: string;
  templateId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Error object returned by SDK */
export interface GlyphError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: GlyphError;
}

/** Chat message for AI interface */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/** PDF generation options */
export interface GeneratePdfOptions {
  quality?: 'draft' | 'standard' | 'high';
  includeMetadata?: boolean;
  password?: string;
}
