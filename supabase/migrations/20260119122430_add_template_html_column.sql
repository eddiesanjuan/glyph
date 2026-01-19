-- Add template_html column to sessions table
-- This stores the raw template HTML with Mustache placeholders
-- Allows AI modifications to work on templates, then re-render with data

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS template_html TEXT;

-- Backfill existing sessions: copy original_html to template_html
-- (existing sessions may not have proper template HTML, but this provides a fallback)
UPDATE sessions SET template_html = original_html WHERE template_html IS NULL;

COMMENT ON COLUMN sessions.template_html IS 'Raw template HTML with Mustache placeholders for AI modifications';
COMMENT ON COLUMN sessions.current_html IS 'Rendered HTML with actual data values for display';
COMMENT ON COLUMN sessions.data IS 'Data object used for Mustache rendering';
