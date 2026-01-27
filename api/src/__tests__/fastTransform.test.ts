/**
 * Fast Transform Service Tests
 *
 * Tests the pure functions canFastTransform() and fastTransform()
 * that handle common document modifications without calling AI.
 */
import { describe, test, expect } from "vitest";
import { canFastTransform, fastTransform } from "../services/fastTransform.js";

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><style>header { background: #1e3a5f; color: white; }</style></head>
<body>
<header data-glyph-region="header"><h1>Quote</h1></header>
<div data-glyph-region="client-info">
  <p>{{client.name}}</p>
</div>
<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
<tbody>{{#lineItems}}<tr><td>{{description}}</td><td>{{quantity}}</td><td>{{total}}</td></tr>{{/lineItems}}</tbody></table>
<div data-glyph-region="totals"><p>Total: {{totals.grand}}</p></div>
<div data-glyph-region="footer"><p>Thank you</p></div>
</body></html>`;

// ---------------------------------------------------------------------------
// canFastTransform
// ---------------------------------------------------------------------------
describe("canFastTransform", () => {
  test("recognizes QR code requests", () => {
    expect(canFastTransform("Add a QR code")).toBe(true);
    expect(canFastTransform("add qr code")).toBe(true);
    expect(canFastTransform("Add QR code for https://example.com")).toBe(true);
  });

  test("recognizes watermark requests", () => {
    expect(canFastTransform("Add a DRAFT watermark")).toBe(true);
    expect(canFastTransform("add watermark")).toBe(true);
    expect(canFastTransform("Add a diagonal watermark")).toBe(true);
    expect(canFastTransform("add paid watermark")).toBe(true);
  });

  test("recognizes color change requests", () => {
    expect(canFastTransform("Make the header blue")).toBe(true);
    expect(canFastTransform("Change the title color to red")).toBe(true);
  });

  test("recognizes font size requests", () => {
    expect(canFastTransform("Make the title bigger")).toBe(true);
    expect(canFastTransform("increase font size")).toBe(true);
    expect(canFastTransform("smaller text")).toBe(false); // doesn't match pattern exactly
  });

  test("recognizes bold/italic requests", () => {
    expect(canFastTransform("Make bold")).toBe(true);
    expect(canFastTransform("bold the header")).toBe(true);
    expect(canFastTransform("add italic")).toBe(true);
  });

  test("recognizes zebra stripe requests", () => {
    expect(canFastTransform("Add zebra stripes")).toBe(true);
    expect(canFastTransform("striped table")).toBe(true);
  });

  test("recognizes table border requests", () => {
    expect(canFastTransform("add a border")).toBe(true);
    expect(canFastTransform("add table border")).toBe(true);
  });

  test("recognizes border removal", () => {
    expect(canFastTransform("remove borders")).toBe(true);
    expect(canFastTransform("no border")).toBe(true);
  });

  test("recognizes font family requests", () => {
    expect(canFastTransform("change font to arial")).toBe(true);
    expect(canFastTransform("use monospace")).toBe(true);
  });

  test("rejects compound requests", () => {
    expect(canFastTransform("add thank you and signature")).toBe(false);
    expect(canFastTransform("add watermark and QR code")).toBe(false);
  });

  test("rejects complex AI-level requests", () => {
    expect(canFastTransform("Redesign the header to look like Stripe")).toBe(false);
    expect(canFastTransform("Add a professional cover page")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fastTransform
// ---------------------------------------------------------------------------
describe("fastTransform", () => {
  test("adds watermark with DRAFT text", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Add a DRAFT watermark");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("glyph-watermark");
    expect(result.html).toContain("DRAFT");
    expect(result.changes.length).toBeGreaterThan(0);
  });

  test("adds watermark defaults to DRAFT when no text specified", async () => {
    const result = await fastTransform(SAMPLE_HTML, "add watermark");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("DRAFT");
  });

  test("adds PAID watermark when specified", async () => {
    const result = await fastTransform(SAMPLE_HTML, "add paid watermark");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("PAID");
  });

  test("does not add duplicate watermark", async () => {
    const firstResult = await fastTransform(SAMPLE_HTML, "Add a DRAFT watermark");
    const secondResult = await fastTransform(firstResult.html, "Add a DRAFT watermark");
    expect(secondResult.transformed).toBe(true);
    expect(secondResult.changes[0]).toContain("already present");
  });

  test("adds QR code", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Add a QR code");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("glyph-qr-code");
    expect(result.html).toContain("svg");
  });

  test("adds QR code with custom URL", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Add QR code for https://example.com/pay");
    expect(result.transformed).toBe(true);
    expect(result.changes.some((c) => c.includes("https://example.com/pay"))).toBe(true);
  });

  test("does not add duplicate QR code", async () => {
    const firstResult = await fastTransform(SAMPLE_HTML, "Add a QR code");
    const secondResult = await fastTransform(firstResult.html, "Add a QR code");
    expect(secondResult.changes[0]).toContain("already present");
  });

  test("changes header color", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Make the header blue");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("#3b82f6");
  });

  test("adds zebra stripes to tables", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Add zebra stripes");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("nth-child");
    expect(result.html).toContain("glyph-zebra-stripes");
  });

  test("adds table borders", async () => {
    const result = await fastTransform(SAMPLE_HTML, "add a border");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("glyph-bordered-table");
  });

  test("changes font size bigger", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Make the title bigger");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("font-size");
    expect(result.html).toContain("120%");
  });

  test("applies bold styling", async () => {
    const result = await fastTransform(SAMPLE_HTML, "make bold");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("font-weight: bold");
  });

  test("removes borders", async () => {
    const result = await fastTransform(SAMPLE_HTML, "remove borders");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("border: none");
  });

  test("changes font family", async () => {
    const result = await fastTransform(SAMPLE_HTML, "use monospace");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("Courier");
  });

  test("adds signature", async () => {
    const result = await fastTransform(SAMPLE_HTML, "add signature");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("signature");
  });

  test("adds thank you message", async () => {
    const result = await fastTransform(SAMPLE_HTML, "add thank you message");
    expect(result.transformed).toBe(true);
    expect(result.html).toContain("glyph-thank-you");
  });

  test("returns transformed=false for unknown prompts", async () => {
    const result = await fastTransform(SAMPLE_HTML, "Redesign everything to look futuristic");
    expect(result.transformed).toBe(false);
    expect(result.html).toBe(SAMPLE_HTML);
  });

  test("returns transformed=false for compound requests", async () => {
    const result = await fastTransform(SAMPLE_HTML, "add watermark and QR code");
    expect(result.transformed).toBe(false);
  });
});
