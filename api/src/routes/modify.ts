/**
 * Modify Route
 * POST /v1/modify - Modify HTML via natural language
 */

import { Hono } from "hono";
import { z } from "zod";
import { modifyHtml } from "../services/ai.js";
import type { ModifyResponse, ApiError } from "../lib/types.js";

const modify = new Hono();

// Request validation schema
const modifySchema = z.object({
  html: z.string().min(1, "HTML content is required"),
  instruction: z.string().min(1, "Modification instruction is required"),
  context: z.record(z.unknown()).optional(),
});

modify.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const parsed = modifySchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { html, instruction, context } = parsed.data;

    // Call AI service to modify HTML
    const result: ModifyResponse = await modifyHtml({
      html,
      instruction,
      context: context as ModifyResponse["html"] extends string ? never : undefined,
    });

    return c.json(result);
  } catch (err) {
    console.error("Modify error:", err);

    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "MODIFY_ERROR",
    };
    return c.json(error, 500);
  }
});

export default modify;
