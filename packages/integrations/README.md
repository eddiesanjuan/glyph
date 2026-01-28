# Glyph Agent Framework Integrations

Copy-paste tool definitions that let AI agents generate PDFs via the Glyph API. Each file is self-contained -- no build step, no package install (except `zod` for LangChain/Vercel AI SDK).

## Available Integrations

| File | Framework | Format |
|------|-----------|--------|
| `openai.ts` | OpenAI Function Calling | `tools` array for `chat.completions.create()` |
| `anthropic.ts` | Anthropic Tool Use | `tools` array for `messages.create()` |
| `langchain.ts` | LangChain | `DynamicStructuredTool`-compatible objects |
| `vercel-ai.ts` | Vercel AI SDK | `tool()` objects for `generateText()` / `streamText()` |
| `types.ts` | Shared | TypeScript types + lightweight API client |

## Tools Provided

Every integration exposes the same four tools:

| Tool | Description |
|------|-------------|
| `create_pdf` | Generate a PDF from structured data, raw HTML, or a URL |
| `list_pdf_templates` | Discover available templates (invoice, quote, contract, etc.) |
| `get_template_schema` | Get the JSON Schema for a template to understand required fields |
| `modify_document` | Modify an existing document with natural language |

## Quick Start

### Prerequisites

1. Get a Glyph API key at [dashboard.glyph.you](https://dashboard.glyph.you)
2. Copy the integration file for your framework into your project
3. Also copy `types.ts` (shared dependency)

---

## OpenAI Function Calling

**Files needed:** `openai.ts`, `types.ts`

```typescript
import OpenAI from "openai";
import { glyphTools, handleGlyphToolCall } from "./openai";

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;
const openai = new OpenAI();

async function main() {
  // Step 1: Send user request with Glyph tools available
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a document assistant. Use the Glyph tools to generate professional PDFs.",
      },
      {
        role: "user",
        content:
          "Create an invoice for Acme Corp. 3 items: Website Design ($3,500), SEO Audit ($1,200), Content Strategy ($2,800). Due in 30 days.",
      },
    ],
    tools: glyphTools,
  });

  const message = response.choices[0].message;

  // Step 2: Handle tool calls
  if (message.tool_calls) {
    const toolMessages = [];

    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments);
      const result = await handleGlyphToolCall(
        call.function.name,
        args,
        GLYPH_API_KEY
      );

      toolMessages.push({
        role: "tool" as const,
        tool_call_id: call.id,
        content: result,
      });

      console.log(`Tool: ${call.function.name}`);
      console.log(`Result: ${result.substring(0, 200)}...`);
    }

    // Step 3: Get final response with tool results
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a document assistant. Use the Glyph tools to generate professional PDFs.",
        },
        {
          role: "user",
          content:
            "Create an invoice for Acme Corp. 3 items: Website Design ($3,500), SEO Audit ($1,200), Content Strategy ($2,800). Due in 30 days.",
        },
        message,
        ...toolMessages,
      ],
      tools: glyphTools,
    });

    console.log(finalResponse.choices[0].message.content);
  }
}

main();
```

### Multi-step flow (list templates, get schema, create PDF)

```typescript
import OpenAI from "openai";
import { glyphTools, handleGlyphToolCall } from "./openai";

const openai = new OpenAI();
const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

// Run a multi-turn conversation where the agent explores templates first
const messages: OpenAI.ChatCompletionMessageParam[] = [
  {
    role: "system",
    content:
      "You are a document assistant. Before creating a PDF, check what templates are available and understand the schema. Use Glyph tools.",
  },
  {
    role: "user",
    content: "I need to generate a professional quote document. What options do I have?",
  },
];

// Loop: let the model call tools until it produces a text response
let done = false;
while (!done) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    tools: glyphTools,
  });

  const choice = response.choices[0];
  messages.push(choice.message);

  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    for (const call of choice.message.tool_calls) {
      const result = await handleGlyphToolCall(
        call.function.name,
        JSON.parse(call.function.arguments),
        GLYPH_API_KEY
      );
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  } else {
    done = true;
    console.log(choice.message.content);
  }
}
```

---

## Anthropic Tool Use (Claude)

**Files needed:** `anthropic.ts`, `types.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { glyphTools, handleGlyphToolCall } from "./anthropic";

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;
const anthropic = new Anthropic();

async function main() {
  // Step 1: Send user request with Glyph tools
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system:
      "You are a document assistant. Use the Glyph tools to generate professional PDFs when the user asks for documents.",
    tools: glyphTools,
    messages: [
      {
        role: "user",
        content:
          "Generate a professional invoice for Northwind Traders. Items: Brand Identity Package ($4,500), Website Redesign ($8,000), Monthly Retainer x3 ($4,500). Due February 19, 2024.",
      },
    ],
  });

  // Step 2: Process tool use blocks
  const toolResults: Anthropic.ToolResultBlockParam[] = [];

  for (const block of response.content) {
    if (block.type === "tool_use") {
      console.log(`Calling tool: ${block.name}`);

      const result = await handleGlyphToolCall(
        block.name,
        block.input as Record<string, unknown>,
        GLYPH_API_KEY
      );

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Step 3: Send tool results back
  if (toolResults.length > 0) {
    const finalResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system:
        "You are a document assistant. Use the Glyph tools to generate professional PDFs.",
      tools: glyphTools,
      messages: [
        {
          role: "user",
          content:
            "Generate a professional invoice for Northwind Traders. Items: Brand Identity Package ($4,500), Website Redesign ($8,000), Monthly Retainer x3 ($4,500). Due February 19, 2024.",
        },
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ],
    });

    for (const block of finalResponse.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }
  }
}

main();
```

### Agentic loop with Claude

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { glyphTools, handleGlyphToolCall } from "./anthropic";

const anthropic = new Anthropic();
const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

async function agentLoop(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system:
        "You are a document assistant. Use Glyph tools to create and modify PDFs. " +
        "Always check available templates first, then get the schema, then create the PDF.",
      tools: glyphTools,
      messages,
    });

    // Check if the model wants to use tools
    const toolUseBlocks = response.content.filter(
      (b) => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No more tool calls -- print final text and exit
      for (const block of response.content) {
        if (block.type === "text") console.log(block.text);
      }
      break;
    }

    // Execute all tool calls
    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type === "tool_use") {
        const result = await handleGlyphToolCall(
          block.name,
          block.input as Record<string, unknown>,
          GLYPH_API_KEY
        );
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages.push({ role: "user", content: results });
  }
}

