/**
 * Development Mode Session Storage
 *
 * In-memory storage for sessions when Supabase is not configured.
 * This allows local development and testing without database setup.
 *
 * WARNING: Sessions are lost on server restart.
 */

export interface ValidationSummary {
  passed: boolean;
  criticalCount: number;
  warningCount: number;
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    autoFixable: boolean;
    suggestedFix?: string;
  }>;
  hasAutoFix: boolean;
  validatedAt: string;
}

/** A snapshot of template state for undo support */
export interface TemplateSnapshot {
  template_html: string;
  rendered_html: string;
}

export interface DevSession {
  id: string;
  current_html: string;
  original_html: string;
  /** Template HTML with Mustache placeholders (for AI modifications) */
  template_html: string;
  /** Original data used for rendering (for re-rendering after modifications) */
  data: Record<string, unknown>;
  modifications: Array<{
    prompt: string;
    region: string | null;
    timestamp: string;
    changes: string[];
  }>;
  template: string;
  created_at: string;
  expires_at: string;
  /** Self-check validation result from background validator */
  validation_result?: ValidationSummary;
  /** Auto-fixed HTML suggestion if issues were found and fixable */
  suggested_fix_html?: string;
  /** History of template states for undo support (most recent last) */
  template_history?: TemplateSnapshot[];
}

// In-memory storage for development sessions
const devSessions = new Map<string, DevSession>();

/**
 * Create a new development session
 */
export function createDevSession(
  sessionId: string,
  template: string,
  renderedHtml: string,
  templateHtml: string,
  data: Record<string, unknown>
): DevSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  const session: DevSession = {
    id: sessionId,
    current_html: renderedHtml,
    original_html: renderedHtml,
    template_html: templateHtml,
    data,
    modifications: [],
    template,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    // Initialize template history with the original state for undo support
    template_history: [{
      template_html: templateHtml,
      rendered_html: renderedHtml,
    }],
  };

  devSessions.set(sessionId, session);
  console.info(`[Dev Mode] Created session: ${sessionId} (expires: ${expiresAt.toISOString()})`);

  return session;
}

/**
 * Get a development session by ID
 */
export function getDevSession(sessionId: string): DevSession | null {
  const session = devSessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    devSessions.delete(sessionId);
    console.info(`[Dev Mode] Session expired and removed: ${sessionId}`);
    return null;
  }

  return session;
}

/**
 * Update a development session
 */
export function updateDevSession(
  sessionId: string,
  updates: Partial<Pick<DevSession, 'current_html' | 'template_html' | 'modifications' | 'validation_result' | 'suggested_fix_html'>>
): DevSession | null {
  const session = devSessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Create updated session with spread
  const updatedSession = {
    ...session,
    ...updates,
  };

  // Handle explicit undefined values to clear fields
  // This is needed because spread doesn't delete properties
  if ('validation_result' in updates && updates.validation_result === undefined) {
    delete updatedSession.validation_result;
  }
  if ('suggested_fix_html' in updates && updates.suggested_fix_html === undefined) {
    delete updatedSession.suggested_fix_html;
  }

  devSessions.set(sessionId, updatedSession);
  return updatedSession;
}

/**
 * Find the template HTML that corresponds to a given rendered HTML.
 * Used for undo support - when client sends rendered HTML that differs from
 * current state, we need to find the matching template in history.
 *
 * Returns the template_html if found, or null if no match.
 */
export function findTemplateForRenderedHtml(
  sessionId: string,
  renderedHtml: string
): string | null {
  const session = devSessions.get(sessionId);
  if (!session || !session.template_history) {
    return null;
  }

  // Search history from most recent to oldest
  for (let i = session.template_history.length - 1; i >= 0; i--) {
    const snapshot = session.template_history[i];
    if (snapshot.rendered_html === renderedHtml) {
      console.info(`[Dev Mode] Found matching template at history index ${i} for session: ${sessionId}`);
      return snapshot.template_html;
    }
  }

  console.warn(`[Dev Mode] No matching template found for rendered HTML in session: ${sessionId}`);
  return null;
}

/**
 * Add a new template snapshot to history.
 * Called after each successful modification.
 */
export function addTemplateToHistory(
  sessionId: string,
  templateHtml: string,
  renderedHtml: string
): void {
  const session = devSessions.get(sessionId);
  if (!session) {
    return;
  }

  if (!session.template_history) {
    session.template_history = [];
  }

  // Add to history (limit to 20 entries to prevent memory bloat)
  session.template_history.push({
    template_html: templateHtml,
    rendered_html: renderedHtml,
  });

  // Trim history if too long
  const MAX_HISTORY = 20;
  if (session.template_history.length > MAX_HISTORY) {
    session.template_history = session.template_history.slice(-MAX_HISTORY);
  }

  devSessions.set(sessionId, session);
}

/**
 * Delete a development session
 */
export function deleteDevSession(sessionId: string): boolean {
  return devSessions.delete(sessionId);
}

/**
 * Check if a session ID is a development session
 */
export function isDevSessionId(sessionId: string): boolean {
  return sessionId.startsWith('dev_');
}

/**
 * Generate a new development session ID
 */
export function generateDevSessionId(): string {
  return `dev_${crypto.randomUUID()}`;
}

/**
 * Get count of active dev sessions (for monitoring)
 */
export function getDevSessionCount(): number {
  return devSessions.size;
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, session] of devSessions.entries()) {
    if (new Date(session.expires_at) < now) {
      devSessions.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.info(`[Dev Mode] Cleaned up ${cleaned} expired sessions`);
  }

  return cleaned;
}
