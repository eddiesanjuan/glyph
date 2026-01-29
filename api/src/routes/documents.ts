/**
 * Documents Routes
 * Serve hosted PDF/PNG documents by ID.
 *
 * GET /v1/documents/:id          - Download the document file
 * GET /v1/documents/:id/metadata - Get document metadata as JSON
 *
 * Documents use unguessable IDs as the security model --
 * no authentication is required to retrieve a document.
 */

import { Hono } from "hono";
import { getDocument } from "../lib/documentStore.js";

const documents = new Hono();

// =============================================================================
// GET /:id
// Serve the raw document file (PDF or PNG)
// =============================================================================

documents.get("/:id", (c) => {
  const id = c.req.param("id");
  const result = getDocument(id);

  // Document never existed (or was already cleaned up)
  if (result === null) {
    return c.json(
      {
        error: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
      },
      404
    );
  }

  // Document existed but has expired
  if (result.expired) {
    return c.json(
      {
        error: "Document has expired",
        code: "DOCUMENT_EXPIRED",
        expiredAt: result.expiredAt,
      },
      410
    );
  }

  const { doc } = result;

  c.header("Content-Type", doc.contentType);
  c.header("Content-Disposition", `inline; filename="${doc.filename}"`);
  c.header("Content-Length", String(doc.size));
  c.header("Cache-Control", "private, max-age=3600");
  c.header("X-Glyph-Document-Id", doc.id);

  if (doc.sessionId) {
    c.header("X-Glyph-Session-Id", doc.sessionId);
  }

  return c.body(new Uint8Array(doc.buffer));
});

// =============================================================================
// GET /:id/metadata
// Return JSON metadata about the document (without the file bytes)
// =============================================================================

documents.get("/:id/metadata", (c) => {
  const id = c.req.param("id");
  const result = getDocument(id);

  // Document never existed
  if (result === null) {
    return c.json(
      {
        error: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
      },
      404
    );
  }

  // Document expired
  if (result.expired) {
    return c.json(
      {
        error: "Document has expired",
        code: "DOCUMENT_EXPIRED",
        expiredAt: result.expiredAt,
      },
      410
    );
  }

  const { doc } = result;

  return c.json({
    id: doc.id,
    format: doc.format,
    size: doc.size,
    filename: doc.filename,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    source: doc.source,
    sessionId: doc.sessionId,
  });
});

export default documents;
