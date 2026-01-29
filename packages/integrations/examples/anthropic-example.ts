/**
 * Anthropic Claude + Glyph End-to-End Example
 *
 * This example demonstrates how to use Glyph PDF generation tools with
 * Anthropic's Claude API and its native tool use feature.
 *
 * Prerequisites:
 *   npm install @anthropic-ai/sdk
 *   # Glyph integrations are in the parent directory
 *
 * Environment Variables:
 *   ANTHROPIC_API_KEY - Your Anthropic API key
 *   GLYPH_API_KEY     - Your Glyph API key (gk_...)
 *
 * Run:
 *   npx ts-node examples/anthropic-example.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "fs";
import { glyphTools, handleGlyphToolCall } from "../anthropic";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

if (!GLYPH_API_KEY) {
  console.error("Error: GLYPH_API_KEY environment variable is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main Example
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Anthropic Claude + Glyph PDF Generation Example ===\n");

  // Step 1: Send a user request that requires PDF generation
  const userPrompt = `Generate a professional quote document for:
    - Quote #: Q-2024-0042
    - Client: Sarah Johnson, Innovate Labs
    - Valid Until: March 15, 2024
    - Services:
      1. Strategic Consulting - 3 days @ $2,500/day = $7,500
      2. Market Research Report - $3,000
      3. Competitor Analysis - $2,000
    - Subtotal: $12,500
    - Discount (10%): -$1,250
    - Total: $11,250

    Use a modern, clean style.`;

  console.log("User Request:", userPrompt);
  console.log("\n--- Calling Claude with Glyph tools ---\n");

  // Step 2: Call Claude with Glyph tools
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system:
      "You are a helpful assistant that creates professional PDF documents. " +
      "When asked to create quotes, invoices, or other business documents, " +
      "use the available tools to generate high-quality PDFs. Structure the " +
      "data properly according to the document type.",
    tools: glyphTools,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  console.log(`Stop reason: ${response.stop_reason}`);

  // Step 3: Process response content blocks
  for (const block of response.content) {
    if (block.type === "text") {
      console.log("\nClaude says:", block.text);
    } else if (block.type === "tool_use") {
      console.log(`\nTool Call: ${block.name}`);
      console.log(`Input: ${JSON.stringify(block.input, null, 2)}`);

      // Execute the Glyph tool
      const result = await handleGlyphToolCall(
        block.name,
        block.input as Record<string, unknown>,
        GLYPH_API_KEY
      );

      if ((result as { success?: boolean }).success) {
        const pdfResult = result as {
          success: boolean;
          format: string;
          size: number;
          filename: string;
          url: string;
          sessionId?: string;
        };

        console.log("\nPDF Generated Successfully!");
        console.log(`  Format: ${pdfResult.format}`);
        console.log(`  Size: ${pdfResult.size} bytes`);
        console.log(`  Filename: ${pdfResult.filename}`);

        // Save PDF to disk
        if (pdfResult.url.startsWith("data:")) {
          const base64Data = pdfResult.url.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          writeFileSync("quote-output.pdf", buffer);
          console.log("  Saved to: quote-output.pdf");
        }

        if (pdfResult.sessionId) {
          console.log(`  Session ID: ${pdfResult.sessionId}`);
        }
      } else {
        console.error("Tool error:", result);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Agentic Loop Example: Continue until task complete
// ---------------------------------------------------------------------------

async function agenticLoop() {
  console.log("\n=== Agentic Loop: Create and Modify PDF ===\n");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "First, create a simple receipt for a $150 purchase. " +
        "Then modify it to add 'PAID' watermark in green.",
    },
  ];

  let continueLoop = true;

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system:
        "You create and modify PDF documents. Complete all requested tasks " +
        "in sequence. After creating a document, you can modify it using " +
        "the sessionId returned from creation.",
      tools: glyphTools,
      messages,
    });

    console.log(`\n[Turn] Stop reason: ${response.stop_reason}`);

    // Collect tool results to send back
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log("Claude:", block.text);
      } else if (block.type === "tool_use") {
        console.log(`Executing: ${block.name}`);

        const result = await handleGlyphToolCall(
          block.name,
          block.input as Record<string, unknown>,
          GLYPH_API_KEY
        );

        console.log(
          "Result:",
          (result as { success?: boolean }).success ? "Success" : result
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    // If there were tool calls, continue the conversation
    if (toolResults.length > 0) {
      messages.push({
        role: "assistant",
        content: response.content,
      });
      messages.push({
        role: "user",
        content: toolResults,
      });
    }

    // Stop if Claude finished (end_turn) or there were no tool calls
    if (response.stop_reason === "end_turn" || toolResults.length === 0) {
      continueLoop = false;
    }
  }

  console.log("\nAgentic loop complete!");
}

// ---------------------------------------------------------------------------
// Template Discovery Example
// ---------------------------------------------------------------------------

async function discoverTemplates() {
  console.log("\n=== Template Discovery ===\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    tools: glyphTools,
    messages: [
      {
        role: "user",
        content:
          "What invoice templates are available? List them with their descriptions.",
      },
    ],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "list_pdf_templates") {
      const result = await handleGlyphToolCall(
        block.name,
        block.input as Record<string, unknown>,
        GLYPH_API_KEY
      );

      const templatesResult = result as {
        templates: Array<{
          id: string;
          name: string;
          description: string;
          category: string;
        }>;
        count: number;
      };

      console.log(`Found ${templatesResult.count} templates:\n`);
      for (const template of templatesResult.templates) {
        console.log(`  ${template.id}`);
        console.log(`    Name: ${template.name}`);
        console.log(`    Category: ${template.category}`);
        console.log(`    ${template.description}\n`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run Examples
// ---------------------------------------------------------------------------

main()
  .then(() => agenticLoop())
  .then(() => discoverTemplates())
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
