/**
 * Glyph API - Shared Types
 */

export interface QuoteData {
  client: {
    name: string;
    email?: string;
    address?: string;
    company?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
  };
  meta?: {
    quoteNumber?: string;
    date?: string;
    validUntil?: string;
    notes?: string;
    terms?: string;
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
    companyAddress?: string;
  };
  styles?: {
    accentColor?: string;
  };
}

export interface PreviewRequest {
  data: QuoteData;
  templateId?: string;
}

export interface PreviewResponse {
  html: string;
  previewUrl?: string;
}

export interface ModifyRequest {
  html: string;
  instruction: string;
  context?: QuoteData;
}

export interface ModifyResponse {
  html: string;
  changes: string[];
}

export interface GenerateRequest {
  html: string;
  format: "pdf" | "png";
  options?: {
    width?: number;
    height?: number;
    scale?: number;
  };
}

export interface GenerateResponse {
  url: string;
  format: "pdf" | "png";
  size: number;
  expiresAt: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

// =============================================================================
// Webhook Types
// =============================================================================

export interface WebhookEmailConfig {
  emailTo: string;           // Static email or "{{fields.Client Email}}" for dynamic
  emailSubject?: string;     // Subject line with Mustache support
  emailBody?: string;        // HTML body with Mustache support
  emailFrom?: string;        // Custom from address (optional)
  emailReplyTo?: string;     // Reply-to address (optional)
}

export interface WebhookDelivery {
  type: 'url' | 'email' | 'storage';
  destination?: string;              // URL to POST (for type='url')
  // Email-specific options (for type='email')
  emailTo?: string;                  // Static email or "{{fields.Client Email}}"
  emailSubject?: string;             // Subject line with Mustache support
  emailBody?: string;                // HTML body with Mustache support
  emailFrom?: string;                // Custom from address
  emailReplyTo?: string;             // Reply-to address
}

export interface WebhookConfig {
  id: string;                          // webhook_xxx
  templateHtml: string;                // Saved template with Mustache placeholders
  airtable: {
    baseId: string;
    tableId: string;
    apiKey?: string;                   // Optional: stored encrypted for auto-fetch
  };
  filenameTemplate: string;            // e.g., "invoice-{{fields.Invoice Number}}.pdf"
  actions: ('created' | 'updated')[];  // Which actions trigger PDF generation
  delivery: WebhookDelivery;
  pdfOptions?: {
    format?: 'letter' | 'a4';
    landscape?: boolean;
    scale?: number;
  };
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

export interface WebhookCreateRequest {
  template: string;                    // HTML template with Mustache placeholders
  airtable: {
    baseId: string;
    tableId: string;
    apiKey?: string;                   // Optional: for auto-fetching full record
  };
  filenameTemplate?: string;           // Default: "document-{{record.id}}.pdf"
  actions?: ('created' | 'updated')[];
  delivery?: WebhookDelivery;
  pdfOptions?: {
    format?: 'letter' | 'a4';
    landscape?: boolean;
    scale?: number;
  };
}

export interface WebhookCreateResponse {
  id: string;
  webhookUrl: string;
  instructions: {
    summary: string;
    steps: string[];
    airtableScript: string;
  };
}

export interface AirtableWebhookPayload {
  base?: { id: string };
  table?: { id: string };
  record: {
    id: string;
    fields: Record<string, unknown>;
  };
  action?: 'created' | 'updated';
  timestamp?: string;
}

export interface WebhookResponse {
  success: boolean;
  pdfUrl?: string;
  filename?: string;
  error?: string;
  processingTimeMs?: number;
  // Email delivery info
  deliveryType?: 'url' | 'email' | 'storage';
  emailSentTo?: string;
  emailMessageId?: string;
}

// =============================================================================
// Saved Template Types
// =============================================================================

export interface SavedTemplate {
  id: string;
  apiKeyId: string;
  name: string;
  type: TemplateType | null;
  description: string | null;
  htmlTemplate: string;
  schema: TemplateSchema | null;
  style: TemplateStyle | null;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type TemplateType =
  | 'invoice'
  | 'quote'
  | 'report'
  | 'certificate'
  | 'letter'
  | 'receipt'
  | 'contract'
  | 'custom';

export type TemplateStyle =
  | 'stripe-clean'
  | 'professional'
  | 'minimal'
  | 'bold'
  | 'classic'
  | 'corporate'
  | 'modern'
  | 'vibrant';

export interface TemplateSchema {
  fields: TemplateField[];
  sampleData?: Record<string, unknown>;
}

export interface TemplateField {
  name: string;           // e.g., "customer.name", "items[].price"
  type: 'string' | 'number' | 'currency' | 'date' | 'array' | 'object' | 'boolean';
  required?: boolean;
  description?: string;
  format?: string;        // e.g., "YYYY-MM-DD" for dates
}

// API request/response types for saved templates
export interface SaveTemplateRequest {
  name: string;
  type?: TemplateType;
  description?: string;
  html: string;
  schema?: TemplateSchema;
  style?: TemplateStyle;
  isDefault?: boolean;
}

export interface UpdateTemplateRequest {
  name?: string;
  type?: TemplateType;
  description?: string;
  html?: string;
  schema?: TemplateSchema;
  style?: TemplateStyle;
  isDefault?: boolean;
}

export interface ListTemplatesResponse {
  success: true;
  templates: Omit<SavedTemplate, 'htmlTemplate'>[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetTemplateResponse {
  success: true;
  template: SavedTemplate;
}
