/**
 * OpenAI + Glyph End-to-End Example
 *
 * This example demonstrates how to use Glyph PDF generation tools with
 * OpenAI's function calling API. The AI agent decides when to generate
 * PDFs based on user requests.
 *
 * Prerequisites:
 *   npm install openai
 *   # Glyph integrations are in the parent directory
 *
 * Environment Variables:
 *   OPENAI_API_KEY  - Your OpenAI API key
 *   GLYPH_API_KEY   - Your Glyph API key (gk_...)
 *
 * Run:
 *   npx ts-node examples/openai-example.ts
 */

import OpenAI from "openai";
import { writeFileSync } from "fs";
import { glyphTools, handleGlyphToolCall } from "../openai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
  console.log("=== OpenAI + Glyph PDF Generation Example ===\n");

  // Step 1: Send a user request that requires PDF generation
  const userPrompt = `Create a professional invoice for:
    - Company: Acme Corp
    - Invoice #: INV-2024-001
    - Date: January 28, 2024
    - Due: February 28, 2024
    - Bill To: John Smith, TechStart Inc.
    - Line Items:
      1. Web Development - 40 hours @ $150/hr = $6,000
      2. UI/UX Design - 20 hours @ $125/hr = $2,500
      3. Server Setup - flat rate $500
    - Total: $9,000`;

  console.log("User Request:", userPrompt);
  console.log("\n--- Calling OpenAI with Glyph tools ---\n");

  // Step 2: Call OpenAI with Glyph tools available
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that creates professional PDF documents. " +
          "When asked to create invoices, quotes, or other documents, use the " +
          "create_pdf tool with properly structured data.",
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    tools: glyphTools,
    tool_choice: "auto",
  });

  const message = response.choices[0].message;

  // Step 3: Handle any tool calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log(`OpenAI requested ${message.tool_calls.length} tool call(s)\n`);

    for (const toolCall of message.tool_calls) {
      console.log(`Tool: ${toolCall.function.name}`);
      console.log(`Arguments: ${toolCall.function.arguments}\n`);

      // Execute the Glyph tool call
      const resultJson = await handleGlyphToolCall(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
        GLYPH_API_KEY
      );

      const result = JSON.parse(resultJson);

      if (result.success) {
        console.log("PDF Generated Successfully!");
        console.log(`  Format: ${result.format}`);
        console.log(`  Size: ${result.size} bytes`);
        console.log(`  Filename: ${result.filename}`);

        // Optionally save the PDF to disk
        if (result.url.startsWith("data:")) {
          const base64Data = result.url.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          writeFileSync("invoice-output.pdf", buffer);
          console.log("  Saved to: invoice-output.pdf");
        }

        // Session ID for modifications
        if (result.sessionId) {
          console.log(`  Session ID: ${result.sessionId}`);
          console.log("  (Use this to modify the document with natural language)");
        }
      } else {
        console.error("PDF Generation Failed:", result.error);
      }
    }
  } else {
    // No tool calls - AI responded with text
    console.log("AI Response:", message.content);
  }
}

// ---------------------------------------------------------------------------
// Advanced Example: Multi-turn conversation with modifications
// ---------------------------------------------------------------------------

async function advancedExample() {
  console.log("\n=== Advanced: Multi-turn with Modifications ===\n");

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant that creates and modifies PDF documents. " +
        "Use create_pdf to generate documents and modify_document to make changes.",
    },
    {
      role: "user",
      content: "Create a simple quote for consulting services, $5000 total.",
    },
  ];

  // First turn: Create the PDF
  const createResponse = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages,
    tools: glyphTools,
    tool_choice: "auto",
  });

  let sessionId: string | null = null;

  const createMessage = createResponse.choices[0].message;
  if (createMessage.tool_calls) {
    for (const toolCall of createMessage.tool_calls) {
      const resultJson = await handleGlyphToolCall(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
        GLYPH_API_KEY
      );

      const result = JSON.parse(resultJson);
      if (result.sessionId) {
        sessionId = result.sessionId;
        console.log("Created PDF with session:", sessionId);
      }

      // Add tool result to conversation
      messages.push(createMessage);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultJson,
      });
    }
  }

  // Second turn: Modify the PDF
  if (sessionId) {
    messages.push({
      role: "user",
      content: `Now modify the document (session ${sessionId}) to add a "DRAFT" watermark and change the header color to blue.`,
    });

    const modifyResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages,
      tools: glyphTools,
      tool_choice: "auto",
    });

    const modifyMessage = modifyResponse.choices[0].message;
    if (modifyMessage.tool_calls) {
      for (const toolCall of modifyMessage.tool_calls) {
        console.log(`Modifying document: ${toolCall.function.name}`);
        const resultJson = await handleGlyphToolCall(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          GLYPH_API_KEY
        );

        const result = JSON.parse(resultJson);
        if (result.changes) {
          console.log("Modifications applied:", result.changes);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run Examples
// ---------------------------------------------------------------------------

main()
  .then(() => advancedExample())
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