agentLoop(
  "Find a good certificate template, show me the schema, then create a certificate of achievement for Alexandra Chen from the Advanced Engineering Program."
);
```

---

## LangChain

**Files needed:** `langchain.ts`, `types.ts`
**Peer dependencies:** `zod`, `@langchain/core`, `@langchain/openai` (or another model provider)

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createGlyphTools } from "./langchain";

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

async function main() {
  // Step 1: Create Glyph tools
  const glyphToolDefs = createGlyphTools(GLYPH_API_KEY);

  // Step 2: Wrap as LangChain DynamicStructuredTools
  const tools = glyphToolDefs.map(
    (def) =>
      new DynamicStructuredTool({
        name: def.name,
        description: def.description,
        schema: def.schema,
        func: def.func,
      })
  );

  // Step 3: Create agent
  const model = new ChatOpenAI({ model: "gpt-4o" });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a document assistant. Use the Glyph tools to generate professional PDFs. " +
        "Always check available templates first when the user asks for a specific document type.",
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({ llm: model, tools, prompt });
  const executor = new AgentExecutor({ agent, tools, verbose: true });

  // Step 4: Run
  const result = await executor.invoke({
    input:
      "Create a shipping label from Memphis TN to San Francisco CA for a 3.2 lb package via UPS 2-Day Air.",
  });

  console.log(result.output);
}

main();
```

### Simple tool binding (without AgentExecutor)

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { createGlyphTools } from "./langchain";

