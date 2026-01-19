/**
 * Development Mode Session Storage
 *
 * In-memory storage for sessions when Supabase is not configured.
 * This allows local development and testing without database setup.
 *
 * WARNING: Sessions are lost on server restart.
 */

export interface DevSession {
  id: string;
  current_html: string;
  original_html: string;
  modifications: Array<{
    prompt: string;
    region: string | null;
    timestamp: string;
    changes: string[];
  }>;
  template: string;
  created_at: string;
  expires_at: string;
}

// In-memory storage for development sessions
const devSessions = new Map<string, DevSession>();

/**
 * Create a new development session
 */
export function createDevSession(
  sessionId: string,
  template: string,
  html: string
): DevSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  const session: DevSession = {
    id: sessionId,
    current_html: html,
    original_html: html,
    modifications: [],
    template,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
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
  updates: Partial<Pick<DevSession, 'current_html' | 'modifications'>>
): DevSession | null {
  const session = devSessions.get(sessionId);

  if (!session) {
    return null;
  }

  const updatedSession = {
    ...session,
    ...updates,
  };

  devSessions.set(sessionId, updatedSession);
  return updatedSession;
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
