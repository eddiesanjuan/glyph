# Database Migrations

This directory contains SQL migrations for the Glyph API database (Supabase PostgreSQL).

## Running Migrations

### Option 1: Supabase SQL Editor (Recommended for Production)

1. Go to the [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Create a new query
5. Copy the contents of the migration file and paste it
6. Click **Run** to execute

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project ref from dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Run a migration
supabase db push
```

### Option 3: Direct psql Connection

```bash
# Get connection string from Supabase Dashboard > Settings > Database
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f 001_templates.sql
```

## Migration Files

| File | Description | Status |
|------|-------------|--------|
| `001_templates.sql` | Creates templates table for user template persistence | Pending |

## Migration Conventions

1. **Naming**: `NNN_description.sql` where NNN is a zero-padded sequence number
2. **Idempotent**: Use `IF NOT EXISTS` and `DROP ... IF EXISTS` to make migrations safe to re-run
3. **Comments**: Include header comments with description and date
4. **Rollback**: Consider adding a rollback section at the bottom (commented out)

## Verification

After running a migration, verify it worked:

```sql
-- Check templates table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'templates';

-- Check indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'templates';

-- Check RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'templates';
```

## Rollback

To rollback `001_templates.sql`:

```sql
DROP TRIGGER IF EXISTS templates_updated_at ON templates;
DROP FUNCTION IF EXISTS update_templates_updated_at();
DROP TABLE IF EXISTS templates;
```
