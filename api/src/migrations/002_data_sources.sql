-- Migration: 002_data_sources
-- Description: Create data sources and template mappings for intelligent templates
-- Created: 2026-01-26
--
-- This migration creates the foundation for the intelligent template system:
-- 1. data_sources - External data connections (Airtable, webhooks, APIs, etc.)
-- 2. template_source_mappings - Links templates to data sources with field mappings
-- 3. Enhancements to templates table for required fields and AI metadata
--
-- Design Principles:
-- - Type-specific config stored in JSONB for flexibility
-- - Sensitive credentials encrypted at application layer before storage
-- - Full audit trail with timestamps
-- - Cascading deletes maintain referential integrity
-- - RLS for multi-tenant security

-- ============================================
-- Type: data_source_type ENUM
-- ============================================
-- Using TEXT with CHECK constraint for better compatibility than ENUM
-- Allows easier addition of new source types without migrations

-- ============================================
-- Table: data_sources
-- External data connections for templates
-- ============================================
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Identification
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Type discriminator
  source_type TEXT NOT NULL CHECK (source_type IN (
    'airtable',    -- Airtable bases
    'webhook',     -- Incoming webhook payloads
    'rest_api',    -- External REST APIs
    'graphql',     -- GraphQL APIs
    'database',    -- Direct database connections
    'file',        -- CSV/JSON file uploads
    'manual'       -- Manual data entry (for testing)
  )),

  -- Type-specific configuration (JSONB for flexibility)
  -- Sensitive fields (tokens, passwords) should be encrypted at app layer
  -- See CONFIG SCHEMAS section below for structure per type
  config JSONB NOT NULL DEFAULT '{}',

  -- Discovered or user-defined schema
  -- Structure: { "fields": [{ "name": "...", "type": "...", "path": "..." }] }
  discovered_schema JSONB DEFAULT NULL,

  -- Connection status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'active',      -- Working connection, schema discovered
    'pending',     -- Awaiting first connection/validation
    'failed',      -- Connection failed (see status_message)
    'disabled'     -- Manually disabled by user
  )),
  status_message TEXT,  -- Human-readable status details

  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_sync_record_count INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete support
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ============================================
-- Indexes for data_sources
-- ============================================

-- Filter by owner (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_data_sources_api_key
  ON data_sources(api_key_id)
  WHERE deleted_at IS NULL;

-- Filter by type within an account
CREATE INDEX IF NOT EXISTS idx_data_sources_type
  ON data_sources(api_key_id, source_type)
  WHERE deleted_at IS NULL;

-- Find sources needing sync (for background job)
CREATE INDEX IF NOT EXISTS idx_data_sources_sync
  ON data_sources(last_sync_at, status)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Active sources only (common filter)
CREATE INDEX IF NOT EXISTS idx_data_sources_active
  ON data_sources(api_key_id, status)
  WHERE status = 'active' AND deleted_at IS NULL;

-- ============================================
-- Table: template_source_mappings
-- Links templates to data sources with field mappings
-- ============================================
CREATE TABLE IF NOT EXISTS template_source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Field mappings: template placeholder -> source field path
  -- Structure: { "{{invoice.total}}": "fields.Total Amount", "{{customer.name}}": "fields.Customer.Name" }
  field_mappings JSONB NOT NULL DEFAULT '{}',

  -- Optional transformation rules
  -- Structure: { "{{invoice.total}}": { "type": "currency", "format": "$0,0.00" }, ... }
  transformations JSONB DEFAULT '{}',

  -- Default source for this template (only one per template)
  is_default BOOLEAN NOT NULL DEFAULT FALSE,

  -- Validation status
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN (
    'valid',       -- All mapped fields exist in source schema
    'stale',       -- Source schema changed, mappings may be broken
    'broken',      -- Known missing fields
    'pending'      -- Not yet validated
  )),
  validation_message TEXT,  -- Details about validation issues
  last_validated_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite unique: one mapping per template-source pair
  CONSTRAINT unique_template_source UNIQUE (template_id, source_id)
);

-- ============================================
-- Indexes for template_source_mappings
-- ============================================

