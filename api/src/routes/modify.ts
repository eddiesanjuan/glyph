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
} from "../services/ai.js";
import {
  validatePrompt,
  validateModification as validateGuardrails,
  sanitizeHtml,
} from "../services/guardrails.js";
import { templateEngine } from "../services/template.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import type { ApiError } from "../lib/types.js";
import { getDevSession, updateDevSession, isDevSessionId } from "../lib/devSessions.js";
import { validateModification as selfCheckValidation } from "../services/validator.js";

const modify = new Hono();

/**
 * GET /v1/modify/validation-status
 * Get the self-check validation status for a session
 *
 * This endpoint allows the frontend to poll for validation results
 * after a modification has been made.
 */
modify.get("/validation-status", async (c) => {
  try {
    const sessionId = c.req.query("sessionId");

    if (!sessionId) {
      return c.json({ error: "sessionId query parameter required" }, 400);
    }

    // Check if it's a dev session
    if (isDevSessionId(sessionId)) {
      const session = getDevSession(sessionId);
      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      return c.json({
        sessionId,
        validationResult: session.validation_result || null,
        hasAutoFix: !!session.suggested_fix_html,
        lastModification: session.modifications.length > 0
          ? session.modifications[session.modifications.length - 1]
          : null,
      });
    }

    // For database sessions, would need to query Supabase
    // For now, return not implemented for non-dev sessions
    return c.json({
      sessionId,
      validationResult: null,
      message: "Validation status for database sessions not yet implemented",
    });
  } catch (err) {
    console.error("Validation status error:", err);
    return c.json({ error: "Failed to get validation status" }, 500);
  }
});

/**
 * POST /v1/modify/apply-fix
 * Apply the auto-fix suggestion to a session
 */
modify.post("/apply-fix", async (c) => {
  try {
    const body = await c.req.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      return c.json({ error: "sessionId required" }, 400);
    }

    if (!isDevSessionId(sessionId)) {
      return c.json({ error: "Apply-fix only supported for dev sessions currently" }, 400);
    }

    const session = getDevSession(sessionId);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (!session.suggested_fix_html) {
      return c.json({ error: "No auto-fix available for this session" }, 400);
    }

    // Apply the fix
    updateDevSession(sessionId, {
      current_html: session.suggested_fix_html,
      template_html: session.suggested_fix_html,
      suggested_fix_html: undefined, // Clear after applying
      validation_result: {
        ...session.validation_result!,
        passed: true,
        hasAutoFix: false,
        validatedAt: new Date().toISOString(),
      },
      modifications: [
        ...session.modifications,
        {
          prompt: "[Auto-fix applied]",
          region: null,
          timestamp: new Date().toISOString(),
          changes: ["Applied automatic fixes for detected issues"],
        },
      ],
    });

    return c.json({
      success: true,
      html: session.suggested_fix_html,
      message: "Auto-fix applied successfully",
    });
  } catch (err) {
    console.error("Apply fix error:", err);
    return c.json({ error: "Failed to apply fix" }, 500);
  }
});

