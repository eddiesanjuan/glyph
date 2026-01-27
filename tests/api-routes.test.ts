/**
 * Tests for generate, batch, notification-webhooks, and templates routes.
 *
 * Uses Hono's built-in `app.request()` so no HTTP server is started.
 * External services (Anthropic AI, Supabase, Playwright) are mocked.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Mock @hono/node-server so importing index.ts doesn't start a server
vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

// Mock Supabase so no real DB calls happen
vi.mock("../api/src/lib/supabase.js", () => ({
  supabase: null,
  getSupabase: vi.fn(),
}));

// Mock the AI service
vi.mock("../api/src/services/ai.js", () => ({
  modifyTemplate: vi.fn().mockResolvedValue({
    html: "<html><body>modified</body></html>",
    changes: ["mock change"],
    tokensUsed: 50,
  }),
  modifyTemplateStream: vi.fn(),
  parseAiResponse: vi.fn(),
  modifyHtml: vi.fn().mockResolvedValue({
    html: "<html><body>modified</body></html>",
    changes: ["mock change"],
    tokensUsed: 50,
  }),
  validateRequestFeasibility: vi.fn().mockResolvedValue({
    feasible: true,
    checkTimeMs: 5,
  }),
  isSimpleModification: vi.fn().mockReturnValue(true),
  generateTemplateFromSchema: vi.fn().mockResolvedValue({
    fullHtml: "<html><body>{{name}}</body></html>",
    html: "<body>{{name}}</body>",
    css: "",
    fields: ["name"],
    tokensUsed: 100,
  }),
  refineTemplate: vi.fn().mockResolvedValue({
    fullHtml: "<html><body>refined</body></html>",
    html: "<body>refined</body>",
    css: "",
    fields: ["name"],
    tokensUsed: 80,
  }),
}));

// Mock validator
vi.mock("../api/src/services/validator.js", () => ({
  validateModification: vi.fn().mockResolvedValue({
    passed: true,
    issues: [],
    validationTime: 10,
  }),
  repairHtml: vi.fn((html: string) => ({ html, repairsApplied: [] })),
  isHtmlTruncated: vi.fn().mockReturnValue(false),
  getFriendlyIssueDescription: vi.fn((issue: { description: string }) => issue.description),
}));

// Mock fast transform
vi.mock("../api/src/services/fastTransform.js", () => ({
  canFastTransform: vi.fn().mockReturnValue(false),
  fastTransform: vi.fn(),
}));

// Mock rate limiting to avoid hitting limits during tests
vi.mock("../api/src/middleware/rateLimit.js", () => ({
  rateLimitMiddleware: vi.fn(async (_c: any, next: any) => next()),
  monthlyLimitMiddleware: vi.fn(async (_c: any, next: any) => next()),
}));

// Mock event subscriptions
vi.mock("../api/src/routes/subscriptions.js", async () => {
  const { Hono } = await import("hono");
  const app = new Hono();
  return {
    default: app,
    triggerEventSubscriptions: vi.fn(),
  };
});

// Mock PDF generation (avoid Playwright dependency)
vi.mock("../api/src/services/pdf.js", () => ({
  generatePdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content")),
  generatePng: vi.fn().mockResolvedValue(Buffer.from("fake-png-content")),
  generatePDF: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content")),
  generatePNG: vi.fn().mockResolvedValue(Buffer.from("fake-png-content")),
}));

// Mock notification webhooks fire function (keep CRUD working)
vi.mock("../api/src/services/notificationWebhooks.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/src/services/notificationWebhooks.js")>();
  return {
    ...actual,
    fireNotificationWebhooks: vi.fn(),
  };
});

// Mock data analyzer and layout generator for batch route
vi.mock("../api/src/services/dataAnalyzer.js", () => ({
  analyzeData: vi.fn().mockResolvedValue({
    documentType: "invoice",
    confidence: 0.95,
    detectedFields: [],
    styling: { suggestedStyle: "stripe-clean" },
  }),
}));

vi.mock("../api/src/services/layoutGenerator.js", () => ({
  generateFullDocument: vi.fn().mockResolvedValue("<html><body>generated</body></html>"),
}));

// Mock batch service for templates batch routes
vi.mock("../api/src/services/batch.js", () => ({
  generateBatchSync: vi.fn().mockResolvedValue(Buffer.from("fake-zip")),
  startBatchJob: vi.fn().mockResolvedValue("job_123"),
  getJobStatus: vi.fn().mockReturnValue(null),
  getJobResult: vi.fn().mockReturnValue(null),
  getTableViews: vi.fn().mockResolvedValue([]),
  getRecordCount: vi.fn().mockResolvedValue(0),
}));

// Mock airtable service for templates routes
vi.mock("../api/src/services/airtable.js", () => ({
  AirtableService: vi.fn().mockImplementation(() => ({
    getTableSchema: vi.fn().mockResolvedValue(null),
    formatSchemaForAI: vi.fn(),
    getSampleRecords: vi.fn().mockResolvedValue([]),
    formatRecordForTemplate: vi.fn(),
  })),
  isValidAirtableKeyFormat: vi.fn().mockReturnValue(true),
}));

// Mock template engine
vi.mock("../api/src/services/template.js", () => ({
  templateEngine: {
    getTemplateHtml: vi.fn().mockResolvedValue("<html><body>{{name}}</body></html>"),
    warmCache: vi.fn(),
  },
}));

// Now import the app
let app: any;

beforeAll(async () => {
  process.env.GLYPH_API_KEY = "gk_demo_playground_2024";
  const mod = await import("../api/src/index.js");
  app = { fetch: mod.default.fetch };
});

const DEMO_KEY = "gk_demo_playground_2024";
const AUTH_HEADER = `Bearer ${DEMO_KEY}`;

// Helper to make requests
async function request(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string>; rawResponse?: boolean } = {}
) {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = { method, headers };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req);

  if (options.rawResponse) {
    return { status: res.status, res };
  }

  const json = await res.json();
  return { status: res.status, json };
}

// =============================================================================
// POST /v1/generate
// =============================================================================
describe("POST /v1/generate", () => {
  it("rejects requests without auth", async () => {
    const { status, json } = await request("POST", "/v1/generate", {
      body: { html: "<p>hello</p>", format: "pdf" },
    });
    expect(status).toBe(401);
  });

  it("rejects missing html field", async () => {
    const { status, json } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { format: "pdf" },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects empty html field", async () => {
    const { status, json } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { html: "", format: "pdf" },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid format", async () => {
    const { status, json } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { html: "<p>hello</p>", format: "docx" },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("generates a PDF with valid input", async () => {
    const { status } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { html: "<p>hello</p>", format: "pdf" },
      rawResponse: true,
    }) as any;
    expect(status).toBe(200);
  });

  it("generates a PNG with valid input", async () => {
    const { status } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { html: "<p>hello</p>", format: "png" },
      rawResponse: true,
    }) as any;
    expect(status).toBe(200);
  });

  it("returns JSON metadata when Accept header is application/json", async () => {
    const { status, json } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER, Accept: "application/json" },
      body: { html: "<p>hello</p>", format: "pdf" },
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("url");
    expect(json).toHaveProperty("format", "pdf");
    expect(json).toHaveProperty("size");
    expect(json).toHaveProperty("usage");
    expect(json.usage).toHaveProperty("renderTimeMs");
  });

  it("rejects scale > 3", async () => {
    const { status, json } = await request("POST", "/v1/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { html: "<p>hello</p>", format: "pdf", options: { scale: 5 } },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });
});

// =============================================================================
// POST /v1/batch/generate
// =============================================================================
describe("POST /v1/batch/generate", () => {
  it("rejects requests without auth", async () => {
    const { status } = await request("POST", "/v1/batch/generate", {
      body: { items: [{ data: { name: "test" } }] },
    });
    expect(status).toBe(401);
  });

  it("rejects missing items", async () => {
    const { status, json } = await request("POST", "/v1/batch/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: {},
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects empty items array", async () => {
    const { status, json } = await request("POST", "/v1/batch/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { items: [] },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects more than 10 items", async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      data: { name: `item-${i}` },
    }));
    const { status, json } = await request("POST", "/v1/batch/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { items },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects item with empty data object", async () => {
    const { status, json } = await request("POST", "/v1/batch/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: { items: [{ data: {} }] },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("processes a valid single-item batch", async () => {
    const { status, json } = await request("POST", "/v1/batch/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        items: [{ data: { name: "Test Invoice", amount: 100 } }],
      },
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("results");
    expect(json).toHaveProperty("totalTimeMs");
    expect(json).toHaveProperty("successCount");
    expect(json).toHaveProperty("failCount");
    expect(json.results).toHaveLength(1);
  });

  it("accepts valid format options per item", async () => {
    const { status, json } = await request("POST", "/v1/batch/generate", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        items: [
          { data: { name: "Test" }, format: "png" },
        ],
      },
    });
    expect(status).toBe(200);
    expect(json.results).toHaveLength(1);
  });
});

// =============================================================================
// Notification Webhooks CRUD
// =============================================================================
describe("Notification Webhooks (/v1/notification-webhooks)", () => {
  it("rejects requests without auth", async () => {
    const { status } = await request("GET", "/v1/notification-webhooks");
    expect(status).toBe(401);
  });

  it("lists webhooks (initially empty)", async () => {
    const { status, json } = await request("GET", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("webhooks");
    expect(json).toHaveProperty("count");
    expect(Array.isArray(json.webhooks)).toBe(true);
  });

  it("rejects creating webhook with non-HTTPS URL", async () => {
    const { status, json } = await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "http://example.com/hook",
        events: ["pdf.generated"],
      },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creating webhook with invalid URL", async () => {
    const { status, json } = await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "not-a-url",
        events: ["pdf.generated"],
      },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creating webhook with empty events", async () => {
    const { status, json } = await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "https://example.com/hook",
        events: [],
      },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creating webhook with invalid event type", async () => {
    const { status, json } = await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "https://example.com/hook",
        events: ["invalid.event"],
      },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("creates a webhook with valid input", async () => {
    const { status, json } = await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "https://example.com/hook",
        events: ["pdf.generated"],
      },
    });
    expect(status).toBe(201);
    expect(json).toHaveProperty("id");
    expect(json.url).toBe("https://example.com/hook");
    expect(json.events).toEqual(["pdf.generated"]);
    expect(json).toHaveProperty("created_at");
  });

  it("lists webhooks after creation", async () => {
    // Create one first
    await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "https://example.com/hook2",
        events: ["modify.completed"],
      },
    });

    const { status, json } = await request("GET", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(200);
    expect(json.count).toBeGreaterThan(0);
    expect(json.webhooks.length).toBe(json.count);
  });

  it("returns 404 when deleting non-existent webhook", async () => {
    const { status, json } = await request("DELETE", "/v1/notification-webhooks/nwh_nonexistent", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(404);
    expect(json.code).toBe("NOTIFICATION_WEBHOOK_NOT_FOUND");
  });

  it("deletes an existing webhook", async () => {
    // Create one
    const { json: created } = await request("POST", "/v1/notification-webhooks", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        url: "https://example.com/to-delete",
        events: ["pdf.generated"],
      },
    });

    // Delete it
    const { status, json } = await request("DELETE", `/v1/notification-webhooks/${created.id}`, {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
  });
});

// =============================================================================
// Templates routes
// =============================================================================
describe("Templates (/v1/templates)", () => {
  it("lists built-in templates", async () => {
    const { status, json } = await request("GET", "/v1/templates", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("templates");
    expect(json).toHaveProperty("count");
    expect(Array.isArray(json.templates)).toBe(true);
    expect(json.count).toBeGreaterThan(0);
  });

  it("each template has required fields", async () => {
    const { json } = await request("GET", "/v1/templates", {
      headers: { Authorization: AUTH_HEADER },
    });
    for (const t of json.templates) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("category");
      expect(t).toHaveProperty("sampleData");
    }
  });

  it("returns 404 for unknown template preview", async () => {
    const { status, json } = await request("GET", "/v1/templates/nonexistent-template/preview", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(404);
    expect(json.code).toBe("TEMPLATE_NOT_FOUND");
  });

  it("lists style presets", async () => {
    const { status, json } = await request("GET", "/v1/templates/styles", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("styles");
    expect(Array.isArray(json.styles)).toBe(true);
    expect(json.styles.length).toBeGreaterThan(0);
    for (const style of json.styles) {
      expect(style).toHaveProperty("id");
      expect(style).toHaveProperty("name");
      expect(style).toHaveProperty("description");
    }
  });

  it("rejects template preview with missing html", async () => {
    const { status, json } = await request("POST", "/v1/templates/preview", {
      headers: { Authorization: AUTH_HEADER },
      body: { data: { name: "test" } },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("renders template preview with valid input", async () => {
    const { status, json } = await request("POST", "/v1/templates/preview", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        html: "<p>Hello {{name}}</p>",
        data: { name: "World" },
      },
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.html).toBe("<p>Hello World</p>");
  });
});
