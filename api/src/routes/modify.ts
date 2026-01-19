/**
 * Modify Route
 * POST /v1/modify - Modify HTML via natural language
 *
 * Supports two modes:
 * 1. Session-based: Pass sessionId from /v1/preview to modify tracked HTML
 * 2. Direct: Pass html directly for one-off modifications
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  modifyTemplate,
  modifyHtml,
  validateModification,
} from "../services/ai.js";
import {
  validatePrompt,
  validateModification as validateGuardrails,
  sanitizeHtml,
} from "../services/guardrails.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import type { ApiError } from "../lib/types.js";
import "../types/hono.js"; // Import type extensions

const modify = new Hono();

// Session-based request schema (recommended)
const sessionModifySchema = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
  region: z.string().optional(),
});

// Direct HTML modification schema (legacy/simple mode)
const directModifySchema = z.object({
  html: z.string().min(1, "HTML content is required"),
  instruction: z.string().min(1, "Modification instruction is required"),
  context: z.record(z.unknown()).optional(),
});

modify.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Determine which mode we're in
    const isSessionMode = "sessionId" in body;

    if (isSessionMode) {
      // Session-based modification
      const parsed = sessionModifySchema.safeParse(body);
      if (!parsed.success) {
        const error: ApiError = {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        };
        return c.json(error, 400);
      }

      const { sessionId, prompt, region } = parsed.data;
      const apiKeyId = c.get("apiKeyId") as string | undefined;

      // Supabase required for session mode
      if (!supabase) {
        const error: ApiError = {
          error: "Session mode requires database configuration",
          code: "CONFIG_ERROR",
        };
        return c.json(error, 503);
      }

      // Get session
      const { data: session, error: sessionError } = await getSupabase()
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        return c.json({ error: "Session not found" }, 404);
      }

      // Check session not expired (sessions expire after 1 hour by default)
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return c.json({ error: "Session expired" }, 410);
      }

      // Verify session belongs to this API key (if we have auth)
      if (apiKeyId && session.api_key_id !== apiKeyId) {
        return c.json({ error: "Session not found" }, 404);
      }

      // GUARDRAIL: Validate prompt before calling AI
      const promptValidation = validatePrompt(prompt);
      if (!promptValidation.valid) {
        const error: ApiError = {
          error: promptValidation.reason || "Invalid prompt",
          code: "GUARDRAIL_VIOLATION",
          details: { category: promptValidation.category },
        };
        return c.json(error, 400);
      }

      // Call Claude to modify
      const result = await modifyTemplate(session.current_html, prompt, region);

      // GUARDRAIL: Validate the AI output
      const validation = validateModification(
        session.original_html,
        result.html
      );

      // Additional comprehensive guardrail validation
      const guardrailValidation = validateGuardrails(
        session.original_html,
        result.html
      );

      // Combine validation results
      const allIssues = [
        ...validation.issues,
        ...guardrailValidation.violations,
      ];
      const isFullyValid = validation.valid && guardrailValidation.valid;

      if (!isFullyValid) {
        console.warn("Guardrail violations detected:", allIssues);

        // For critical violations (security), reject the modification
        const criticalViolations = guardrailValidation.violations.filter(
          (v) =>
            v.includes("Script") ||
            v.includes("JavaScript") ||
            v.includes("iframe") ||
            v.includes("event handler")
        );

        if (criticalViolations.length > 0) {
          // Sanitize and use sanitized version
          result.html = sanitizeHtml(result.html);
          console.warn("Applied HTML sanitization due to:", criticalViolations);
        }
      }

      // Update session with new HTML and modification history
      const modifications = [
        ...(session.modifications || []),
        {
          prompt,
          region: region || null,
          timestamp: new Date().toISOString(),
          changes: result.changes,
        },
      ];

      const { error: updateError } = await getSupabase()
        .from("sessions")
        .update({
          current_html: result.html,
          modifications,
        })
        .eq("id", sessionId);

      if (updateError) {
        console.error("Session update error:", updateError);
      }

      // Track usage
      if (apiKeyId) {
        getSupabase()
          .from("usage")
          .insert({
            api_key_id: apiKeyId,
            endpoint: "modify",
            template: session.template,
            tokens_used: result.tokensUsed,
          })
          .then(({ error }) => {
            if (error) {
              console.error("Usage tracking error:", error);
            }
          });
      }

      return c.json({
        html: result.html,
        changes: result.changes,
        tokensUsed: result.tokensUsed,
        validationWarnings: allIssues.length > 0 ? allIssues : undefined,
      });
    } else {
      // Direct HTML modification (legacy mode)
      const parsed = directModifySchema.safeParse(body);
      if (!parsed.success) {
        const error: ApiError = {
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        };
        return c.json(error, 400);
      }

      const { html, instruction, context } = parsed.data;

      // GUARDRAIL: Validate prompt before calling AI
      const promptValidation = validatePrompt(instruction);
      if (!promptValidation.valid) {
        const error: ApiError = {
          error: promptValidation.reason || "Invalid instruction",
          code: "GUARDRAIL_VIOLATION",
          details: { category: promptValidation.category },
        };
        return c.json(error, 400);
      }

      // Call AI service to modify HTML
      const result = await modifyHtml({
        html,
        instruction,
        context,
      });

      // GUARDRAIL: Validate the AI output
      const guardrailValidation = validateGuardrails(html, result.html);

      if (!guardrailValidation.valid) {
        console.warn(
          "Direct mode guardrail violations:",
          guardrailValidation.violations
        );

        // For critical violations, sanitize
        const criticalViolations = guardrailValidation.violations.filter(
          (v) =>
            v.includes("Script") ||
            v.includes("JavaScript") ||
            v.includes("iframe") ||
            v.includes("event handler")
        );

        if (criticalViolations.length > 0) {
          result.html = sanitizeHtml(result.html);
        }
      }

      // Track usage if Supabase is configured
      const apiKeyId = c.get("apiKeyId") as string | undefined;
      if (supabase && apiKeyId) {
        getSupabase()
          .from("usage")
          .insert({
            api_key_id: apiKeyId,
            endpoint: "modify",
            template: "direct",
          })
          .then(({ error }) => {
            if (error) {
              console.error("Usage tracking error:", error);
            }
          });
      }

      return c.json({
        html: result.html,
        changes: result.changes,
        validationWarnings:
          guardrailValidation.violations.length > 0
            ? guardrailValidation.violations
            : undefined,
      });
    }
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
