/**
 * Insert beta invite codes directly into Supabase
 * Run from api directory: bun run scripts/insert-beta-codes.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const invites = [
  { code: "GLYPH-KU2M-D46L", email: "nick@efsj.com", name: "Nick" },
  { code: "GLYPH-BWHF-VUJF", email: "trey@airtable.com", name: "Trey" },
];

async function insertInvites() {
  console.log("Inserting beta invite codes...\n");

  for (const invite of invites) {
    // Check if code already exists
    const { data: existing } = await supabase
      .from("beta_invites")
      .select("id")
      .eq("code", invite.code)
      .single();

    if (existing) {
      console.log(`Code ${invite.code} already exists, skipping.`);
      continue;
    }

    // Insert the invite
    const { data, error } = await supabase
      .from("beta_invites")
      .insert({
        code: invite.code,
        email: invite.email,
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to insert ${invite.name}:`, error.message);
    } else {
      console.log(`✓ Created invite for ${invite.name}: ${invite.code}`);
    }
  }

  console.log("\nDone! Codes are ready for activation at https://glyph.you/beta");
}

insertInvites().catch(console.error);
