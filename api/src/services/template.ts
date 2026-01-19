/**
 * Template Engine Service
 * Handles HTML template rendering with QuoteData
 */

import type { QuoteData } from "../lib/types.js";

const DEFAULT_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote - {{quoteNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company { font-size: 24px; font-weight: bold; }
    .quote-info { text-align: right; color: #666; }
    .client { margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .client h3 { margin-bottom: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #333; color: white; padding: 12px; text-align: left; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    .totals { text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 8px 0; }
    .totals .total { font-size: 20px; font-weight: bold; border-top: 2px solid #333; padding-top: 12px; }
    .notes { margin-top: 40px; padding: 20px; background: #fff8e1; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">{{companyName}}</div>
    <div class="quote-info">
      <div>Quote #{{quoteNumber}}</div>
      <div>Date: {{date}}</div>
      <div>Valid Until: {{validUntil}}</div>
    </div>
  </div>

  <div class="client">
    <h3>Bill To:</h3>
    <div>{{clientName}}</div>
    {{#clientCompany}}<div>{{clientCompany}}</div>{{/clientCompany}}
    {{#clientAddress}}<div>{{clientAddress}}</div>{{/clientAddress}}
    {{#clientEmail}}<div>{{clientEmail}}</div>{{/clientEmail}}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#lineItems}}
      <tr>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>{{unitPrice}}</td>
        <td>{{total}}</td>
      </tr>
      {{/lineItems}}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal:</span> <span>{{subtotal}}</span></div>
    {{#tax}}<div class="row"><span>Tax:</span> <span>{{tax}}</span></div>{{/tax}}
    {{#discount}}<div class="row"><span>Discount:</span> <span>-{{discount}}</span></div>{{/discount}}
    <div class="row total"><span>Total:</span> <span>{{total}}</span></div>
  </div>

  {{#notes}}
  <div class="notes">
    <strong>Notes:</strong>
    <p>{{notes}}</p>
  </div>
  {{/notes}}
</body>
</html>
`;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function simpleTemplate(template: string, data: Record<string, unknown>): string {
  let result = template;

  // Handle simple replacements {{key}}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" || typeof value === "number") {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }
  }

  // Handle conditionals {{#key}}...{{/key}}
  for (const [key, value] of Object.entries(data)) {
    const conditionalRegex = new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, "g");
    if (value) {
      result = result.replace(conditionalRegex, "$1");
    } else {
      result = result.replace(conditionalRegex, "");
    }
  }

  return result;
}

export function renderTemplate(data: QuoteData, _templateId?: string): string {
  // For now, use default template. Later, fetch from database by templateId
  const template = DEFAULT_TEMPLATE;

  // Flatten data for template
  const flatData: Record<string, unknown> = {
    companyName: data.branding?.companyName || "Your Company",
    quoteNumber: data.meta?.quoteNumber || "001",
    date: data.meta?.date || new Date().toLocaleDateString(),
    validUntil: data.meta?.validUntil || "",
    clientName: data.client.name,
    clientCompany: data.client.company,
    clientAddress: data.client.address,
    clientEmail: data.client.email,
    subtotal: formatCurrency(data.totals.subtotal),
    tax: data.totals.tax ? formatCurrency(data.totals.tax) : null,
    discount: data.totals.discount ? formatCurrency(data.totals.discount) : null,
    total: formatCurrency(data.totals.total),
    notes: data.meta?.notes,
  };

  // Render line items
  const lineItemsHtml = data.lineItems
    .map(
      (item) => `
      <tr>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unitPrice)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>
    `
    )
    .join("");

  let result = simpleTemplate(template, flatData);
  result = result.replace(/{{#lineItems}}[\s\S]*?{{\/lineItems}}/, lineItemsHtml);

  return result;
}

export async function getTemplate(templateId: string): Promise<string | null> {
  // TODO: Fetch template from Supabase
  console.log(`Template requested: ${templateId}`);
  return DEFAULT_TEMPLATE;
}