// Session-based request schema (recommended)
// Accepts both UUID format and dev_ prefixed IDs for development mode
const sessionModifySchema = z.object({
  sessionId: z.string().min(1).refine(
    (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || val.startsWith('dev_'),
    { message: "Session ID must be a UUID or development session ID" }
  ),
  prompt: z.string().min(1).max(1000),
  region: z.string().optional(),
  // Optional: client can provide current HTML to override server session state
  // This is critical for undo support - when user undoes, client has correct state
  // but server session may still have old state
  html: z.string().optional(),
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

      const { sessionId, prompt, region, html: clientHtml } = parsed.data;
      const apiKeyId = c.get("apiKeyId") as string | undefined;
      const isDevSession = isDevSessionId(sessionId);

      // Get session from database (if Supabase) or dev storage
      let session: {
        current_html: string;
        original_html: string;
        template_html: string;
        data: Record<string, unknown>;
        modifications: Array<{ prompt: string; region: string | null; timestamp: string; changes: string[] }>;
        template: string;
        api_key_id?: string;
        expires_at?: string;
      } | null = null;

      if (isDevSession) {
        // Get from in-memory storage (returns null if expired or not found)
        const devSession = getDevSession(sessionId);
        if (!devSession) {
          const error: ApiError = {
            error: "Development session not found or expired. In dev mode, sessions are stored in memory and may have been lost on server restart. Please create a new preview.",
            code: "DEV_SESSION_NOT_FOUND",
          };
          return c.json(error, 404);
        }
        session = devSession;
      } else if (supabase) {
        // Get from Supabase
        const { data, error: sessionError } = await getSupabase()
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError || !data) {
          const error: ApiError = {
            error: "Session not found. It may have expired or been deleted.",
            code: "SESSION_NOT_FOUND",
          };
          return c.json(error, 404);
        }
        session = data;
      } else {
        // No Supabase and not a dev session
        const error: ApiError = {
          error: "Database not configured. Use a development session ID (dev_*) for local testing.",
          code: "CONFIG_ERROR",
        };
        return c.json(error, 503);
      }

      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      // Check session not expired (sessions expire after 1 hour by default)
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        const error: ApiError = {
          error: "Session has expired. Please create a new preview to continue editing.",
          code: "SESSION_EXPIRED",
        };
        return c.json(error, 410);
      }

      // Verify session belongs to this API key (if we have auth and it's not a dev session)
      if (!isDevSession && apiKeyId && session.api_key_id !== apiKeyId) {
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

      // FIX: Send TEMPLATE HTML (with Mustache placeholders) to AI, not rendered HTML
      // This ensures AI modifications preserve the template structure
      // UNDO FIX: If client provides HTML, use it instead of server session state
      // This is critical for undo support - when user undoes, client has the correct state
      // but server session may still have the old (pre-undo) state
      const templateToModify = clientHtml || session.template_html || session.current_html;

      // Call Claude to modify the TEMPLATE (with Mustache vars preserved)
      const result = await modifyTemplate(templateToModify, prompt, region);

      // PERFORMANCE: Skip synchronous validation to return response faster
      // Background validation at line ~365 will catch issues asynchronously
      // Only do FAST security check for critical XSS/script injection
      let modifiedTemplateHtml = result.html;

      // FAST security check - only check for script injection (< 1ms)
      const hasScriptInjection = /<script/i.test(result.html) ||
        /javascript:/i.test(result.html) ||
        /<iframe/i.test(result.html) ||
        /\son\w+\s*=/i.test(result.html);

      if (hasScriptInjection) {
        modifiedTemplateHtml = sanitizeHtml(result.html);
        console.warn("[Security] Applied HTML sanitization for potential script injection");
      }

      // FIX: Re-render the modified template with the original data
      // This produces the final HTML with actual values for display
      let renderedHtml: string;
      try {
        renderedHtml = templateEngine.renderRaw(modifiedTemplateHtml, session.data);
      } catch (renderError) {
        console.error("Template re-render failed:", renderError);
        // If re-render fails, return the template HTML as-is
        // This shouldn't happen but provides a fallback
        renderedHtml = modifiedTemplateHtml;
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

      // Update session in appropriate storage
      // Store BOTH the modified template AND the rendered HTML
      if (isDevSession) {
        // Update in-memory dev session
        updateDevSession(sessionId, {
          current_html: renderedHtml,
          template_html: modifiedTemplateHtml,
          modifications,
        });
      } else if (supabase) {
        const { error: updateError } = await getSupabase()
          .from("sessions")
          .update({
            current_html: renderedHtml,
            template_html: modifiedTemplateHtml,
            modifications,
          })
          .eq("id", sessionId);

        if (updateError) {
          console.error("Session update error:", updateError);
        }
      }

      // Track usage (only for database sessions)
      if (!isDevSession && apiKeyId && supabase) {
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

      // SELF-CHECK: Run background validation after returning response
      // This is async and non-blocking - user gets instant response
      const originalTemplateForValidation = session.template_html || session.original_html;
      runBackgroundValidation(
        originalTemplateForValidation,
        modifiedTemplateHtml,
        prompt,
        sessionId
      );

      // Return the RENDERED HTML (with actual data) to the frontend
      // Note: Validation is now done asynchronously in background
      return c.json({
        html: renderedHtml,
        changes: result.changes,
        tokensUsed: result.tokensUsed,
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

      // SELF-CHECK: Run background validation (non-blocking)
      runBackgroundValidation(html, result.html, instruction, 'direct');

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

/**
 * Run background validation on a modification
 * This is non-blocking and runs after the response is returned to the user
 *
 * The validation results could be:
 * 1. Logged for monitoring
 * 2. Stored in database for dashboard
 * 3. Used to trigger alerts for critical issues
 * 4. Auto-fix HTML and notify user on next request
 */
async function runBackgroundValidation(
  beforeHtml: string,
  afterHtml: string,
  prompt: string,
  sessionId: string
): Promise<void> {
  // Use setImmediate to ensure this runs after response is sent
  setImmediate(async () => {
    try {
      console.log(`[SelfCheck] Starting validation for session: ${sessionId}`);

      const result = await selfCheckValidation(beforeHtml, afterHtml, prompt, {
        enableAiAnalysis: true,
        enableAutoFix: true,
      });

      // Log the validation result
      if (result.passed) {
        console.log(`[SelfCheck] PASSED (${result.validationTime}ms) - session: ${sessionId}`);
      } else {
        const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
        const warningCount = result.issues.filter(i => i.severity === 'warning').length;
        console.warn(
          `[SelfCheck] ISSUES FOUND (${result.validationTime}ms) - session: ${sessionId}`,
          `\n  Critical: ${criticalCount}, Warnings: ${warningCount}`
        );

        // Log each issue
        for (const issue of result.issues) {
          const icon = issue.severity === 'critical' ? '[!]' : '[~]';
          console.warn(`  ${icon} ${issue.type}: ${issue.description}`);
          if (issue.autoFixable && issue.suggestedFix) {
            console.info(`      -> Auto-fix: ${issue.suggestedFix}`);
          }
        }

        // If we have auto-fixed HTML, store it for potential use
        if (result.fixedHtml) {
          console.info(`  [SelfCheck] Auto-fixed HTML available for session: ${sessionId}`);
          // TODO: Store the fixed HTML in session or notify user via WebSocket
          // This could be implemented with:
          // 1. Session storage: updateDevSession(sessionId, { suggested_fix_html: result.fixedHtml })
          // 2. WebSocket notification to connected clients
          // 3. Store in Supabase for dashboard review
        }

        // For critical issues, we could:
        // 1. Send an alert (Slack, email, etc.)
        // 2. Flag the session for review
        // 3. Increment error metrics
        if (criticalCount > 0) {
          console.error(`[SelfCheck] CRITICAL: ${criticalCount} critical issues in session ${sessionId}`);
        }
      }

      // Store validation result in session for potential future API endpoint
      // This allows the frontend to poll for validation status
      const validationSummary = {
        passed: result.passed,
        criticalCount: result.issues.filter(i => i.severity === 'critical').length,
        warningCount: result.issues.filter(i => i.severity === 'warning').length,
        issues: result.issues.slice(0, 5), // Only store first 5 issues
        hasAutoFix: !!result.fixedHtml,
        validatedAt: new Date().toISOString(),
      };

      // Update dev session with validation result (if it's a dev session)
      if (isDevSessionId(sessionId)) {
        updateDevSession(sessionId, {
          validation_result: validationSummary,
          suggested_fix_html: result.fixedHtml,
        });
      }

    } catch (error) {
      console.error(`[SelfCheck] Validation error for session ${sessionId}:`, error);
    }
  });
}

export default modify;
