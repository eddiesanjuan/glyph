# Railway glyph-www Service Fix

## Problem

The `glyph-www` service is returning JSON (API response) instead of HTML because it's deploying from the root directory `/` which picks up the API Dockerfile, not the www/ Dockerfile.

## Root Cause

Railway's "Root Directory" service setting determines which folder to deploy from. This setting **cannot be changed via CLI** - it requires dashboard access.

Currently: Root Directory = `/` (uses root Dockerfile for API)
Should be: Root Directory = `www` (uses www/Dockerfile for static site)

## Fix (Dashboard Required) - FOLLOW THESE EXACT STEPS

### Step 1: Open the Service Settings
1. Open: https://railway.com/project/76d95905-de59-4475-8d26-7179f8244510
2. Click on the `glyph-www` service tile in the project canvas

### Step 2: Navigate to Settings
1. Click the **Settings** tab in the right panel
2. Look for **Source** section (it may be under Build or Deploy settings)

### Step 3: Change Root Directory
1. Find the **Root Directory** field (may also be called "Watch Paths" or "Build Directory")
2. Change from empty/`/` to: `www`
3. Optionally also set: **Dockerfile Path** to `Dockerfile` (relative to www/)

### Step 4: Trigger Redeploy
1. Save any changes
2. Click **Deploy** or **Redeploy** button
3. Wait for deployment to complete (~60-90 seconds)

## Verification Commands

After the fix:
```bash
# Check content type (should be text/html)
curl -s -I https://glyph-www-production.up.railway.app/ | grep content-type

# Check response body (should start with <!DOCTYPE html>)
curl -s https://glyph-www-production.up.railway.app/ | head -5
```

**Expected content-type**: `text/html; charset=utf-8`
**NOT**: `application/json`

## What I Already Tried (CLI approaches that didn't work)

1. **Deploying from www/ subdirectory**: `cd www && railway up` - Railway ignores the cwd and uses service's configured root directory
2. **Setting env variables**: `RAILWAY_ROOT_DIRECTORY=www` and `RAILWAY_DOCKERFILE_PATH=Dockerfile.www` - These are read-only reference variables, not configuration
3. **Multiple railway.toml/railway.json files**: Service settings override file-based config

## Alternative: Delete and Recreate Service

If the root directory setting is hard to find:

1. Note the current domain: `glyph-www-production.up.railway.app`
2. Delete the `glyph-www` service
3. Create new service from GitHub repo:
   - Repository: `glyph`
   - Root Directory: `www`
   - Build: Dockerfile
4. Re-add the domain

## Current Service Details

- **Service Name**: glyph-www
- **Service ID**: d20152ab-3de6-4a6f-aa99-fff02b5b3633
- **Project ID**: 76d95905-de59-4475-8d26-7179f8244510
- **Domain**: glyph-www-production.up.railway.app

## Files in www/ (correctly configured)

```
www/
  Dockerfile        # Uses node:20-slim + serve for static hosting
  railway.toml      # Healthcheck on "/"
  railway.json      # Dockerfile builder config
  index.html        # Landing page (258KB)
  BUILD_TIMESTAMP.txt  # Deployment marker
```
