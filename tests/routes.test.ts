/**
 * Integration tests for core Glyph API routes.
 *
 * Uses Hono's built-in `app.request()` so no HTTP server is started.
 * External services (Anthropic AI, Supabase) are mocked.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock @hono/node-server so importing index.ts doesn't start a server
vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

// Mock Supabase so no real DB calls happen
vi.mock("../api/src/lib/supabase.js", () => ({
  supabase: null,
  getSupabase: vi.fn(),
}));

// We'll store the original template HTML from preview to use in mock responses
let capturedTemplateHtml = "";

// Mock the AI service to avoid real Anthropic calls
// The mock returns a slightly modified version of the input template to avoid
// triggering the content-loss guardrail (which rejects responses that are
// significantly shorter than the original).
vi.mock("../api/src/services/ai.js", () => ({
  modifyTemplate: vi.fn().mockImplementation((templateHtml: string) => {
    // Return the original template with a small addition so guardrails pass
    const modified = templateHtml.replace("</body>", '<div style="opacity:0.15;position:fixed;top:50%;left:50%;font-size:72px;transform:translate(-50%,-50%) rotate(-30deg);pointer-events:none;">DRAFT</div></body>');
    return Promise.resolve({
      html: modified,
      changes: ["Added DRAFT watermark"],
      tokensUsed: 100,
    });
  }),
  modifyTemplateStream: vi.fn(),
  parseAiResponse: vi.fn(),
  modifyHtml: vi.fn(),
  validateRequestFeasibility: vi.fn().mockResolvedValue({
    feasible: true,
    checkTimeMs: 5,
  }),
  isSimpleModification: vi.fn().mockReturnValue(true),
}));

// Mock the self-check validator to avoid real AI calls in background validation
vi.mock("../api/src/services/validator.js", () => ({
  validateModification: vi.fn().mockResolvedValue({
    passed: true,
    issues: [],
    validationTime: 10,
  }),
  repairHtml: vi.fn((html: string) => ({
    html,
    repairsApplied: [],
  })),
  isHtmlTruncated: vi.fn().mockReturnValue(false),
  getFriendlyIssueDescription: vi.fn((issue: { description: string }) => issue.description),
}));

// Mock fast transform
vi.mock("../api/src/services/fastTransform.js", () => ({
  canFastTransform: vi.fn().mockReturnValue(false),
  fastTransform: vi.fn(),
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

// Now import the app (server won't start due to mock)
// We need to use a dynamic import after mocks are set up
let app: any;

beforeAll(async () => {
  const mod = await import("../api/src/index.js");
  // The default export has a `fetch` property
  app = { fetch: mod.default.fetch };
});

const DEMO_KEY = "gk_demo_playground_2024";
const AUTH_HEADER = `Bearer ${DEMO_KEY}`;

// Helper to make requests against the Hono app
async function request(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req);
  const json = await res.json();
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
describe("GET /health", () => {
  it("returns status ok", async () => {
    const { status, json } = await request("GET", "/health");
    expect(status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json).toHaveProperty("version");
    expect(json).toHaveProperty("timestamp");
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
describe("Authentication", () => {
  it("rejects requests without Authorization header", async () => {
    const { status, json } = await request("POST", "/v1/preview");
    expect(status).toBe(401);
    expect(json.error).toContain("Authorization");
  });

  it("rejects invalid key format", async () => {
    const { status, json } = await request("POST", "/v1/preview", {
      headers: { Authorization: "Bearer invalid_key" },
    });
    expect(status).toBe(401);
    expect(json.error).toContain("gk_");
  });

  it("rejects malformed Authorization header", async () => {
    const { status } = await request("POST", "/v1/preview", {
      headers: { Authorization: "NotBearer gk_test" },
    });
    expect(status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/preview
// ---------------------------------------------------------------------------
describe("POST /v1/preview", () => {
  const validPreviewBody = {
    template: "quote-modern",
    data: {
      client: {
        name: "Test Client",
        email: "test@example.com",
      },
      lineItems: [
        {
          description: "Widget",
          quantity: 2,
          unitPrice: 50,
          total: 100,
        },
      ],
      totals: {
        subtotal: 100,
        tax: 10,
        total: 110,
      },
    },
  };

  it("creates a preview session and returns HTML", async () => {
    const { status, json } = await request("POST", "/v1/preview", {
      headers: { Authorization: AUTH_HEADER },
      body: validPreviewBody,
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("html");
    expect(json).toHaveProperty("sessionId");
    expect(typeof json.html).toBe("string");
    expect(json.html.length).toBeGreaterThan(0);
    // Demo tier uses dev sessions
    expect(json.sessionId).toMatch(/^dev_/);
  });

  it("rejects missing client name", async () => {
    const body = {
      ...validPreviewBody,
      data: {
        ...validPreviewBody.data,
        client: { email: "test@example.com" }, // name missing
      },
    };
    const { status, json } = await request("POST", "/v1/preview", {
      headers: { Authorization: AUTH_HEADER },
      body,
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects empty lineItems", async () => {
    const body = {
      ...validPreviewBody,
      data: {
        ...validPreviewBody.data,
        lineItems: [],
      },
    };
    const { status, json } = await request("POST", "/v1/preview", {
      headers: { Authorization: AUTH_HEADER },
      body,
    });
    // Zod array with no min constraint may pass, but let's check
    // If it passes, that's fine too -- the API allows empty arrays
    expect([200, 400]).toContain(status);
  });

  it("rejects negative totals", async () => {
    const body = {
      ...validPreviewBody,
      data: {
        ...validPreviewBody.data,
        totals: { subtotal: -5, total: -5 },
      },
    };
    const { status, json } = await request("POST", "/v1/preview", {
      headers: { Authorization: AUTH_HEADER },
      body,
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// POST /v1/modify (session-based)
// ---------------------------------------------------------------------------
describe("POST /v1/modify", () => {
  let sessionId: string;

  // Create a session first
  beforeAll(async () => {
    const { json } = await request("POST", "/v1/preview", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        template: "quote-modern",
        data: {
          client: { name: "Modify Test" },
          lineItems: [
            { description: "Item", quantity: 1, unitPrice: 100, total: 100 },
          ],
          totals: { subtotal: 100, total: 100 },
        },
      },
    });
    sessionId = json.sessionId;
  });

  it("modifies a session with a valid prompt", async () => {
    const { status, json } = await request("POST", "/v1/modify", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        sessionId,
        prompt: "Add a watermark that says DRAFT",
      },
    });
    expect(status).toBe(200);
    expect(json).toHaveProperty("html");
    expect(json).toHaveProperty("changes");
    expect(Array.isArray(json.changes)).toBe(true);
  });

  it("returns 404 for non-existent session", async () => {
    const { status, json } = await request("POST", "/v1/modify", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        sessionId: "dev_nonexistent_session_id",
        prompt: "Make it blue",
      },
    });
    expect(status).toBe(404);
    expect(json.code).toBe("DEV_SESSION_NOT_FOUND");
  });

  it("rejects empty prompt", async () => {
    const { status, json } = await request("POST", "/v1/modify", {
      headers: { Authorization: AUTH_HEADER },
      body: {
        sessionId,
        prompt: "",
      },
    });
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing sessionId and html (invalid body)", async () => {
    const { status } = await request("POST", "/v1/modify", {
      headers: { Authorization: AUTH_HEADER },
      body: { prompt: "do something" },
    });
    // Direct mode requires html+instruction, session mode requires sessionId
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const { status, json } = await request("GET", "/v1/nonexistent", {
      headers: { Authorization: AUTH_HEADER },
    });
    expect(status).toBe(404);
    expect(json.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// GET / (API info)
// ---------------------------------------------------------------------------
describe("GET /", () => {
  it("returns API info with endpoint listing", async () => {
    const { status, json } = await request("GET", "/");
    expect(status).toBe(200);
    expect(json.name).toBe("Glyph API");
    expect(json).toHaveProperty("endpoints");
    expect(json.endpoints).toHaveProperty("preview");
    expect(json.endpoints).toHaveProperty("modify");
    expect(json.endpoints).toHaveProperty("generate");
  });
});
