/**
 * Glyph MCP Resources
 * Exposes session state and templates as MCP resources
 */

import { getSession } from "./api.js";

// =============================================================================
// Resource Definitions
// =============================================================================

export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: "glyph://session/{sessionId}/preview",
    name: "Session Preview",
    description: "Current HTML preview for a session",
    mimeType: "text/html",
  },
  {
    uriTemplate: "glyph://session/{sessionId}/data",
    name: "Session Data",
    description: "Original data used to create the session",
    mimeType: "application/json",
  },
  {
    uriTemplate: "glyph://session/{sessionId}/info",
    name: "Session Info",
    description: "Session metadata including template and creation time",
    mimeType: "application/json",
  },
  {
    uriTemplate: "glyph://templates",
    name: "Available Templates",
    description: "List of all available document templates",
    mimeType: "application/json",
  },
  {
    uriTemplate: "glyph://schema/{templateId}",
    name: "Template Schema",
    description: "Data schema for a specific template",
    mimeType: "application/json",
  },
];

// =============================================================================
// Resource Handlers
// =============================================================================

export interface ResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
  }>;
}

export function handleResource(uri: string): ResourceResult {
  const url = new URL(uri);
  const path = url.pathname;

  // glyph://session/{sessionId}/preview
  if (path.startsWith("/session/") && path.endsWith("/preview")) {
    const sessionId = path.split("/")[2];
    return handleSessionPreview(sessionId, uri);
  }

  // glyph://session/{sessionId}/data
  if (path.startsWith("/session/") && path.endsWith("/data")) {
    const sessionId = path.split("/")[2];
    return handleSessionData(sessionId, uri);
  }

  // glyph://session/{sessionId}/info
  if (path.startsWith("/session/") && path.endsWith("/info")) {
    const sessionId = path.split("/")[2];
    return handleSessionInfo(sessionId, uri);
  }

  // glyph://templates
  if (path === "/templates" || path === "/templates/") {
    return handleTemplatesList(uri);
  }

  // glyph://schema/{templateId}
  if (path.startsWith("/schema/")) {
    const templateId = path.split("/")[2];
    return handleTemplateSchema(templateId, uri);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          error: "Resource not found",
          uri,
          availablePatterns: RESOURCE_TEMPLATES.map((r) => r.uriTemplate),
        }),
      },
    ],
  };
}

function handleSessionPreview(sessionId: string, uri: string): ResourceResult {
  const session = getSession(sessionId);

  if (!session) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "Session not found",
            sessionId,
            suggestion: "Create a session with glyph_preview first",
          }),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: "text/html",
        text: session.html,
      },
    ],
  };
}

function handleSessionData(sessionId: string, uri: string): ResourceResult {
  const session = getSession(sessionId);

  if (!session) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "Session not found",
            sessionId,
          }),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(session.data, null, 2),
      },
    ],
  };
}

function handleSessionInfo(sessionId: string, uri: string): ResourceResult {
  const session = getSession(sessionId);

  if (!session) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "Session not found",
            sessionId,
          }),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            sessionId,
            template: session.template,
            createdAt: session.createdAt.toISOString(),
            htmlLength: session.html.length,
            dataFields: Object.keys(session.data),
          },
          null,
          2
        ),
      },
    ],
  };
}

function handleTemplatesList(uri: string): ResourceResult {
  const templates = [
    {
      id: "quote-modern",
      name: "Quote Modern",
      description:
        "Clean, professional quote/proposal template with line items and totals",
      category: "business",
      features: [
        "Line items table",
        "Totals calculation",
        "Client info",
        "Branding",
      ],
    },
    {
      id: "invoice",
      name: "Invoice",
      description: "Standard invoice template for billing",
      category: "business",
      features: ["Invoice number", "Due date", "Line items", "Payment terms"],
    },
    {
      id: "receipt",
      name: "Receipt",
      description: "Payment receipt confirmation",
      category: "business",
      features: [
        "Transaction ID",
        "Payment method",
        "Items purchased",
        "Total paid",
      ],
    },
    {
      id: "contract",
      name: "Contract",
      description: "Simple contract/agreement template",
      category: "legal",
      features: [
        "Parties section",
        "Terms",
        "Signature lines",
        "Dates",
      ],
    },
    {
      id: "report",
      name: "Report",
      description: "Data report and summary template",
      category: "analytics",
      features: ["Header", "Summary section", "Data tables", "Charts area"],
    },
  ];

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ templates }, null, 2),
      },
    ],
  };
}

function handleTemplateSchema(templateId: string, uri: string): ResourceResult {
  const schemas: Record<string, object> = {
    "quote-modern": {
      templateId: "quote-modern",
      name: "Quote Modern",
      version: "1.0",
      schema: {
        type: "object",
        required: ["client", "lineItems", "totals"],
        properties: {
          meta: {
            type: "object",
            properties: {
              quoteNumber: { type: "string" },
              date: { type: "string" },
              validUntil: { type: "string" },
              notes: { type: "string" },
              terms: { type: "string" },
              showSignature: { type: "boolean" },
            },
          },
          client: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              company: { type: "string" },
              address: { type: "string" },
              email: { type: "string", format: "email" },
              phone: { type: "string" },
            },
          },
          lineItems: {
            type: "array",
            items: {
              type: "object",
              required: ["description", "quantity", "unitPrice", "total"],
              properties: {
                description: { type: "string" },
                details: { type: "string" },
                quantity: { type: "number" },
                unitPrice: { type: "number" },
                total: { type: "number" },
              },
            },
          },
          totals: {
            type: "object",
            required: ["subtotal", "total"],
            properties: {
              subtotal: { type: "number" },
              discount: { type: "number" },
              discountPercent: { type: "number" },
              tax: { type: "number" },
              taxRate: { type: "number" },
              total: { type: "number" },
            },
          },
          branding: {
            type: "object",
            properties: {
              logoUrl: { type: "string", format: "uri" },
              companyName: { type: "string" },
              companyAddress: { type: "string" },
            },
          },
          styles: {
            type: "object",
            properties: {
              accentColor: { type: "string" },
              fontFamily: { type: "string" },
              fontSize: { type: "string" },
            },
          },
        },
      },
      example: {
        meta: {
          quoteNumber: "Q-2024-001",
          date: "January 15, 2024",
          validUntil: "February 15, 2024",
        },
        client: {
          name: "John Smith",
          company: "Acme Corp",
          email: "john@acme.com",
        },
        lineItems: [
          {
            description: "Website Design",
            quantity: 1,
            unitPrice: 3500,
            total: 3500,
          },
        ],
        totals: {
          subtotal: 3500,
          total: 3500,
        },
        branding: {
          companyName: "Your Company",
        },
      },
    },
  };

  const schema = schemas[templateId];

  if (!schema) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: `Template schema not found: ${templateId}`,
            availableTemplates: Object.keys(schemas),
          }),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(schema, null, 2),
      },
    ],
  };
}

// List all available resources (for discovery)
export function listResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uri: "glyph://templates",
      name: "Available Templates",
      description: "List of all available document templates",
      mimeType: "application/json",
    },
    {
      uri: "glyph://schema/quote-modern",
      name: "Quote Modern Schema",
      description: "Data schema for the quote-modern template",
      mimeType: "application/json",
    },
  ];
}