const tools = createGlyphTools(process.env.GLYPH_API_KEY!).map(
  (def) =>
    new DynamicStructuredTool({
      name: def.name,
      description: def.description,
      schema: def.schema,
      func: def.func,
    })
);

const model = new ChatOpenAI({ model: "gpt-4o" }).bindTools(tools);

const response = await model.invoke([
  new HumanMessage("List all available invoice templates"),
]);

console.log(response);
```

---

## Vercel AI SDK

**Files needed:** `vercel-ai.ts`, `types.ts`
**Peer dependencies:** `zod`, `ai`, `@ai-sdk/openai` (or another provider)

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { glyphTools } from "./vercel-ai";

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

async function main() {
  const { text, toolResults } = await generateText({
    model: openai("gpt-4o"),
    system:
      "You are a document assistant. Use the Glyph tools to generate professional PDFs.",
    tools: glyphTools(GLYPH_API_KEY),
    prompt:
      "Create a professional business letter from Michael Torres at Cascade Partners to Sarah Chen at Horizon Dynamics about a strategic partnership proposal.",
    maxSteps: 5, // Allow multi-step tool calling
  });

  console.log("Final text:", text);

  for (const result of toolResults) {
    console.log(`Tool: ${result.toolName}`);
    console.log(`Result:`, JSON.stringify(result.result).substring(0, 200));
  }
}

main();
```

### Streaming with Vercel AI SDK

```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { glyphTools } from "./vercel-ai";

const GLYPH_API_KEY = process.env.GLYPH_API_KEY!;

async function main() {
  const result = streamText({
    model: openai("gpt-4o"),
    system: "You are a document assistant with Glyph PDF tools.",
    tools: glyphTools(GLYPH_API_KEY),
    prompt: "Generate a receipt for The Daily Grind coffee shop. 2 lattes and a croissant.",
    maxSteps: 3,
  });

  // Stream text chunks as they arrive
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
}

main();
```

### Next.js API Route (App Router)

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { glyphTools } from "@/lib/glyph/vercel-ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: "You are a document assistant with PDF generation capabilities.",
    tools: glyphTools(process.env.GLYPH_API_KEY!),
    messages,
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
```

---

## API Reference

All integrations call the Glyph REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/create` | POST | One-shot data-to-PDF generation |
| `/v1/generate` | POST | Convert HTML to PDF/PNG |
| `/v1/templates` | GET | List available templates |
| `/v1/templates/:id` | GET | Get template detail + schema |
| `/v1/templates/:id/schema` | GET | Get JSON Schema only |
| `/v1/modify` | POST | AI-powered document modification |
| `/v1/preview` | POST | Create HTML preview session |

**Base URL:** `https://api.glyph.you`
**Auth:** `Authorization: Bearer gk_your_api_key`
**Docs:** [docs.glyph.you](https://docs.glyph.you)

## Available Templates

| ID | Category | Description |
|----|----------|-------------|
| `quote-modern` | quote | Clean, minimal quote with sans-serif fonts |
| `quote-bold` | quote | High-impact modern design |
| `quote-professional` | quote | Traditional business style |
| `invoice-clean` | invoice | Structured invoice with line items and totals |
| `receipt-minimal` | receipt | Compact receipt layout |
| `report-cover` | report | Professional cover page |
| `contract-simple` | contract | Service agreement with clauses and signatures |
| `certificate-modern` | certificate | Elegant achievement certificate |
| `letter-business` | letter | Professional business letter |
| `proposal-basic` | proposal | Project proposal with deliverables and pricing |
| `shipping-label` | shipping | Standard 4x6 shipping label |

## Error Handling

All handler functions catch errors and return structured error objects:

```json
{
  "error": "Template 'foo' not found",
  "code": "TEMPLATE_NOT_FOUND"
}
```

The `GlyphApiError` class in `types.ts` provides typed error handling:

```typescript
import { GlyphApiError } from "./types";

try {
  await client.createPdf({ data: {} });
} catch (err) {
  if (err instanceof GlyphApiError) {
    console.error(`[${err.code}] ${err.message} (HTTP ${err.status})`);
  }
}
```