-- Find all mappings for a template
CREATE INDEX IF NOT EXISTS idx_mappings_template
  ON template_source_mappings(template_id);

-- Find all templates using a source (for cascade updates)
CREATE INDEX IF NOT EXISTS idx_mappings_source
  ON template_source_mappings(source_id);

-- Find default source for a template quickly
CREATE INDEX IF NOT EXISTS idx_mappings_default
  ON template_source_mappings(template_id, is_default)
  WHERE is_default = TRUE;

-- Find stale/broken mappings (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_mappings_validation
  ON template_source_mappings(validation_status)
  WHERE validation_status IN ('stale', 'broken');

-- ============================================
-- Alter: templates table enhancements
-- ============================================

-- Required fields derived from Mustache placeholders
-- Structure: ["invoice.number", "invoice.total", "customer.name", ...]
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS required_fields JSONB DEFAULT '[]';

-- Sample data for preview (matches required_fields structure)
-- Structure: { "invoice": { "number": "INV-001", "total": 1500 }, "customer": { "name": "Acme" } }
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS sample_data JSONB DEFAULT '{}';

-- Default data source for this template
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS default_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL;

-- AI generation metadata (for AI-generated templates)
-- Structure: { "prompt": "...", "model": "claude-3-opus", "generated_at": "...", "iterations": 2 }
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT NULL;

-- Soft delete support for templates
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- Trigger: Update timestamps automatically
-- ============================================

-- Reuse existing function or create if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for data_sources
DROP TRIGGER IF EXISTS data_sources_updated_at ON data_sources;
CREATE TRIGGER data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for template_source_mappings
DROP TRIGGER IF EXISTS template_source_mappings_updated_at ON template_source_mappings;
CREATE TRIGGER template_source_mappings_updated_at
  BEFORE UPDATE ON template_source_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Trigger: Ensure only one default mapping per template
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_default_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this mapping as default, unset any other defaults for this template
  IF NEW.is_default = TRUE THEN
    UPDATE template_source_mappings
    SET is_default = FALSE
    WHERE template_id = NEW.template_id
      AND id != NEW.id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_mapping_trigger ON template_source_mappings;
CREATE TRIGGER ensure_single_default_mapping_trigger
  BEFORE INSERT OR UPDATE ON template_source_mappings
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION ensure_single_default_mapping();

-- ============================================
-- Row Level Security
-- ============================================

-- Enable RLS
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_source_mappings ENABLE ROW LEVEL SECURITY;

-- Service role full access (API layer validates ownership)
CREATE POLICY "Service role full access on data_sources" ON data_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on template_source_mappings" ON template_source_mappings
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Grants
-- ============================================
GRANT ALL ON data_sources TO service_role;
GRANT ALL ON template_source_mappings TO service_role;

-- ============================================
-- Comments for documentation
-- ============================================

-- data_sources table
COMMENT ON TABLE data_sources IS 'External data connections for populating templates';
COMMENT ON COLUMN data_sources.api_key_id IS 'Owner of this data source';
COMMENT ON COLUMN data_sources.source_type IS 'Type of data source: airtable, webhook, rest_api, graphql, database, file, manual';
COMMENT ON COLUMN data_sources.config IS 'Type-specific configuration (credentials encrypted at app layer)';
COMMENT ON COLUMN data_sources.discovered_schema IS 'Schema discovered from source or defined by user';
COMMENT ON COLUMN data_sources.status IS 'Connection status: active, pending, failed, disabled';
COMMENT ON COLUMN data_sources.last_sync_at IS 'When data was last fetched from source';
COMMENT ON COLUMN data_sources.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';

-- template_source_mappings table
COMMENT ON TABLE template_source_mappings IS 'Links templates to data sources with field mappings';
COMMENT ON COLUMN template_source_mappings.field_mappings IS 'Maps template placeholders to source field paths';
COMMENT ON COLUMN template_source_mappings.transformations IS 'Optional formatting rules for mapped values';
COMMENT ON COLUMN template_source_mappings.is_default IS 'Default source for this template (only one allowed)';
COMMENT ON COLUMN template_source_mappings.validation_status IS 'Whether mappings are valid against current source schema';

-- templates enhancements
COMMENT ON COLUMN templates.required_fields IS 'Array of field names required by this template';
COMMENT ON COLUMN templates.sample_data IS 'Sample data for preview rendering';
COMMENT ON COLUMN templates.default_source_id IS 'Default data source for this template';
COMMENT ON COLUMN templates.ai_metadata IS 'Metadata from AI template generation';

-- ============================================
-- CONFIG SCHEMAS (Reference Documentation)
-- ============================================
-- These are not enforced in SQL but documented for application layer
--
-- AIRTABLE:
-- {
--   "personal_access_token": "patXXXXX",  -- ENCRYPTED
--   "base_id": "appXXXXX",
--   "table_id": "tblXXXXX",
--   "view_id": "viwXXXXX",  -- optional
--   "filter_formula": "Status = 'Active'"  -- optional Airtable formula
-- }
--
-- WEBHOOK:
-- {
--   "expected_schema": { ... },  -- JSON Schema for validation
--   "secret": "whsec_XXXXX",  -- ENCRYPTED, for signature verification
--   "allowed_ips": ["1.2.3.4"]  -- optional IP whitelist
-- }
--
-- REST_API:
-- {
--   "endpoint": "https://api.example.com/data",
--   "method": "GET",
--   "headers": { "Authorization": "Bearer TOKEN" },  -- TOKEN is ENCRYPTED
--   "query_params": { "status": "active" },
--   "auth_type": "bearer" | "basic" | "api_key" | "none",
--   "auth_config": { ... },  -- ENCRYPTED
--   "response_path": "data.items"  -- JSONPath to extract records
-- }
--
-- GRAPHQL:
-- {
--   "endpoint": "https://api.example.com/graphql",
--   "query": "query { users { id name email } }",
--   "variables": { ... },
--   "headers": { "Authorization": "Bearer TOKEN" },  -- ENCRYPTED
--   "response_path": "data.users"
-- }
--
-- DATABASE:
-- {
--   "connection_type": "postgres" | "mysql" | "mssql",
--   "connection_string": "postgresql://...",  -- ENCRYPTED
--   "query": "SELECT * FROM invoices WHERE status = 'pending'",
--   "params": { ... }
-- }
--
-- FILE:
-- {
--   "file_type": "csv" | "json" | "excel",
--   "storage_path": "uploads/abc123.csv",  -- S3 or local path
--   "original_filename": "invoices.csv",
--   "parsed_schema": { ... },
--   "delimiter": ","  -- for CSV
-- }
--
-- MANUAL:
-- {
--   "schema": { ... }  -- User-defined schema for testing
-- }
--
-- ============================================
-- DISCOVERED_SCHEMA FORMAT (Reference)
-- ============================================
-- {
--   "fields": [
--     {
--       "name": "Invoice Number",
--       "path": "fields.Invoice Number",  -- dot-notation path for nested access
--       "type": "string" | "number" | "boolean" | "date" | "array" | "object",
--       "required": true,
--       "sample_value": "INV-2024-001"
--     },
--     {
--       "name": "Total",
--       "path": "fields.Total",
--       "type": "number",
--       "required": true,
--       "sample_value": 1500.00
--     }
--   ],
--   "discovered_at": "2026-01-26T12:00:00Z",
--   "record_count": 150,
--   "sample_records": [ ... ]  -- First 3 records for preview
-- }
--
-- ============================================
-- FIELD_MAPPINGS FORMAT (Reference)
-- ============================================
-- {
--   "{{invoice.number}}": "fields.Invoice Number",
--   "{{invoice.total}}": "fields.Total",
--   "{{customer.name}}": "fields.Customer.name",
--   "{{items}}": "fields.Line Items"  -- Array mapping
-- }
--
-- ============================================
-- TRANSFORMATIONS FORMAT (Reference)
-- ============================================
-- {
--   "{{invoice.total}}": {
--     "type": "currency",
--     "locale": "en-US",
--     "currency": "USD"
--   },
--   "{{invoice.date}}": {
--     "type": "date",
--     "format": "MMMM D, YYYY"
--   },
--   "{{customer.name}}": {
--     "type": "text",
--     "transform": "uppercase"
--   }
-- }
