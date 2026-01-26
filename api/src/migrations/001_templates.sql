-- Migration: 001_templates
-- Description: Create templates table for user template persistence
-- Created: 2026-01-26
--
-- This migration creates the templates table that allows users to save
-- their customized PDF templates for reuse. Templates are tied to API keys
-- and support versioning, styling presets, and type categorization.

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('invoice', 'quote', 'report', 'certificate', 'letter', 'receipt', 'contract', 'custom')),
  description TEXT,
  html_template TEXT NOT NULL,
  schema JSONB DEFAULT '{}',
  style VARCHAR(50) CHECK (style IN ('stripe-clean', 'professional', 'minimal', 'bold', 'classic', 'corporate', 'modern', 'vibrant')),
  is_default BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common query patterns
-- Index on api_key_id for filtering templates by user
CREATE INDEX IF NOT EXISTS idx_templates_api_key ON templates(api_key_id);

-- Composite index for filtering by type within a user's templates
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(api_key_id, type);

-- Partial index for finding default templates efficiently
CREATE INDEX IF NOT EXISTS idx_templates_default ON templates(api_key_id, type, is_default) WHERE is_default = TRUE;

-- Create update trigger for updated_at
-- This automatically updates the updated_at timestamp on any row modification
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_updated_at ON templates;
CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();

-- Enable Row Level Security
-- This ensures data isolation at the database level
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- RLS policy: Service role has full access
-- The API validates that api_key_id matches the authenticated key
-- before performing any operations, so we allow service role full access
CREATE POLICY templates_api_key_policy ON templates
  USING (true)
  WITH CHECK (true);

-- Grant permissions to service role (used by the API)
GRANT ALL ON templates TO service_role;

-- Add comment to table for documentation
COMMENT ON TABLE templates IS 'User-saved PDF templates with versioning and style presets';
COMMENT ON COLUMN templates.api_key_id IS 'Foreign key to api_keys table - owns this template';
COMMENT ON COLUMN templates.name IS 'User-defined template name';
COMMENT ON COLUMN templates.type IS 'Document type category for organization';
COMMENT ON COLUMN templates.html_template IS 'Full HTML content of the template';
COMMENT ON COLUMN templates.schema IS 'JSON schema defining data placeholders in the template';
COMMENT ON COLUMN templates.style IS 'Visual style preset applied to the template';
COMMENT ON COLUMN templates.is_default IS 'Whether this is the default template for its type';
COMMENT ON COLUMN templates.version IS 'Version number, incremented on updates';
