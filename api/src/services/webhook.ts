/**
 * Webhook Service
 * Handles webhook configuration storage and PDF generation triggering
 */

import Mustache from "mustache";
import { generatePDF, type PDFOptions } from "./pdf.js";
import type {
  WebhookConfig,
  WebhookCreateRequest,
  AirtableWebhookPayload,
  WebhookResponse,
} from "../lib/types.js";

// =============================================================================
// In-Memory Storage (MVP - Replace with Supabase for production)
// =============================================================================

const webhookStore = new Map<string, WebhookConfig>();

// Temporary PDF storage (24 hour expiry)
const pdfStore = new Map<string, { buffer: Buffer; expiresAt: Date; filename: string }>();

// Clean up expired PDFs periodically
setInterval(() => {
  const now = new Date();
  for (const [id, pdf] of pdfStore.entries()) {
    if (pdf.expiresAt < now) {
      pdfStore.delete(id);
    }
  }
}, 60 * 60 * 1000); // Check every hour

// =============================================================================
// ID Generation
// =============================================================================

function generateWebhookId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "webhook_";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generatePdfId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "pdf_";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================================================
// Webhook Management
// =============================================================================

/**
 * Create a new webhook configuration
 */
export function createWebhook(request: WebhookCreateRequest): WebhookConfig {
  const id = generateWebhookId();

  const config: WebhookConfig = {
    id,
    templateHtml: request.template,
    airtable: {
      baseId: request.airtable.baseId,
      tableId: request.airtable.tableId,
      apiKey: request.airtable.apiKey,
    },
    filenameTemplate: request.filenameTemplate || "document-{{record.id}}.pdf",
    actions: request.actions || ["created", "updated"],
    delivery: request.delivery || { type: "url" },
    pdfOptions: request.pdfOptions,
    createdAt: new Date(),
    triggerCount: 0,
  };

  webhookStore.set(id, config);
  return config;
}

/**
 * Get a webhook by ID
 */
export function getWebhook(id: string): WebhookConfig | undefined {
  return webhookStore.get(id);
}

/**
 * List all webhooks (for dashboard)
 */
export function listWebhooks(): WebhookConfig[] {
  return Array.from(webhookStore.values());
}

/**
 * Delete a webhook
 */
export function deleteWebhook(id: string): boolean {
  return webhookStore.delete(id);
}

/**
 * Update webhook trigger stats
 */
function updateWebhookStats(id: string): void {
  const webhook = webhookStore.get(id);
  if (webhook) {
    webhook.lastTriggeredAt = new Date();
    webhook.triggerCount++;
    webhookStore.set(id, webhook);
  }
}

// =============================================================================
// PDF Storage
// =============================================================================

/**
 * Store a generated PDF temporarily
 */
export function storePdf(
  buffer: Buffer,
  filename: string,
  expiresInHours: number = 24
): string {
  const id = generatePdfId();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  pdfStore.set(id, { buffer, expiresAt, filename });
  return id;
}

/**
 * Get a stored PDF
 */
export function getPdf(id: string): { buffer: Buffer; filename: string } | undefined {
  const pdf = pdfStore.get(id);
  if (!pdf) return undefined;

  // Check if expired
  if (pdf.expiresAt < new Date()) {
    pdfStore.delete(id);
    return undefined;
  }

  return { buffer: pdf.buffer, filename: pdf.filename };
}

// =============================================================================
// Webhook Processing
// =============================================================================

/**
 * Process an incoming webhook from Airtable
 * This is the core function that generates PDFs
 */
