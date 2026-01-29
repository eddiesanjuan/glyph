/**
 * Document Store
 *
 * In-memory storage for generated PDF/PNG documents with hosted URLs.
 * Documents are stored with unique IDs and served via /v1/documents/:id.
 *
 * Security model: unguessable document IDs (crypto.randomUUID).
 * No authentication required to retrieve a document by ID.
 *
 * WARNING: Documents are lost on server restart.
 */

// =============================================================================
// Types
// =============================================================================

export interface StoredDocument {
  id: string;
  buffer: Buffer;
  contentType: string;
  format: "pdf" | "png";
  size: number;
  filename: string;
  createdAt: string;
  expiresAt: string;
  source: {
    type: "template" | "html" | "url" | "data";
    templateId?: string;
    url?: string;
  };
  sessionId?: string;
}

export interface DocumentMetadata {
  id: string;
  format: "pdf" | "png";
  size: number;
  filename: string;
  createdAt: string;
  expiresAt: string;
  source: StoredDocument["source"];
  sessionId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MIN_TTL_SECONDS = 300; // 5 minutes
const MAX_TTL_SECONDS = 604800; // 7 days
const DEMO_TIER_MAX_DOCUMENTS = 50;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Store
// =============================================================================

const documents = new Map<string, StoredDocument>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate a unique document ID with `doc_` prefix.
 */
export function generateDocumentId(): string {
  return `doc_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Clamp and validate a TTL value in seconds.
 * Returns the default TTL if not provided.
 */
export function resolveTTL(ttl?: number): number {
  if (ttl === undefined || ttl === null) {
    return DEFAULT_TTL_SECONDS;
  }
  return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, Math.round(ttl)));
}

/**
 * Store a generated document.
 *
 * @param options - Document data and metadata
 * @returns The stored document metadata (without the buffer)
 */
export function storeDocument(options: {
  buffer: Buffer;
  format: "pdf" | "png";
  filename: string;
  source: StoredDocument["source"];
  sessionId?: string;
  ttlSeconds?: number;
  isDemoTier?: boolean;
}): StoredDocument {
  const {
    buffer,
    format,
    filename,
    source,
    sessionId,
    ttlSeconds,
    isDemoTier,
  } = options;

  // Enforce demo tier document limit
  if (isDemoTier && documents.size >= DEMO_TIER_MAX_DOCUMENTS) {
    // Evict the oldest document to make room
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, doc] of documents.entries()) {
      const created = new Date(doc.createdAt).getTime();
      if (created < oldestTime) {
        oldestTime = created;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      documents.delete(oldestKey);
      console.info(`[DocumentStore] Evicted oldest document ${oldestKey} (demo tier limit)`);
    }
  }

  const id = generateDocumentId();
  const now = new Date();
  const ttl = resolveTTL(ttlSeconds);
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const contentType = format === "pdf" ? "application/pdf" : "image/png";

  const doc: StoredDocument = {
    id,
    buffer,
    contentType,
    format,
    size: buffer.length,
    filename,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source,
    sessionId,
  };

  documents.set(id, doc);
  console.info(
    `[DocumentStore] Stored document ${id} (${format}, ${buffer.length} bytes, TTL ${ttl}s)`
  );

  return doc;
}

/**
 * Retrieve a document by ID.
 * Returns null if not found. Returns an object with `expired: true` if expired.
 */
export function getDocument(
  id: string
): { doc: StoredDocument; expired: false } | { doc: null; expired: true; expiredAt: string } | null {
  const doc = documents.get(id);

  if (!doc) {
    return null;
  }

  const now = new Date();
  if (new Date(doc.expiresAt) < now) {
    // Document expired -- remove it and return expired status
    documents.delete(id);
    console.info(`[DocumentStore] Document expired and removed: ${id}`);
    return { doc: null, expired: true, expiredAt: doc.expiresAt };
  }

  return { doc, expired: false };
}

/**
 * Get document metadata (without the buffer).
 */
export function getDocumentMetadata(id: string): DocumentMetadata | null {
  const result = getDocument(id);
  if (!result || result.expired) {
    return null;
  }

  const { doc } = result;
  return {
    id: doc.id,
    format: doc.format,
    size: doc.size,
    filename: doc.filename,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    source: doc.source,
    sessionId: doc.sessionId,
  };
}

/**
 * Get the count of stored documents (for monitoring).
 */
export function getDocumentCount(): number {
  return documents.size;
}

/**
 * Clean up expired documents. Called periodically by the cleanup interval.
 */
export function cleanupExpiredDocuments(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, doc] of documents.entries()) {
    if (new Date(doc.expiresAt) < now) {
      documents.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.info(`[DocumentStore] Cleaned up ${cleaned} expired documents`);
  }

  return cleaned;
}

// =============================================================================
// Auto-cleanup interval
// =============================================================================

setInterval(() => {
  cleanupExpiredDocuments();
}, CLEANUP_INTERVAL_MS);

console.info(
  `[DocumentStore] Cleanup interval set: every ${CLEANUP_INTERVAL_MS / 1000}s`
);
