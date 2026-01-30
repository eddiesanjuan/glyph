/**
 * Brand-to-Template Routes
 *
 * POST /v1/templates/from-brand - Generate a branded template from PDF, image, or URL
 *
 * This endpoint extracts brand attributes (colors, fonts, style) from visual content
 * and generates a matching template that can be used with /v1/create.
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  extractBrandFromPDF,
  extractBrandFromImage,
  extractBrandFromURL,
  type BrandAttributes,
} from "../services/brandExtraction.js";
import {
  generateBrandedTemplate,
  isValidTemplateType,
} from "../services/templateGenerator.js";
import { createCustomTemplate } from "../lib/customTemplates.js";
import Mustache from "mustache";
import type { ApiError } from "../lib/types.js";
import { logger } from "../services/logger.js";

const brandTemplates = new Hono();

// =============================================================================
// Request Schema
// =============================================================================

const fromBrandSchema = z
  .object({
    pdf: z.string().optional(),
    image: z.string().optional(),
    url: z.string().url().optional(),
    templateType: z.enum(["invoice", "quote", "receipt", "letter", "report"]),
    name: z.string().max(255).optional(),
    pageSize: z.enum(["letter", "a4"]).optional(),
  })
  .refine((data) => data.pdf || data.image || data.url, {
    message: "Must provide one of: pdf, image, or url",
  })
  .refine((data) => [data.pdf, data.image, data.url].filter(Boolean).length === 1, {
    message: "Provide only ONE of: pdf, image, or url",
  });

// Type for valid template types
type TemplateType = "invoice" | "quote" | "receipt" | "letter" | "report";

// =============================================================================
// Sample Data for Preview Rendering
// =============================================================================

const SAMPLE_DATA: Record<TemplateType, object> = {
  invoice: {
    invoice: {
      number: "INV-001",
      date: "Jan 15, 2024",
      dueDate: "Feb 15, 2024",
    },
    billTo: {
      name: "John Smith",
      company: "Acme Corp",
      address: "123 Business Ave\nSuite 100\nSan Francisco, CA 94105",
    },
    lineItems: [
      {
        description: "Professional Services",
        quantity: 10,
        rate: "150.00",
        amount: "1,500.00",
      },
      {
        description: "Implementation Support",
        quantity: 5,
        rate: "200.00",
        amount: "1,000.00",
      },
    ],
    totals: {
      subtotal: "2,500.00",
      tax: "212.50",
      total: "2,712.50",
    },
    branding: {
      companyName: "Your Company",
      companyAddress: "456 Main Street\nNew York, NY 10001",
    },
    payment: {
      terms: "Net 30",
      methods: "Bank Transfer, Credit Card",
    },
  },
  quote: {
    meta: {
      quoteNumber: "Q-2024-001",
      date: "January 15, 2024",
      validUntil: "February 15, 2024",
    },
    client: {
      name: "Sarah Chen",
      company: "Horizon Ventures",
      email: "sarah@horizon.co",
    },
    lineItems: [
      {
        description: "Website Design & Development",
        quantity: 1,
        unitPrice: "5,000.00",
        total: "5,000.00",
      },
      {
        description: "SEO Optimization Package",
        quantity: 1,
        unitPrice: "1,500.00",
        total: "1,500.00",
      },
    ],
    totals: {
      subtotal: "6,500.00",
      total: "6,500.00",
    },
    branding: {
      companyName: "Your Company",
    },
  },
  receipt: {
    merchant: {
      name: "Your Business",
      address: "123 Store Street",
      phone: "(555) 123-4567",
    },
    receipt: {
      number: "R-8847",
      date: "Jan 20, 2024",
      time: "2:45 PM",
    },
    items: [
      { name: "Product A", quantity: 2, price: "29.99" },
      { name: "Product B", quantity: 1, price: "49.99" },
    ],
    totals: {
      subtotal: "109.97",
      tax: "9.35",
      total: "119.32",
    },
    payment: {
      method: "Visa ending in 4242",
    },
  },
  letter: {
    letter: {
      date: "January 15, 2024",
      senderName: "Your Name",
      senderTitle: "Your Title",
      senderCompany: "Your Company",
      senderAddress: "123 Business Street\nNew York, NY 10001",
      recipientName: "Jane Doe",
      recipientTitle: "Director",
      recipientCompany: "Partner Corp",
      recipientAddress: "456 Corporate Ave\nSan Francisco, CA 94105",
      subject: "Partnership Opportunity",
      salutation: "Dear Ms. Doe,",
      body: [
        "I am writing to express our interest in exploring a potential partnership between our organizations.",
        "We believe there are significant opportunities for collaboration that would benefit both parties.",
        "I would welcome the opportunity to discuss this further at your convenience.",
      ],
      closing: "Best regards,",
    },
  },
  report: {
    report: {
      title: "Quarterly Report",
      subtitle: "Q4 2024 Performance Summary",
      author: "Your Name",
      date: "January 15, 2024",
      organization: "Your Company",
    },
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Detect image media type from base64 data
 */
function detectImageMediaType(base64: string): string {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/png"; // fallback
}

