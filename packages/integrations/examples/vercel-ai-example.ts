/**
 * Vercel AI SDK + Glyph End-to-End Example
 *
 * This example demonstrates how to use Glyph PDF generation tools with
 * the Vercel AI SDK. The tools integrate with generateText() and streamText().
 *
 * Prerequisites:
 *   npm install ai @ai-sdk/openai zod
 *   # Glyph integrations are in the parent directory
 *
 * Environment Variables:
 *   OPENAI_API_KEY - Your OpenAI API key
 *   GLYPH_API_KEY  - Your Glyph API key (gk_...)
 *
 * Run:
 *   npx ts-node examples/vercel-ai-example.ts
 */

import { generateText, streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { writeFileSync } from "fs";
import { glyphTools } from "../vercel-ai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

if (!GLYPH_API_KEY) {
  console.error("Error: GLYPH_API_KEY environment variable is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main Example: generateText with tools
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Vercel AI SDK + Glyph PDF Generation Example ===\n");

  // Get Glyph tools configured with API key
  const tools = glyphTools(GLYPH_API_KEY);

  // Step 1: Generate text with tool calling
  const userPrompt = `Create a professional contract document:
    - Contract #: CTR-2024-007
    - Between: TechVentures LLC and StartupCo Inc
    - Effective Date: February 1, 2024
    - Purpose: Software Development Services Agreement
    - Duration: 12 months
    - Monthly Rate: $15,000
    - Total Value: $180,000
    - Include standard payment terms (Net 30)`;

  console.log("User Prompt:", userPrompt);
  console.log("\n--- Calling Vercel AI SDK ---\n");

  const { text, toolResults, toolCalls } = await generateText({
    model: openai("gpt-4-turbo"),
    system:
      "You are a professional document assistant. Create high-quality " +
      "PDF documents when requested. Structure data properly for each document type.",
    prompt: userPrompt,
    tools,
    maxSteps: 3, // Allow up to 3 tool calls
  });

  // Step 2: Process results
  console.log("Text response:", text || "(No text response)");

  if (toolCalls && toolCalls.length > 0) {
    console.log(`\nTool calls made: ${toolCalls.length}`);
    for (const call of toolCalls) {
      console.log(`  - ${call.toolName}`);
    }
  }

  if (toolResults && toolResults.length > 0) {
    console.log("\n--- Tool Results ---");
    for (const result of toolResults) {
      console.log(`\nTool: ${result.toolName}`);

      const resultData = result.result as {
        success?: boolean;
        format?: string;
        size?: number;
        filename?: string;
        url?: string;
        sessionId?: string;
      };

      if (resultData.success) {
        console.log("  Status: Success");
        console.log(`  Format: ${resultData.format}`);
        console.log(`  Size: ${resultData.size} bytes`);
        console.log(`  Filename: ${resultData.filename}`);

        // Save PDF to disk
        if (resultData.url?.startsWith("data:")) {
          const base64Data = resultData.url.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          writeFileSync("vercel-ai-contract.pdf", buffer);
          console.log("  Saved to: vercel-ai-contract.pdf");
        }

        if (resultData.sessionId) {
          console.log(`  Session ID: ${resultData.sessionId}`);
        }
      } else {
        console.log("  Result:", JSON.stringify(resultData, null, 2));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming Example
// ---------------------------------------------------------------------------

async function streamingExample() {
  console.log("\n=== Streaming Example ===\n");

  const tools = glyphTools(GLYPH_API_KEY);

  const result = streamText({
    model: openai("gpt-4-turbo"),
    system: "You create PDF documents and explain what you're doing.",
    prompt: "Create a simple receipt for a $75 restaurant bill.",
    tools,
    maxSteps: 2,
  });

  console.log("Streaming response...\n");

  // Stream the text response
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
  console.log("\n");

  // Get final tool results
  const finalResult = await result;
  if (finalResult.toolResults && finalResult.toolResults.length > 0) {
    console.log("Tool results available");
    for (const tr of finalResult.toolResults) {
      const data = tr.result as { success?: boolean; filename?: string };
      if (data.success) {
        console.log(`  Generated: ${data.filename}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Multi-step Example: Create and Modify
// ---------------------------------------------------------------------------

async function multiStepExample() {
  console.log("\n=== Multi-step: Create and Modify ===\n");

  const tools = glyphTools(GLYPH_API_KEY);

  const { text, toolResults } = await generateText({
    model: openai("gpt-4-turbo"),
    system:
      "You create and modify PDF documents. When asked to create and modify, " +
      "first create the document, then use the sessionId to modify it.",
    prompt:
      "Create a shipping label for a package going to: " +
      "Jane Doe, 789 Pine Street, Seattle, WA 98101. " +
      "Weight: 2.5 lbs. Then add a FRAGILE stamp.",
    tools,
    maxSteps: 5, // Allow multiple tool calls for create + modify
  });

  console.log("Final text:", text || "(completed via tools)");

  if (toolResults) {
    console.log(`\nCompleted ${toolResults.length} tool operation(s)`);
    for (const result of toolResults) {
      const data = result.result as {
        success?: boolean;
        changes?: string[];
      };
      console.log(`  ${result.toolName}:`, data.success ? "OK" : data);
      if (data.changes) {
        console.log("    Changes:", data.changes.join(", "));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Template Listing Example
// ---------------------------------------------------------------------------

async function templateListExample() {
  console.log("\n=== Template Discovery ===\n");

  const tools = glyphTools(GLYPH_API_KEY);

  const { toolResults } = await generateText({
    model: openai("gpt-4-turbo"),
    prompt: "What quote templates are available? Show me the modern ones.",
    tools,
    maxSteps: 2,
  });

  if (toolResults) {
    for (const result of toolResults) {
      if (result.toolName === "listTemplates") {
        const data = result.result as {
          templates: Array<{
            id: string;
            name: string;
            description: string;
            category: string;
            style: string | null;
          }>;
          count: number;
        };

        console.log(`Found ${data.count} templates:\n`);
        for (const template of data.templates) {
          console.log(`  ${template.id}`);
          console.log(`    Name: ${template.name}`);
          console.log(`    Category: ${template.category}`);
          console.log(`    Style: ${template.style || "default"}`);
          console.log(`    ${template.description}\n`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Manual Tool Execution Example
// ---------------------------------------------------------------------------

async function manualToolExample() {
  console.log("\n=== Manual Tool Execution ===\n");

  const tools = glyphTools(GLYPH_API_KEY);

  // You can also call tools directly without an LLM
  console.log("Directly calling createPdf tool...\n");

  const result = await tools.createPdf.execute({
    data: {
      invoice: {
        number: "MANUAL-001",
        date: "2024-01-28",
        dueDate: "2024-02-28",
      },
      billTo: {
        name: "Direct API User",
        company: "Manual Testing Inc",
      },
      lineItems: [
        {
          description: "Direct tool call test",
          quantity: 1,
          rate: 100,
          amount: 100,
        },
      ],
      totals: {
        subtotal: 100,
        total: 100,
      },
    },
    style: "stripe-clean",
  });

  const pdfResult = result as {
    success: boolean;
    format: string;
    size: number;
    filename: string;
    url: string;
    sessionId?: string;
  };

  if (pdfResult.success) {
    console.log("Direct tool call succeeded!");
    console.log(`  Format: ${pdfResult.format}`);
    console.log(`  Size: ${pdfResult.size} bytes`);
    console.log(`  Filename: ${pdfResult.filename}`);

    if (pdfResult.url.startsWith("data:")) {
      const base64Data = pdfResult.url.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      writeFileSync("manual-invoice.pdf", buffer);
      console.log("  Saved to: manual-invoice.pdf");
    }
  }
}

// ---------------------------------------------------------------------------
// Run Examples
// ---------------------------------------------------------------------------

main()
  .then(() => streamingExample())
  .then(() => multiStepExample())
  .then(() => templateListExample())
  .then(() => manualToolExample())
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
