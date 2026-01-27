/**
 * Modify Route
 * POST /v1/modify - Modify HTML via natural language
 *
 * Supports two modes:
 * 1. Session-based: Pass sessionId from /v1/preview to modify tracked HTML
 * 2. Direct: Pass html directly for one-off modifications
 */

import { createHash } from "crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
  modifyTemplate,
  modifyTemplateStream,
  parseAiResponse,
  modifyHtml,
  validateRequestFeasibility,
  isSimpleModification,
} from "../services/ai.js";
import {
  validatePrompt,
  validateModification as validateGuardrails,
  sanitizeHtml,
} from "../services/guardrails.js";
import { repairHtml, isHtmlTruncated, getFriendlyIssueDescription } from "../services/validator.js";
import { templateEngine } from "../services/template.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import type { ApiError } from "../lib/types.js";
import { getDevSession, updateDevSession, isDevSessionId, findTemplateForRenderedHtml, addTemplateToHistory } from "../lib/devSessions.js";
import { validateModification as selfCheckValidation } from "../services/validator.js";
import { canFastTransform, fastTransform } from "../services/fastTransform.js";
import type { Context } from "hono";
import { triggerEventSubscriptions } from "./subscriptions.js";
import { fireNotificationWebhooks } from "../services/notificationWebhooks.js";

// --- AI Response Cache (LRU, 100 entries, 10-minute TTL) ---

interface CacheEntry {
  html: string;           // Modified template HTML (pre-render)
  changes: string[];
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  createdAt: number;
}

const AI_CACHE = new Map<string, CacheEntry>();
const AI_CACHE_MAX = 100;
const AI_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cacheHits = 0;
let cacheMisses = 0;

function aiCacheKey(templateHtml: string, prompt: string, regionId: string | undefined): string {
  const raw = templateHtml + "\x00" + prompt + "\x00" + (regionId || "");
  return createHash("sha256").update(raw).digest("hex");
}

function aiCacheGet(key: string): CacheEntry | null {
  const entry = AI_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > AI_CACHE_TTL_MS) {
    AI_CACHE.delete(key);
    return null;
  }
  // Move to end (most recently used)
  AI_CACHE.delete(key);
  AI_CACHE.set(key, entry);
  cacheHits++;
  return entry;
}

function aiCacheSet(key: string, entry: CacheEntry): void {
  // Evict oldest if at capacity
  if (AI_CACHE.size >= AI_CACHE_MAX) {
    const oldest = AI_CACHE.keys().next().value;
    if (oldest !== undefined) AI_CACHE.delete(oldest);
  }
  AI_CACHE.set(key, entry);
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of AI_CACHE) {
    if (now - entry.createdAt > AI_CACHE_TTL_MS) {
      AI_CACHE.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
  // Note: html field is accepted but ignored - server always uses template_html
  // to ensure Mustache placeholders are preserved for AI modification
  html: z.string().optional(),
});

// Direct HTML modification schema (legacy/simple mode)
const directModifySchema = z.object({
  html: z.string().min(1, "HTML content is required"),
  instruction: z.string().min(1, "Modification instruction is required"),
  context: z.record(z.unknown()).optional(),
});

