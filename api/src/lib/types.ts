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