export async function processWebhook(
  webhookId: string,
  payload: AirtableWebhookPayload,
  baseUrl: string
): Promise<WebhookResponse> {
  const startTime = Date.now();

  // Get webhook config
  const config = getWebhook(webhookId);
  if (!config) {
    return {
      success: false,
      error: "Webhook not found",
    };
  }

  // Validate action type
  const action = payload.action || "updated";
  if (!config.actions.includes(action)) {
    return {
      success: false,
      error: `Action '${action}' not enabled for this webhook`,
    };
  }

  try {
    // Prepare data for template rendering
    // The payload should already have the record data from Airtable
    const templateData = {
      record: payload.record,
      fields: payload.record.fields,
      base: payload.base,
      table: payload.table,
      action,
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    // Render template with Mustache
    let renderedHtml: string;
    try {
      renderedHtml = Mustache.render(config.templateHtml, templateData);
    } catch (err) {
      return {
        success: false,
        error: `Template rendering failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }

    // Generate PDF
    const pdfOptions: PDFOptions = {
      format: config.pdfOptions?.format || "letter",
      landscape: config.pdfOptions?.landscape || false,
      scale: config.pdfOptions?.scale || 1,
    };

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePDF(renderedHtml, pdfOptions);
    } catch (err) {
      return {
        success: false,
        error: `PDF generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }

    // Generate filename from template
    let filename: string;
    try {
      filename = Mustache.render(config.filenameTemplate, templateData);
      // Ensure .pdf extension
      if (!filename.endsWith(".pdf")) {
        filename += ".pdf";
      }
      // Sanitize filename
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    } catch {
      filename = `document-${payload.record.id}.pdf`;
    }

    // Update webhook stats
    updateWebhookStats(webhookId);

    // Handle delivery based on type
    let pdfUrl: string;

    if (config.delivery.type === "url" && config.delivery.destination) {
      // POST PDF to destination URL
      try {
        const formData = new FormData();
        formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), filename);
        formData.append("recordId", payload.record.id);
        formData.append("webhookId", webhookId);

        const response = await fetch(config.delivery.destination, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          console.warn(`Delivery to ${config.delivery.destination} failed: ${response.status}`);
        }
      } catch (err) {
        console.warn(`Delivery failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }

      // Still store locally and return URL
      const pdfId = storePdf(pdfBuffer, filename);
      pdfUrl = `${baseUrl}/v1/webhooks/pdfs/${pdfId}`;
    } else {
      // Default: store and return URL
      const pdfId = storePdf(pdfBuffer, filename);
      pdfUrl = `${baseUrl}/v1/webhooks/pdfs/${pdfId}`;
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      pdfUrl,
      filename,
      processingTimeMs,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Airtable Script Generator
// =============================================================================

/**
 * Generate the Airtable automation script for a webhook
 */
export function generateAirtableScript(webhookUrl: string, includeAllFields: boolean = true): string {
  const script = `// Glyph PDF Automation Script
// Paste this into your Airtable Automation "Run script" action
// Trigger: When record is created or updated

// Configuration
const config = {
  webhookUrl: '${webhookUrl}'
};

// Get the triggering record
const record = input.record();

// Build the payload with all fields
const payload = {
  base: { id: base.id },
  table: { id: table.id },
  record: {
    id: record.id,
    fields: {}
  },
  action: 'created', // Change to 'updated' if using update trigger
  timestamp: new Date().toISOString()
};

// Get all field values
${includeAllFields ? `// Add all fields from the record
for (const field of table.fields) {
  try {
    const value = record.getCellValue(field);
    // Handle different field types
    if (value !== null && value !== undefined) {
      // For attachments, get URLs
      if (Array.isArray(value) && value[0]?.url) {
        payload.record.fields[field.name] = value.map(a => ({
          url: a.url,
          filename: a.filename,
          type: a.type
        }));
      }
      // For linked records, get names
      else if (Array.isArray(value) && value[0]?.name !== undefined) {
        payload.record.fields[field.name] = value.map(r => r.name);
      }
      // For other values, use as-is
      else {
        payload.record.fields[field.name] = value;
      }
    }
  } catch (e) {
    // Skip fields that can't be read
  }
}` : `// Add specific fields (customize this list)
payload.record.fields['Name'] = record.getCellValueAsString('Name');
// Add more fields as needed:
// payload.record.fields['Email'] = record.getCellValueAsString('Email');
// payload.record.fields['Amount'] = record.getCellValue('Amount');`}

// Send to Glyph webhook
const response = await fetch(config.webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

// Parse response
const result = await response.json();

if (result.success) {
  console.log('PDF generated successfully!');
  console.log('Download URL:', result.pdfUrl);
  console.log('Filename:', result.filename);
  console.log('Processing time:', result.processingTimeMs + 'ms');
} else {
  console.error('PDF generation failed:', result.error);
}

// Return result for use in subsequent automation actions
output.set('success', result.success);
output.set('pdfUrl', result.pdfUrl || '');
output.set('filename', result.filename || '');
output.set('error', result.error || '');`;

  return script;
}

/**
 * Generate setup instructions for the webhook
 */
export function generateSetupInstructions(webhookUrl: string): {
  summary: string;
  steps: string[];
  airtableScript: string;
} {
  return {
    summary: "Set up an Airtable automation to trigger PDF generation when records are created or updated.",
    steps: [
      "1. Open your Airtable base",
      "2. Click 'Automations' in the top-right corner",
      "3. Click '+ Create automation'",
      "4. Set trigger: 'When a record is created' or 'When a record is updated'",
      "5. Select your table",
      "6. Add action: 'Run script'",
      "7. Paste the script below into the script editor",
      "8. Click 'Test' to verify it works",
      "9. Turn on the automation",
    ],
    airtableScript: generateAirtableScript(webhookUrl),
  };
}