/**
 * Validate base64 string
 */
function isValidBase64(str: string): boolean {
  // Remove potential data URL prefix
  const base64Data = str.replace(/^data:[^;]+;base64,/, "");
  try {
    // Check if it's valid base64
    const decoded = Buffer.from(base64Data, "base64");
    return decoded.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract raw base64 data from potentially data URL formatted string
 */
function extractBase64Data(input: string): string {
  // Handle data URL format: data:application/pdf;base64,XXXX
  if (input.startsWith("data:")) {
    const commaIndex = input.indexOf(",");
    if (commaIndex !== -1) {
      return input.slice(commaIndex + 1);
    }
  }
  return input;
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * POST /from-brand
 * Generate a branded template from PDF, image, or URL
 */
brandTemplates.post("/from-brand", async (c) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Parse and validate request body
    const body = await c.req.json();
    const parsed = fromBrandSchema.safeParse(body);

    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { pdf, image, url, templateType, name, pageSize } = parsed.data;

    // Validate template type (redundant but provides type safety)
    if (!isValidTemplateType(templateType)) {
      const error: ApiError = {
        error: `Invalid template type: ${templateType}. Valid types: invoice, quote, receipt, letter, report`,
        code: "INVALID_TEMPLATE_TYPE",
      };
      return c.json(error, 400);
    }

    logger.info("[BrandTemplates] Processing brand extraction request", {
      requestId,
      inputType: pdf ? "pdf" : image ? "image" : "url",
      templateType,
      pageSize: pageSize || "letter",
    });

    // Extract brand attributes based on input type
    let brand: BrandAttributes;

    if (pdf) {
      // Validate and decode PDF base64
      const pdfBase64 = extractBase64Data(pdf);
      if (!isValidBase64(pdfBase64)) {
        const error: ApiError = {
          error: "Invalid PDF base64 encoding",
          code: "INVALID_BASE64",
        };
        return c.json(error, 400);
      }

      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      brand = await extractBrandFromPDF(pdfBuffer);
    } else if (image) {
      // Validate and decode image base64
      const imageBase64 = extractBase64Data(image);
      if (!isValidBase64(imageBase64)) {
        const error: ApiError = {
          error: "Invalid image base64 encoding",
          code: "INVALID_BASE64",
        };
        return c.json(error, 400);
      }

      const mediaType = detectImageMediaType(imageBase64);
      const imageBuffer = Buffer.from(imageBase64, "base64");
      brand = await extractBrandFromImage(imageBuffer, mediaType);
    } else if (url) {
      brand = await extractBrandFromURL(url);
    } else {
      // This shouldn't happen due to zod validation, but just in case
      const error: ApiError = {
        error: "No input provided",
        code: "MISSING_INPUT",
      };
      return c.json(error, 400);
    }

    logger.info("[BrandTemplates] Brand extraction complete", {
      requestId,
      confidence: brand.confidence,
      primaryColor: brand.colors.primary,
      layoutStyle: brand.layout.style,
      companyName: brand.companyName,
    });

    // Generate branded template
    const generatedTemplate = await generateBrandedTemplate(
      brand,
      templateType as "invoice" | "quote" | "receipt" | "letter" | "report",
      {
        pageSize: pageSize || "letter",
        includeLogoPlaceholder: brand.layout.hasLogo,
      }
    );

    // Get sample data for the template type
    const sampleData = SAMPLE_DATA[templateType as TemplateType] || {};

    // Render preview with sample data
    let preview: string;
    try {
      preview = Mustache.render(generatedTemplate.html, sampleData);
    } catch (renderErr) {
      logger.warn("[BrandTemplates] Failed to render preview, using raw HTML", {
        requestId,
        error: renderErr instanceof Error ? renderErr.message : String(renderErr),
      });
      preview = generatedTemplate.html;
    }

    // Store as custom template
    const templateName = name || `Brand Template - ${templateType}`;
    const apiKeyId = (c.get as (key: string) => string | undefined)("apiKeyId");

    const customTemplate = createCustomTemplate(
      templateName,
      generatedTemplate.html,
      generatedTemplate.schema as Record<string, unknown>,
      {
        description: `Auto-generated ${templateType} template from brand extraction. Primary color: ${brand.colors.primary}`,
        createdBy: apiKeyId,
      }
    );

    const durationMs = Date.now() - startTime;

    logger.info("[BrandTemplates] Template created successfully", {
      requestId,
      templateId: customTemplate.id,
      templateType,
      durationMs,
    });

    return c.json(
      {
        success: true,
        templateId: customTemplate.id,
        brand,
        preview,
        usage: {
          createEndpoint: "/v1/create",
          example: {
            templateId: customTemplate.id,
            data: sampleData,
          },
        },
      },
      201
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;

    logger.error("[BrandTemplates] Failed to generate branded template", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      durationMs,
    });

    const error: ApiError = {
      error:
        err instanceof Error ? err.message : "Failed to generate branded template",
      code: "BRAND_TEMPLATE_ERROR",
    };
    return c.json(error, 500);
  }
});

export default brandTemplates;
