-- ============================================
-- Glyph Beta Invite System
-- Migration: 001_beta_invite_system.sql
-- ============================================

-- Beta access requests (people who want early access)
CREATE TABLE IF NOT EXISTS beta_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  use_case TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,

  -- Ensure unique emails (case-insensitive)
  CONSTRAINT beta_requests_email_unique UNIQUE (email)
);

-- Index for fast status queries
CREATE INDEX IF NOT EXISTS idx_beta_requests_status ON beta_requests(status);
CREATE INDEX IF NOT EXISTS idx_beta_requests_created_at ON beta_requests(created_at DESC);

-- Beta invite codes (generated when requests are approved)
CREATE TABLE IF NOT EXISTS beta_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  email TEXT NOT NULL,
  request_id UUID REFERENCES beta_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,

  -- Ensure unique codes
  CONSTRAINT beta_invites_code_unique UNIQUE (code)
);

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_beta_invites_code ON beta_invites(code);
CREATE INDEX IF NOT EXISTS idx_beta_invites_email ON beta_invites(email);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE beta_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for API server)
CREATE POLICY "Service role full access to beta_requests" ON beta_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to beta_invites" ON beta_invites
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE beta_requests IS 'Early access requests from potential users';
COMMENT ON COLUMN beta_requests.email IS 'Email address of requester (lowercase)';
COMMENT ON COLUMN beta_requests.name IS 'Optional name of requester';
COMMENT ON COLUMN beta_requests.company IS 'Optional company/project name';
COMMENT ON COLUMN beta_requests.use_case IS 'Brief description of intended use';
COMMENT ON COLUMN beta_requests.status IS 'pending, approved, or rejected';
COMMENT ON COLUMN beta_requests.reviewed_by IS 'Admin who reviewed the request';

COMMENT ON TABLE beta_invites IS 'Invite codes for approved beta access';
COMMENT ON COLUMN beta_invites.code IS 'Unique invite code format: GLYPH-XXXX-XXXX';
COMMENT ON COLUMN beta_invites.request_id IS 'Links to the original request';
COMMENT ON COLUMN beta_invites.api_key_id IS 'Links to generated API key after activation';
COMMENT ON COLUMN beta_invites.revoked IS 'Whether access has been revoked';
