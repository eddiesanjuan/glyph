/**
 * LangChain + Glyph End-to-End Example
 *
 * This example demonstrates how to use Glyph PDF generation tools with
 * LangChain's agent framework. The tools integrate seamlessly with
 * LangChain's DynamicStructuredTool pattern.
 *
 * Prerequisites:
 *   npm install @langchain/openai @langchain/core langchain zod
 *   # Glyph integrations are in the parent directory
 *
 * Environment Variables:
 *   OPENAI_API_KEY - Your OpenAI API key (for ChatOpenAI)
 *   GLYPH_API_KEY  - Your Glyph API key (gk_...)
 *
 * Run:
 *   npx ts-node examples/langchain-example.ts
 */

import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { writeFileSync } from "fs";
import { createGlyphTools } from "../langchain";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

if (!GLYPH_API_KEY) {
  console.error("Error: GLYPH_API_KEY environment variable is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Create LangChain Tools from Glyph
// ---------------------------------------------------------------------------

function buildLangChainTools(): DynamicStructuredTool[] {
  // Get raw tool definitions from Glyph integration
  const glyphToolDefs = createGlyphTools(GLYPH_API_KEY);

  // Convert to LangChain DynamicStructuredTool instances
  return glyphToolDefs.map(
    (tool) =>
      new DynamicStructuredTool({
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        func: tool.func,
      })
  );
}

// ---------------------------------------------------------------------------
// Main Example: Simple Agent
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== LangChain + Glyph PDF Generation Example ===\n");

  // Step 1: Create the LLM and tools
  const llm = new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0,
  });

  const tools = buildLangChainTools();

  console.log(
    "Available tools:",
    tools.map((t) => t.name).join(", ")
  );
  console.log();

  // Step 2: Create a prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful assistant that creates professional PDF documents. " +
        "When users ask for invoices, quotes, receipts, or other documents, " +
        "use the available tools to generate high-quality PDFs.",
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  // Step 3: Create the agent
  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true, // Shows agent reasoning
  });

  // Step 4: Run the agent
  const userInput = `Create a professional invoice with:
    - Invoice Number: INV-LC-001
    - From: LangChain Solutions, 123 AI Street
    - To: DataFlow Inc, 456 ML Avenue
    - Items:
      * AI Integration Service - $5,000
      * Custom Model Training - $3,500
      * Documentation & Support - $1,500
    - Total: $10,000
    - Payment Terms: Net 30`;

  console.log("User Input:", userInput);
  console.log("\n--- Running Agent ---\n");

  const result = await agentExecutor.invoke({
    input: userInput,
  });

  console.log("\n--- Agent Output ---");
  console.log(result.output);

  // Check if a PDF was generated (look for base64 data in output)
  if (result.output.includes("data:application/pdf")) {
    const match = result.output.match(/data:application\/pdf;base64,[A-Za-z0-9+/=]+/);
    if (match) {
      const base64Data = match[0].split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      writeFileSync("langchain-invoice.pdf", buffer);
      console.log("\nPDF saved to: langchain-invoice.pdf");
    }
  }
}

// ---------------------------------------------------------------------------
// Advanced Example: Bind Tools Directly to Model
// ---------------------------------------------------------------------------

async function bindToolsExample() {
  console.log("\n=== Direct Tool Binding Example ===\n");

  const tools = buildLangChainTools();

  // Bind tools directly to the model (simpler than full agent)
  const llm = new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0,
  }).bindTools(tools);

  // Invoke with a simple request
  const response = await llm.invoke(
    "List all available PDF templates in the invoice category"
  );

  console.log("Response:", response);

  // Handle tool calls manually
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      console.log(`\nTool: ${toolCall.name}`);
      console.log(`Args: ${JSON.stringify(toolCall.args)}`);

      // Find and execute the matching tool
      const tool = tools.find((t) => t.name === toolCall.name);
      if (tool) {
        const result = await tool.invoke(toolCall.args);
        console.log(`Result: ${result}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Chain Example: Sequential PDF Creation and Modification
// ---------------------------------------------------------------------------

async function chainExample() {
  console.log("\n=== Chain Example: Create then Modify ===\n");

  const tools = buildLangChainTools();
  const llm = new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You help create and modify PDF documents. When asked to create and then " +
        "modify a document, first create it, note the sessionId, then modify it.",
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({ llm, tools, prompt });
  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 5, // Allow multiple tool calls
  });

  const result = await executor.invoke({
    input:
      "Create a simple receipt for $250 coffee supplies purchase. " +
      "Then add a 'THANK YOU' watermark and make the header green.",
  });

  console.log("\n--- Final Output ---");
  console.log(result.output);
}

// ---------------------------------------------------------------------------
// Template Schema Example
// ---------------------------------------------------------------------------

async function templateSchemaExample() {
  console.log("\n=== Template Schema Discovery ===\n");

  const tools = buildLangChainTools();

  // Find the schema tool
  const schemaTool = tools.find((t) => t.name === "get_template_schema");
  if (!schemaTool) {
    console.log("Schema tool not found");
    return;
  }

  // Get schema for invoice-clean template
  const result = await schemaTool.invoke({ templateId: "invoice-clean" });
  const schema = JSON.parse(result);

  console.log("Template: invoice-clean");
  console.log("Name:", schema.name);
  console.log("Description:", schema.description);
  console.log("\nSchema Fields:");
  console.log(JSON.stringify(schema.schema, null, 2));
  console.log("\nSample Data:");
  console.log(JSON.stringify(schema.sampleData, null, 2));
}

// ---------------------------------------------------------------------------
// Run Examples
// ---------------------------------------------------------------------------

main()
  .then(() => bindToolsExample())
  .then(() => chainExample())
  .then(() => templateSchemaExample())
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
