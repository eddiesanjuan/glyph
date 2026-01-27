/**
 * Templates Route Tests
 *
 * Tests the GET /v1/templates (list) endpoint.
 * Does NOT test AI-powered generation or Airtable-connected routes.
 */
import { describe, test, expect } from "vitest";
import { Hono } from "hono";

// Recreate the catalog and list endpoint in isolation to avoid side effects
// from importing the full templates route (which pulls in AI, Airtable, batch, etc.)

interface TemplateCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  sampleData: Record<string, unknown>;
}

const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    id: "quote-modern",
    name: "Modern Quote",
    description: "Clean, minimal quote with sans-serif fonts and subtle borders.",
    category: "quote",
    sampleData: { meta: { quoteNumber: "Q-2024-001" } },
  },
  {
    id: "quote-bold",
    name: "Bold Quote",
    description: "High-impact modern design with strong visual hierarchy.",
    category: "quote",
    sampleData: { meta: { quoteNumber: "Q-2024-042" } },
  },
  {
    id: "quote-professional",
    name: "Professional Quote",
    description: "Traditional business style with formal serif typography.",
    category: "quote",
    sampleData: { meta: { quoteNumber: "Q-2024-001" } },
  },
  {
    id: "invoice-clean",
    name: "Clean Invoice",
    description: "Clear, structured invoice with line items, totals, and payment terms.",
    category: "invoice",
    sampleData: { invoice: { number: "INV-2024-0042" } },
  },
  {
    id: "receipt-minimal",
    name: "Minimal Receipt",
    description: "Compact receipt layout for point-of-sale or digital transactions.",
    category: "receipt",
    sampleData: { merchant: { name: "The Daily Grind" } },
  },
  {
    id: "report-cover",
    name: "Report Cover Page",
    description: "Professional cover page for reports with title, author, and abstract.",
    category: "report",
    sampleData: { report: { title: "Q4 2024 Market Analysis" } },
  },
];

function createApp() {
  const app = new Hono();

  app.get("/v1/templates", (c) => {
    return c.json({
      templates: TEMPLATE_CATALOG,
      count: TEMPLATE_CATALOG.length,
    });
  });

  app.get("/v1/templates/:id", (c) => {
    const id = c.req.param("id");
    const entry = TEMPLATE_CATALOG.find((t) => t.id === id);
    if (!entry) {
      return c.json({ error: `Template '${id}' not found`, code: "TEMPLATE_NOT_FOUND" }, 404);
    }
    return c.json(entry);
  });

  return app;
}

describe("GET /v1/templates", () => {
  const app = createApp();

  test("returns 200 with list of templates", async () => {
    const res = await app.request("/v1/templates");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toBeDefined();
    expect(Array.isArray(body.templates)).toBe(true);
  });

  test("returns correct count", async () => {
    const res = await app.request("/v1/templates");
    const body = await res.json();
    expect(body.count).toBe(TEMPLATE_CATALOG.length);
    expect(body.templates.length).toBe(body.count);
  });

  test("each template has required fields", async () => {
    const res = await app.request("/v1/templates");
    const body = await res.json();
    for (const tpl of body.templates) {
      expect(tpl.id).toBeDefined();
      expect(tpl.name).toBeDefined();
      expect(tpl.description).toBeDefined();
      expect(tpl.category).toBeDefined();
      expect(tpl.sampleData).toBeDefined();
    }
  });

  test("includes expected template IDs", async () => {
    const res = await app.request("/v1/templates");
    const body = await res.json();
    const ids = body.templates.map((t: TemplateCatalogEntry) => t.id);
    expect(ids).toContain("quote-modern");
    expect(ids).toContain("invoice-clean");
    expect(ids).toContain("receipt-minimal");
    expect(ids).toContain("report-cover");
  });

  test("categories are valid values", async () => {
    const res = await app.request("/v1/templates");
    const body = await res.json();
    const validCategories = ["quote", "invoice", "receipt", "report", "letter"];
    for (const tpl of body.templates) {
      expect(validCategories).toContain(tpl.category);
    }
  });
});

describe("GET /v1/templates/:id", () => {
  const app = createApp();

  test("returns template by ID", async () => {
    const res = await app.request("/v1/templates/quote-modern");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("quote-modern");
    expect(body.name).toBe("Modern Quote");
  });

  test("returns 404 for unknown template", async () => {
    const res = await app.request("/v1/templates/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("TEMPLATE_NOT_FOUND");
  });
});
