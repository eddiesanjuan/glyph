-- Glyph Test Data Seed
-- Created: 2026-01-19

-- Development test key
-- The actual key will be: gk_test123456789abcdef (for dev only!)
-- Store hash of full key
INSERT INTO api_keys (key_hash, key_prefix, name, owner_email, tier, monthly_limit)
VALUES (
  encode(sha256('gk_test123456789abcdef'::bytea), 'hex'),
  'gk_test12',
  'Development Test Key',
  'eddie@efsanjuan.com',
  'pro',
  10000
);
