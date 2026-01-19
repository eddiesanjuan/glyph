/**
 * Glyph Database Verification Script
 * Run with: npx tsx verify-db.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://slrvwzavxhpbnpsexoog.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verify() {
  console.log('Verifying Glyph database schema...\n');

  // Check api_keys table
  const { data: apiKeys, error: apiKeysError } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, tier')
    .limit(5);

  if (apiKeysError) {
    console.error('api_keys table error:', apiKeysError.message);
  } else {
    console.log('api_keys table: OK');
    console.log(`  Found ${apiKeys?.length || 0} records`);
    if (apiKeys?.length) {
      console.log('  Test key:', apiKeys[0]);
    }
  }

  // Check usage table
  const { count: usageCount, error: usageError } = await supabase
    .from('usage')
    .select('*', { count: 'exact', head: true });

  if (usageError) {
    console.error('usage table error:', usageError.message);
  } else {
    console.log('\nusage table: OK');
    console.log(`  Found ${usageCount || 0} records`);
  }

  // Check sessions table
  const { count: sessionsCount, error: sessionsError } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true });

  if (sessionsError) {
    console.error('sessions table error:', sessionsError.message);
  } else {
    console.log('\nsessions table: OK');
    console.log(`  Found ${sessionsCount || 0} records`);
  }

  console.log('\n--- Verification Complete ---');
}

verify().catch(console.error);
