#!/usr/bin/env node
/**
 * Glyph MCP Server
 *
 * AI-native PDF generation for Claude Code, Cursor, Windsurf, and other AI coding tools.
 *
 * This MCP server enables natural language document customization:
 * - Create professional PDFs from your data
 * - Modify documents with natural language ("add a QR code for payment")
 * - Get AI suggestions for document improvements
 *
 * Installation:
 *   npx @glyph-pdf/mcp-server
 *
 * Or add to Claude Code settings:
 *   {
 *     "mcpServers": {
 *       "glyph": {
 *         "command": "npx",
 *         "args": ["@glyph-pdf/mcp-server"],
 *         "env": { "GLYPH_API_KEY": "your-api-key" }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
  type ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOL_DEFINITIONS, handleTool } from "./tools.js";
import { RESOURCE_TEMPLATES, handleResource, listResources } from "./resources.js";

// Server metadata
const SERVER_INFO = {
  name: "glyph-mcp",
  version: "0.4.0",
  description: "AI-native PDF generation with Glyph",
};

// Create MCP server
const server = new Server(SERVER_INFO, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

// =============================================================================
// Tool Handlers
// =============================================================================

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_DEFINITIONS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  const result = await handleTool(name, args as Record<string, unknown>);

  return {
    content: result.content.map((item) => {
      if (item.type === "text" && item.text) {
        return { type: "text" as const, text: item.text };
      }
      if (item.type === "image" && item.data && item.mimeType) {
        return { type: "image" as const, data: item.data, mimeType: item.mimeType };
      }
      // Default to text
      return { type: "text" as const, text: item.text || "" };
    }),
    isError: result.isError,
  };
});

// =============================================================================
// Resource Handlers
// =============================================================================

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: listResources(),
  };
});

// List resource templates (for dynamic resources like sessions)
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: RESOURCE_TEMPLATES.map((t) => ({
      uriTemplate: t.uriTemplate,
      name: t.name,
      description: t.description,
      mimeType: t.mimeType,
    })),
  };
});

// Read a specific resource
server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => {
  const { uri } = request.params;
  const result = handleResource(uri);

  return {
    contents: result.contents.map((item) => ({
      uri: item.uri,
      mimeType: item.mimeType,
      text: item.text || "",
    })),
  };
});

// =============================================================================
// Server Startup
// =============================================================================

async function main() {
  // Check for API key
  if (!process.env.GLYPH_API_KEY) {
    console.error(
      "Warning: GLYPH_API_KEY not set. You can still use the server, but will need to pass apiKey in tool calls."
    );
  }

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP communication)
  console.error(`Glyph MCP Server v${SERVER_INFO.version} started`);
  console.error("Tools: glyph_preview, glyph_modify, glyph_generate, glyph_schema, glyph_templates, glyph_suggest, glyph_create, glyph_analyze");
  console.error("Saved Templates: glyph_templates_list, glyph_template_save, glyph_template_get, glyph_template_update, glyph_template_delete");
  console.error("Data Sources: glyph_create_source, glyph_list_sources, glyph_generate_from_source, glyph_suggest_mappings, glyph_link_template");
  console.error("Data-First: glyph_clone_template, glyph_create_session_from_mapping, glyph_save_template_from_session");
  console.error("Resources: glyph://templates, glyph://session/{id}/preview");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
