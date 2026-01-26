/**
 * Glyph SDK Type Definitions
 */

/** Theme preset options for the editor */
export type GlyphThemePreset = 'light' | 'dark' | 'auto';

/** Theme customization object */
export interface GlyphTheme {
  primaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
}

/** Quote line item */
export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

/** Quote data structure for templates */
export interface QuoteData {
  companyName?: string;
  companyLogo?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  quoteNumber?: string;
  quoteDate?: string;
  validUntil?: string;
  customerName?: string;
  customerAddress?: string;
  customerEmail?: string;
  customerPhone?: string;
  lineItems?: QuoteLineItem[];
  subtotal?: number;
  taxRate?: number;
  tax?: number;
  total?: number;
  notes?: string;
  terms?: string;
  [key: string]: unknown;
}

/** Editor configuration props */
export interface GlyphEditorProps {
  /** API key for Glyph services */
  apiKey: string;
  /** Template ID or inline template definition */
  template?: string | GlyphTemplate;
  /** Data to populate the template */
  data?: Record<string, unknown> | QuoteData;
  /** Theme preference (preset or custom object) */
  theme?: GlyphThemePreset | GlyphTheme;
  /** API URL override */
  apiUrl?: string;
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

// ============================================
// Template-Data System Types
// ============================================

/** Supported data source types */
export type DataSourceType = 'airtable' | 'rest_api' | 'webhook' | 'graphql' | 'database' | 'file' | 'manual';

/** Data source status */
export type DataSourceStatus = 'active' | 'pending' | 'failed' | 'disabled';

/** Validation status for template-source mappings */
export type ValidationStatus = 'valid' | 'stale' | 'broken' | 'pending';

/** Discovered field from a data source */
export interface DiscoveredField {
  name: string;
  type: string;
  nullable: boolean;
  sample_value?: unknown;
}

/** Schema discovered from a data source */
export interface DiscoveredSchema {
  fields: DiscoveredField[];
  discovered_at: string;
  record_count?: number;
}

/** Data source configuration */
export interface DataSource {
  id: string;
  name: string;
  description?: string;
  source_type: DataSourceType;
  status: DataSourceStatus;
  config?: Record<string, unknown>;
  discovered_schema?: DiscoveredSchema;
  last_synced_at?: string;
  sync_error?: string;
  created_at: string;
  updated_at: string;
}

/** Request to create a new data source */
export interface CreateSourceRequest {
  name: string;
  description?: string;
  source_type: DataSourceType;
  config: Record<string, unknown>;
}

/** Request to update an existing data source */
export interface UpdateSourceRequest {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  status?: DataSourceStatus;
}

/** Record from a data source */
export interface SourceRecord {
  id: string;
  fields: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/** Field mappings from template fields to source fields */
export interface FieldMappings {
  [templateField: string]: string;
}

/** Single transformation rule */
export interface Transformation {
  type: 'format' | 'concatenate' | 'calculate' | 'lookup' | 'conditional' | 'custom';
  config: Record<string, unknown>;
}

/** Transformations for fields */
export interface Transformations {
  [templateField: string]: Transformation;
}

/** Template-source mapping configuration */
export interface TemplateSourceMapping {
  id: string;
  template_id: string;
  source_id: string;
  field_mappings: FieldMappings;
  transformations?: Transformations;
  is_default: boolean;
  validation_status: ValidationStatus;
  validation_errors?: string[];
  created_at: string;
  updated_at: string;
}

/** Linked source information for a template */
export interface LinkedSource {
  source: DataSource;
  mapping: TemplateSourceMapping;
}

/** Options for linking a source to a template */
export interface LinkSourceOptions {
  isDefault?: boolean;
  transformations?: Transformations;
}

/** Options for updating a template-source mapping */
export interface UpdateMappingOptions {
  mappings?: FieldMappings;
  transformations?: Transformations;
  isDefault?: boolean;
}

/** Result of PDF generation */
export interface GenerateResult {
  url?: string;
  blob?: Blob;
  format: 'pdf' | 'png' | 'html';
  metadata?: {
    pages?: number;
    size_bytes?: number;
    generated_at: string;
  };
}

/** Options for generating from a source */
export interface GenerateFromSourceOptions {
  templateId: string;
  sourceId?: string;
  recordId?: string;
  filter?: {
    formula?: string;
    limit?: number;
  };
  format?: 'pdf' | 'png' | 'html';
}

/** Options for batch generation */
export interface BatchGenerateOptions {
  templateId: string;
  sourceId?: string;
  filter?: {
    formula?: string;
    limit?: number;
    offset?: number;
  };
  format?: 'pdf' | 'png' | 'html';
  outputFormat?: 'zip' | 'individual';
}

/** Status of a batch generation job */
export interface BatchStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errors?: Array<{ recordId: string; error: string }>;
  downloadUrl?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

/** AI-suggested field mapping */
export interface MappingSuggestion {
  templateField: string;
  sourceField: string;
  confidence: number;
  reasoning: string;
  alternativeFields?: Array<{
    field: string;
    confidence: number;
  }>;
}

/** Inferred schema from sample data */
export interface InferredSchema {
  fields: Array<{
    name: string;
    type: string;
    format?: string;
    nullable: boolean;
    description?: string;
  }>;
  documentType?: string;
  confidence: number;
  suggestions?: string[];
}

/** Template match result from AI */
export interface TemplateMatch {
  templateId: string;
  templateName: string;
  score: number;
  matchedFields: number;
  totalFields: number;
  reasoning: string;
  suggestedMappings?: MappingSuggestion[];
}

/** Options for listing data sources */
export interface ListSourcesOptions {
  type?: DataSourceType;
  status?: DataSourceStatus;
  limit?: number;
  offset?: number;
}

/** Options for getting records from a source */
export interface GetRecordsOptions {
  limit?: number;
  offset?: number;
  filter?: string;
  sort?: string;
  fields?: string[];
}

/** Test connection result */
export interface TestConnectionResult {
  success: boolean;
  error?: string;
  latency_ms?: number;
  record_count?: number;
}

/** Sync result */
export interface SyncResult {
  status: 'success' | 'partial' | 'failed';
  records_synced?: number;
  drift?: {
    fields_added: string[];
    fields_removed: string[];
    fields_changed: Array<{
      name: string;
      old_type: string;
      new_type: string;
    }>;
  };
  error?: string;
}