modify.post("/", async (c) => {
  // Check if streaming is requested
  const wantsStream = c.req.query("stream") === "true";

  if (wantsStream) {
    return handleStreamingModify(c);
  }

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
      const isDevSession = isDevSessionId(sessionId);
      const t0 = Date.now();
      const timings: Record<string, number> = {};

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

      // PRE-FLIGHT CHECK: Detect impossible requests early (2-5 seconds vs 60 second timeout)
      // This catches requests like "make this 3D and animated" before wasting time
      const tFeasibility = Date.now();
      const feasibilityCheck = await validateRequestFeasibility(prompt);
      timings.feasibility = Date.now() - tFeasibility;
      if (!feasibilityCheck.feasible) {
        console.log(`[Modify] Request rejected as infeasible (${feasibilityCheck.checkTimeMs}ms): "${prompt.substring(0, 50)}..."`);
        const error: ApiError = {
          error: feasibilityCheck.reason || "This modification is not possible for PDF documents.",
          code: "REQUEST_NOT_FEASIBLE",
          details: {
            suggestion: feasibilityCheck.suggestion,
            checkTimeMs: feasibilityCheck.checkTimeMs,
          },
        };
        return c.json(error, 400);
      }

      // CRITICAL FIX: Clear stale validation results before starting new modification
      // This prevents the "Quick Fix Available" modal from showing results from previous modifications
      // The new validation will populate these fields after it completes in the background
      if (isDevSession) {
        updateDevSession(sessionId, {
          validation_result: undefined,
          suggested_fix_html: undefined,
        });
      }

      // Determine which template to use for AI modifications
      // The template HTML contains Mustache placeholders that AI must preserve
      //
      // UNDO SUPPORT: If client sends HTML that differs from current session state,
      // it means the client did an undo operation. We need to find the matching
      // template from history and use that instead of the current template.
      let templateToModify = session.template_html || session.current_html;

      const clientHtml = parsed.data.html;
      if (isDevSession && clientHtml && clientHtml !== session.current_html) {
        // Client state differs from server state - likely due to undo
        console.info(`[Modify] Client HTML differs from server state - checking history for undo support`);
        const matchingTemplate = findTemplateForRenderedHtml(sessionId, clientHtml);
        if (matchingTemplate) {
          console.info(`[Modify] Found matching template in history - using for modification`);
          templateToModify = matchingTemplate;
        } else {
          // No matching template found - fall back to original template
          // This handles edge cases where history was truncated
          console.warn(`[Modify] No matching template in history - falling back to original template`);
          templateToModify = session.original_html;
        }
      }

      // Check AI response cache before calling Claude
      const cacheKey = aiCacheKey(templateToModify, prompt, region);
      const cachedResult = aiCacheGet(cacheKey);

      if (cachedResult) {
        // CACHE HIT - skip AI call entirely
        const tTotal = Date.now() - t0;
        timings.cache = 0;
        timings.total = tTotal;
        console.log(`[perf:modify] CACHE HIT key=${cacheKey.substring(0, 12)}... saved AI call`);

        // Re-render cached template with session data
        let renderedHtml: string;
        try {
          renderedHtml = templateEngine.renderRaw(cachedResult.html, session.data);
        } catch {
          renderedHtml = cachedResult.html;
        }

        // Update session
        const modifications = [
          ...(session.modifications || []),
          {
            prompt,
            region: region || null,
            timestamp: new Date().toISOString(),
            changes: cachedResult.changes,
          },
        ];

        if (isDevSession) {
          updateDevSession(sessionId, {
            current_html: renderedHtml,
            template_html: cachedResult.html,
            modifications,
          });
          addTemplateToHistory(sessionId, cachedResult.html, renderedHtml);
        } else if (supabase) {
          await getSupabase()
            .from("sessions")
            .update({
              current_html: renderedHtml,
              template_html: cachedResult.html,
              modifications,
            })
            .eq("id", sessionId);
        }

        c.header('Server-Timing', Object.entries(timings).map(([k, v]) => `${k};dur=${v}`).join(', '));

        return c.json({
          html: renderedHtml,
          changes: cachedResult.changes,
          tokensUsed: cachedResult.tokensUsed,
          usage: {
            promptTokens: cachedResult.inputTokens,
            completionTokens: cachedResult.outputTokens,
            totalTokens: cachedResult.inputTokens + cachedResult.outputTokens,
            processingTimeMs: tTotal,
            cached: true,
            cacheStats: { hits: cacheHits, misses: cacheMisses, size: AI_CACHE.size },
            model: cachedResult.model,
            fastTransform: false,
          },
        });
      }

      // CACHE MISS
      cacheMisses++;

      // Call Claude to modify the TEMPLATE (with Mustache vars preserved)
      // With automatic retry if HTML appears truncated or malformed
      const tAi = Date.now();
      let result = await modifyTemplate(templateToModify, prompt, region);
      timings.ai = Date.now() - tAi;
      let modifiedTemplateHtml = result.html;

      // Check if HTML appears truncated and needs repair
      if (isHtmlTruncated(result.html)) {
        console.warn("[Modify] HTML appears truncated, attempting repair...");

        // First try to repair the HTML
        const repairResult = repairHtml(result.html);
        if (repairResult.repairsApplied.length > 0) {
          console.log(`[Modify] Applied HTML repairs: ${repairResult.repairsApplied.join(', ')}`);
          modifiedTemplateHtml = repairResult.html;
        }

        // If still seems broken after repair, retry with enhanced prompt
        if (isHtmlTruncated(modifiedTemplateHtml)) {
          console.warn("[Modify] HTML still appears truncated after repair, retrying with AI...");

          // Retry with an enhanced prompt emphasizing complete output
          const retryPrompt = `${prompt}

CRITICAL: You MUST output the COMPLETE HTML document from <!DOCTYPE html> to </html>.
Do NOT truncate or cut off the output. Include ALL closing tags.`;

          try {
            const retryResult = await modifyTemplate(templateToModify, retryPrompt, region);
            if (!isHtmlTruncated(retryResult.html)) {
              console.log("[Modify] Retry successful - got complete HTML");
              result = retryResult;
              modifiedTemplateHtml = retryResult.html;
            } else {
              // Apply repair to retry result as fallback
              const retryRepair = repairHtml(retryResult.html);
              modifiedTemplateHtml = retryRepair.html;
              console.log("[Modify] Retry also truncated, using repaired version");
            }
          } catch (retryError) {
            console.error("[Modify] Retry failed:", retryError);
            // Continue with repaired original
          }
        }
      } else {
        // Even non-truncated HTML might benefit from light repairs
        const repairResult = repairHtml(result.html);
        if (repairResult.repairsApplied.length > 0) {
          console.log(`[Modify] Applied minor HTML repairs: ${repairResult.repairsApplied.join(', ')}`);
          modifiedTemplateHtml = repairResult.html;
        }
      }

      // FAST security check - only check for script injection (< 1ms)
      const hasScriptInjection = /<script/i.test(modifiedTemplateHtml) ||
        /javascript:/i.test(modifiedTemplateHtml) ||
        /<iframe/i.test(modifiedTemplateHtml) ||
        /\son\w+\s*=/i.test(modifiedTemplateHtml);

      if (hasScriptInjection) {
        modifiedTemplateHtml = sanitizeHtml(modifiedTemplateHtml);
        console.warn("[Security] Applied HTML sanitization for potential script injection");
      }

      // CRITICAL: Check for content loss / document corruption / unprofessional content BEFORE returning
      // This catches cases where AI deleted most content, replaced with explanatory text, or added gimmicky elements
      const tSelfcheck = Date.now();
      const guardrailResult = validateGuardrails(templateToModify, modifiedTemplateHtml);
      timings.selfcheck = Date.now() - tSelfcheck;
      if (!guardrailResult.valid) {
        const contentLossViolation = guardrailResult.violations.find(v =>
          v.includes('content loss') || v.includes('improperly cleared')
        );

        if (contentLossViolation) {
          console.error(`[Security] Content loss detected: ${contentLossViolation}`);
          console.error(`[Security] Rejecting corrupted response and returning original template`);

          // Return the original template instead of corrupted one
          const error: ApiError = {
            error: "This type of modification cannot be applied. The AI attempted to remove document content which is not allowed. Please try a styling or layout change instead.",
            code: "CONTENT_LOSS_BLOCKED",
          };
          return c.json(error, 400);
        }

        // CRITICAL: Block unprofessional/gimmicky content that degrades document quality
        // This prevents AI from adding celebration banners, confetti, sparkles, etc.
        const unprofessionalViolation = guardrailResult.violations.find(v =>
          v.includes('Unprofessional content') ||
          v.includes('Celebration') ||
          v.includes('Confetti') ||
          v.includes('Gimmicky animation') ||
          v.includes('Sparkle') ||
          v.includes('Fireworks') ||
          v.includes('Rainbow') ||
          v.includes('Marquee') ||
          v.includes('Blink') ||
          v.includes('Comic Sans') ||
          v.includes('Papyrus')
        );

        if (unprofessionalViolation) {
          console.error(`[Security] Unprofessional content blocked: ${unprofessionalViolation}`);

          const error: ApiError = {
            error: "This modification would add unprofessional elements to your document. Glyph maintains professional document standards - please try a different styling approach.",
            code: "UNPROFESSIONAL_CONTENT_BLOCKED",
          };
          return c.json(error, 400);
        }

        // Log other violations but don't block
        console.warn(`[Security] Guardrail violations detected: ${guardrailResult.violations.join(', ')}`);
      }

      // Store successful AI result in cache (only if guardrails passed and not fast-transform)
      if (!result.fastTransform) {
        aiCacheSet(cacheKey, {
          html: modifiedTemplateHtml,
          changes: result.changes,
          tokensUsed: result.tokensUsed,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          model: result.model || "unknown",
          createdAt: Date.now(),
        });
        console.log(`[cache:modify] Stored key=${cacheKey.substring(0, 12)}... size=${AI_CACHE.size}`);
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

        // UNDO SUPPORT: Add this template state to history
        // This allows finding the template when client undos to this state
        addTemplateToHistory(sessionId, modifiedTemplateHtml, renderedHtml);
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

      // Trigger event subscriptions (fire and forget)
      triggerEventSubscriptions("template.modified", {
        sessionId,
        prompt,
        region: region || null,
        changes: result.changes,
      });

      // Fire notification webhooks (fire and forget)
      fireNotificationWebhooks("modify.completed", {
        session_id: sessionId,
        prompt,
        selfCheckPassed: true,
      });

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

      // Performance logging and Server-Timing header
      timings.total = Date.now() - t0;
      c.header('Server-Timing', Object.entries(timings).map(([k, v]) => `${k};dur=${v}`).join(', '));
      console.log(`[perf:modify] ${Object.entries(timings).map(([k, v]) => `${k}=${v}ms`).join(' ')}`);

      // Return the RENDERED HTML (with actual data) to the frontend
      // Note: Validation is now done asynchronously in background
      return c.json({
        html: renderedHtml,
        changes: result.changes,
        tokensUsed: result.tokensUsed,
        usage: {
          promptTokens: result.inputTokens,
          completionTokens: result.outputTokens,
          totalTokens: result.inputTokens + result.outputTokens,
          processingTimeMs: timings.total,
          cached: false,
          cacheStats: { hits: cacheHits, misses: cacheMisses, size: AI_CACHE.size },
          model: result.model,
          fastTransform: result.fastTransform,
        },
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

      // PRE-FLIGHT CHECK: Detect impossible requests early
      const feasibilityCheck = await validateRequestFeasibility(instruction);
      if (!feasibilityCheck.feasible) {
        console.log(`[Modify] Direct mode request rejected as infeasible (${feasibilityCheck.checkTimeMs}ms)`);
        const error: ApiError = {
          error: feasibilityCheck.reason || "This modification is not possible for PDF documents.",
          code: "REQUEST_NOT_FEASIBLE",
          details: {
            suggestion: feasibilityCheck.suggestion,
            checkTimeMs: feasibilityCheck.checkTimeMs,
          },
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
      // Convert technical descriptions to friendly messages for the user
      // Then deduplicate based on friendly message to avoid showing the same message twice
      const friendlyIssues = result.issues.slice(0, 5).map(issue => ({
        ...issue,
        description: getFriendlyIssueDescription(issue),
      }));

      // Deduplicate issues with identical friendly messages
      // This prevents showing "Some content may have been affected" twice
      const seenDescriptions = new Set<string>();
      const deduplicatedIssues = friendlyIssues.filter(issue => {
        const key = `${issue.severity}:${issue.description}`;
        if (seenDescriptions.has(key)) {
          return false;
        }
        seenDescriptions.add(key);
        return true;
      });

      const validationSummary = {
        passed: result.passed,
        criticalCount: deduplicatedIssues.filter(i => i.severity === 'critical').length,
        warningCount: deduplicatedIssues.filter(i => i.severity === 'warning').length,
        issues: deduplicatedIssues, // Use deduplicated friendly descriptions for the user
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

/**
 * Handle streaming modification requests
 * Returns SSE stream with events: start, delta, changes, complete, error
 */
async function handleStreamingModify(c: Context) {
  return streamSSE(c, async (stream) => {
    try {
      // Parse and validate request (same as synchronous path)
      const body = await c.req.json();

      // Only support session mode for streaming
      if (!("sessionId" in body)) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "Streaming only supported for session-based modifications",
            code: "VALIDATION_ERROR",
          }),
        });
        return;
      }

      const parsed = sessionModifySchema.safeParse(body);
      if (!parsed.success) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          }),
        });
        return;
      }

      const { sessionId, prompt, region } = parsed.data;
      const apiKeyId = c.get("apiKeyId") as string | undefined;
      const isDevSession = isDevSessionId(sessionId);

      // Get session from storage
      let session: {
        current_html: string;
        original_html: string;
        template_html: string;
        data: Record<string, unknown>;
        modifications: Array<{
          prompt: string;
          region: string | null;
          timestamp: string;
          changes: string[];
        }>;
        template: string;
        api_key_id?: string;
        expires_at?: string;
      } | null = null;

      if (isDevSession) {
        const devSession = getDevSession(sessionId);
        if (!devSession) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              error: "Development session not found or expired. Please create a new preview.",
              code: "DEV_SESSION_NOT_FOUND",
            }),
          });
          return;
        }
        session = devSession;
      } else if (supabase) {
        const { data, error: sessionError } = await getSupabase()
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError || !data) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              error: "Session not found. It may have expired or been deleted.",
              code: "SESSION_NOT_FOUND",
            }),
          });
          return;
        }
        session = data;
      } else {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "Database not configured. Use a development session ID (dev_*) for local testing.",
            code: "CONFIG_ERROR",
          }),
        });
        return;
      }

      if (!session) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: "Session not found", code: "SESSION_NOT_FOUND" }),
        });
        return;
      }

      // Check session not expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: "Session has expired. Please create a new preview to continue editing.",
            code: "SESSION_EXPIRED",
          }),
        });
        return;
      }

      // Verify session belongs to this API key
      if (!isDevSession && apiKeyId && session.api_key_id !== apiKeyId) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: "Session not found", code: "SESSION_NOT_FOUND" }),
        });
        return;
      }

      // GUARDRAIL: Validate prompt before calling AI
      const promptValidation = validatePrompt(prompt);
      if (!promptValidation.valid) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: promptValidation.reason || "Invalid prompt",
            code: "GUARDRAIL_VIOLATION",
            category: promptValidation.category,
          }),
        });
        return;
      }

      // PRE-FLIGHT CHECK: Detect impossible requests early
      const feasibilityCheck = await validateRequestFeasibility(prompt);
      if (!feasibilityCheck.feasible) {
        console.log(`[Streaming] Request rejected as infeasible (${feasibilityCheck.checkTimeMs}ms): "${prompt.substring(0, 50)}..."`);
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            error: feasibilityCheck.reason || "This modification is not possible for PDF documents.",
            code: "REQUEST_NOT_FEASIBLE",
            suggestion: feasibilityCheck.suggestion,
          }),
        });
        return;
      }

      // Clear stale validation results
      if (isDevSession) {
        updateDevSession(sessionId, {
          validation_result: undefined,
          suggested_fix_html: undefined,
        });
      }

      // Determine which template to use
      let templateToModify = session.template_html || session.current_html;

      const clientHtml = parsed.data.html;
      if (isDevSession && clientHtml && clientHtml !== session.current_html) {
        console.info(`[Streaming] Client HTML differs - checking history for undo support`);
        const matchingTemplate = findTemplateForRenderedHtml(sessionId, clientHtml);
        if (matchingTemplate) {
          templateToModify = matchingTemplate;
        } else {
          templateToModify = session.original_html;
        }
      }

      // FAST PATH CHECK: Handle instantly without streaming
      const streamStartTime = Date.now();
      if (canFastTransform(prompt)) {
        const fastResult = await fastTransform(templateToModify, prompt);
        if (fastResult.transformed) {
          console.log(`[Streaming FAST] Transformed: "${prompt.substring(0, 50)}..."`);

          // Render with data
          let renderedHtml: string;
          try {
            renderedHtml = templateEngine.renderRaw(fastResult.html, session.data);
          } catch {
            renderedHtml = fastResult.html;
          }

          // Update session
          const modifications = [
            ...(session.modifications || []),
            {
              prompt,
              region: region || null,
              timestamp: new Date().toISOString(),
              changes: fastResult.changes,
            },
          ];

          if (isDevSession) {
            updateDevSession(sessionId, {
              current_html: renderedHtml,
              template_html: fastResult.html,
              modifications,
            });
            addTemplateToHistory(sessionId, fastResult.html, renderedHtml);
          } else if (supabase) {
            await getSupabase()
              .from("sessions")
              .update({
                current_html: renderedHtml,
                template_html: fastResult.html,
                modifications,
              })
              .eq("id", sessionId);
          }

          // Emit complete event immediately for fast path
          await stream.writeSSE({
            event: "complete",
            data: JSON.stringify({
              html: renderedHtml,
              changes: fastResult.changes,
              tokensUsed: 0,
              fastPath: true,
              usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                processingTimeMs: Date.now() - streamStartTime,
                cached: false,
                model: "none",
                fastTransform: true,
              },
            }),
          });
          return;
        }
      }

      // STREAMING AI PATH
      const model = isSimpleModification(prompt)
        ? "claude-3-5-haiku-20241022"
        : "claude-sonnet-4-20250514";

      // Emit start event
      await stream.writeSSE({
        event: "start",
        data: JSON.stringify({
          sessionId,
          model,
          estimatedTime: model.includes("haiku") ? 3000 : 8000,
        }),
      });

      // Stream AI response
      let fullResponse = "";
      let chunkIndex = 0;

      for await (const chunk of modifyTemplateStream(templateToModify, prompt, region)) {
        fullResponse += chunk.text;

        // Emit delta for each text chunk
        if (chunk.text.length > 0) {
          await stream.writeSSE({
            event: "delta",
            data: JSON.stringify({ html: chunk.text, index: chunkIndex++ }),
          });
        }
      }

      // Parse final response
      const result = parseAiResponse(fullResponse);
      let modifiedTemplateHtml = result.html;

      // Check if HTML appears truncated and needs repair
      if (isHtmlTruncated(modifiedTemplateHtml)) {
        console.warn("[Streaming] HTML appears truncated, attempting repair...");
        const repairResult = repairHtml(modifiedTemplateHtml);
        if (repairResult.repairsApplied.length > 0) {
          console.log(`[Streaming] Applied HTML repairs: ${repairResult.repairsApplied.join(", ")}`);
          modifiedTemplateHtml = repairResult.html;
        }
      } else {
        const repairResult = repairHtml(modifiedTemplateHtml);
        if (repairResult.repairsApplied.length > 0) {
          console.log(`[Streaming] Applied minor HTML repairs: ${repairResult.repairsApplied.join(", ")}`);
          modifiedTemplateHtml = repairResult.html;
        }
      }

      // FAST security check
      const hasScriptInjection =
        /<script/i.test(modifiedTemplateHtml) ||
        /javascript:/i.test(modifiedTemplateHtml) ||
        /<iframe/i.test(modifiedTemplateHtml) ||
        /\son\w+\s*=/i.test(modifiedTemplateHtml);

      if (hasScriptInjection) {
        modifiedTemplateHtml = sanitizeHtml(modifiedTemplateHtml);
        console.warn("[Streaming Security] Applied HTML sanitization for potential script injection");
      }

      // Check for content loss / document corruption
      const guardrailResult = validateGuardrails(templateToModify, modifiedTemplateHtml);
      if (!guardrailResult.valid) {
        const contentLossViolation = guardrailResult.violations.find(
          (v) => v.includes("content loss") || v.includes("improperly cleared")
        );

        if (contentLossViolation) {
          console.error(`[Streaming Security] Content loss detected: ${contentLossViolation}`);
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              error: "This type of modification cannot be applied. The AI attempted to remove document content which is not allowed.",
              code: "CONTENT_LOSS_BLOCKED",
            }),
          });
          return;
        }

        const unprofessionalViolation = guardrailResult.violations.find(
          (v) =>
            v.includes("Unprofessional content") ||
            v.includes("Celebration") ||
            v.includes("Confetti") ||
            v.includes("Gimmicky animation")
        );

        if (unprofessionalViolation) {
          console.error(`[Streaming Security] Unprofessional content blocked: ${unprofessionalViolation}`);
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              error: "This modification would add unprofessional elements to your document. Please try a different styling approach.",
              code: "UNPROFESSIONAL_CONTENT_BLOCKED",
            }),
          });
          return;
        }

        console.warn(`[Streaming Security] Guardrail violations: ${guardrailResult.violations.join(", ")}`);
      }

      // Re-render the modified template with the original data
      let renderedHtml: string;
      try {
        renderedHtml = templateEngine.renderRaw(modifiedTemplateHtml, session.data);
      } catch (renderError) {
        console.error("Streaming template re-render failed:", renderError);
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

      if (isDevSession) {
        updateDevSession(sessionId, {
          current_html: renderedHtml,
          template_html: modifiedTemplateHtml,
          modifications,
        });
        addTemplateToHistory(sessionId, modifiedTemplateHtml, renderedHtml);
      } else if (supabase) {
        await getSupabase()
          .from("sessions")
          .update({
            current_html: renderedHtml,
            template_html: modifiedTemplateHtml,
            modifications,
          })
          .eq("id", sessionId);
      }

      // Emit changes event (for UI toast)
      await stream.writeSSE({
        event: "changes",
        data: JSON.stringify({ changes: result.changes }),
      });

      // Emit complete event
      await stream.writeSSE({
        event: "complete",
        data: JSON.stringify({
          html: renderedHtml,
          changes: result.changes,
          tokensUsed: result.tokensUsed,
          selfCheckPassed: true,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            processingTimeMs: Date.now() - streamStartTime,
            cached: false,
            model,
            fastTransform: false,
          },
        }),
      });

      // Background validation (non-blocking)
      runBackgroundValidation(templateToModify, modifiedTemplateHtml, prompt, sessionId);
    } catch (error) {
      console.error("[Streaming] Error:", error);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
          code: "STREAM_ERROR",
        }),
      });
    }
  });
}

export default modify;
