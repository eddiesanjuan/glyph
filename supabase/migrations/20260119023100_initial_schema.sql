-- Glyph Database Schema
-- Created: 2026-01-19

-- ============================================
-- Table: api_keys
-- ============================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,  -- First 8 chars for display: gk_abc123
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'scale', 'enterprise')),
  monthly_limit INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ============================================
-- Table: usage
-- ============================================
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  template TEXT,
  tokens_used INTEGER DEFAULT 0,
  pdf_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_api_key ON usage(api_key_id);
CREATE INDEX idx_usage_created ON usage(created_at);
CREATE INDEX idx_usage_monthly ON usage(api_key_id, created_at);

-- ============================================
-- Table: sessions
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  current_html TEXT,
  original_html TEXT,
  data JSONB NOT NULL,
  modifications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_api_key ON sessions(api_key_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API layer validates)
CREATE POLICY "Service role full access on api_keys" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on usage" ON usage
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sessions" ON sessions
  FOR ALL USING (auth.role() = 'service_role');
