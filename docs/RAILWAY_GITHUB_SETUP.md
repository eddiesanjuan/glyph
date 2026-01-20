# Railway GitHub Integration Setup Guide

## Current State Assessment

**Project ID**: `76d95905-de59-4475-8d26-7179f8244510`
**GitHub Repo**: `eddiesanjuan/glyph`
**Project URL**: https://railway.com/project/76d95905-de59-4475-8d26-7179f8244510

### Service Status (as of 2026-01-19)

| Service | Current State | Problem |
|---------|--------------|---------|
| glyph-api | Working | May need GitHub integration verification |
| glyph-www | Broken | Serving API JSON instead of HTML (wrong root directory) |
| glyph-sdk | Broken | Serving API JSON instead of JS files (wrong root directory) |

### Root Cause

All services were deployed via `railway up` CLI which defaults to the repository root directory (`/`). This means glyph-www and glyph-sdk are using the root `Dockerfile` (API) instead of their subfolder Dockerfiles.

---

## Solution: Delete and Recreate with GitHub Integration

The Railway CLI does NOT support:
- Setting root directory
- Creating services with GitHub repo connection (only image or database sources)
- Modifying existing service source configuration

**Dashboard access is required** for proper GitHub monorepo setup.

---

## Step-by-Step Setup Instructions

### Phase 1: Delete Misconfigured Services

Note the current domains before deleting (for re-adding later):
- `glyph-www-production.up.railway.app`
- `glyph-sdk-production.up.railway.app`

**Via Dashboard:**
1. Open https://railway.com/project/76d95905-de59-4475-8d26-7179f8244510
2. Click on `glyph-www` service
3. Go to Settings tab
4. Scroll to bottom, click "Delete Service"
5. Confirm deletion
6. Repeat for `glyph-sdk`

**Via CLI (if preferred):**
```bash
cd /Users/eddiesanjuan/Projects/glyph

# Link to each service and delete
railway link -p 76d95905-de59-4475-8d26-7179f8244510 -s glyph-www
railway service delete

railway link -p 76d95905-de59-4475-8d26-7179f8244510 -s glyph-sdk
railway service delete
```

### Phase 2: Verify glyph-api Configuration

1. Open https://railway.com/project/76d95905-de59-4475-8d26-7179f8244510
2. Click on `glyph-api` service
3. Check Settings tab:
   - **Source**: Should show `GitHub: eddiesanjuan/glyph`
   - **Root Directory**: Should be `/` (empty or root)
   - **Branch**: Should be `main`
4. If not connected to GitHub:
   - Click "Connect Repo"
   - Select `eddiesanjuan/glyph`
   - Set root directory to `/` (root)
   - Set branch to `main`

### Phase 3: Create glyph-www Service (GitHub Connected)

1. In project view, click **"+ New"** or **"New Service"**
2. Select **"GitHub Repo"**
3. Choose repository: `eddiesanjuan/glyph`
4. **CRITICAL**: In the settings that appear:
   - **Root Directory**: `www`
   - **Branch**: `main`
   - **Build Command**: (leave default - uses Dockerfile)
5. Click "Deploy"
6. Once deployed, rename service to `glyph-www`:
   - Click on service > Settings > Service Name > "glyph-www"
7. Add domain:
   - Settings > Domains > Generate Domain
   - Or add custom domain later

### Phase 4: Create glyph-sdk Service (GitHub Connected)

1. In project view, click **"+ New"** or **"New Service"**
2. Select **"GitHub Repo"**
3. Choose repository: `eddiesanjuan/glyph`
4. **CRITICAL**: In the settings that appear:
   - **Root Directory**: `sdk`
   - **Branch**: `main`
   - **Build Command**: (leave default - uses Dockerfile)
5. Click "Deploy"
6. Rename to `glyph-sdk`
7. Add domain

### Phase 5: Configure PR Previews (Optional)

Railway automatically enables PR previews for GitHub-connected services. To verify:

1. For each service, go to Settings
2. Look for "PR Environments" or "Preview Environments" section
3. Ensure it's enabled
4. Set environment variable inheritance if needed

---

## Target Configuration

After setup, each service should have:

| Service | Root Directory | Dockerfile | GitHub Branch | Health Check |
|---------|---------------|------------|---------------|--------------|
| glyph-api | `/` | `Dockerfile` | main | `/health` |
| glyph-www | `www` | `www/Dockerfile` | main | `/` |
| glyph-sdk | `sdk` | `sdk/Dockerfile` | main | `/glyph.min.js` |

---

## Verification Commands

After setup, run these to verify everything works:

```bash
# Check API (should return JSON with endpoints)
curl -s https://api.glyph.run/ | jq '.name'
# Expected: "Glyph API"

# Check WWW (should return HTML)
curl -s -I https://glyph-www-production.up.railway.app/ | grep content-type
# Expected: text/html

curl -s https://glyph-www-production.up.railway.app/ | head -1
# Expected: <!DOCTYPE html>

# Check SDK (should return JavaScript)
curl -s -I https://glyph-sdk-production.up.railway.app/glyph.min.js | grep content-type
# Expected: application/javascript

curl -s https://glyph-sdk-production.up.railway.app/glyph.min.js | head -1
# Expected: JavaScript code (minified)
```

---

## Test Auto-Deploy

1. Make a small change to any file in `www/`:
   ```bash
   echo "<!-- Auto-deploy test $(date) -->" >> www/index.html
   git add www/index.html
   git commit -m "test: verify auto-deploy for www service"
   git push
   ```

2. Watch Railway dashboard - glyph-www should auto-deploy within 30 seconds

3. Make a small change to `sdk/`:
   ```bash
   # Add a comment to SDK source
   git add sdk/
   git commit -m "test: verify auto-deploy for sdk service"
   git push
   ```

4. Watch Railway dashboard - glyph-sdk should auto-deploy

---

## Test PR Previews

1. Create a test branch:
   ```bash
   git checkout -b test/pr-preview
   echo "<!-- PR Preview Test -->" >> www/index.html
   git add .
   git commit -m "test: PR preview environment"
   git push -u origin test/pr-preview
   ```

2. Create a PR on GitHub

3. Railway should comment on the PR with preview URLs for each service

4. After testing, close the PR without merging

---

## CLI Limitations Summary

The Railway CLI (as of v3.x) cannot:
- Create services with GitHub repo source (only `--image` or `--database`)
- Set root directory for services
- Configure PR preview settings
- Connect existing services to GitHub repos

All of the above require dashboard access.

**What CLI CAN do:**
- `railway link` - Link local directory to existing service
- `railway up` - Deploy local code (but always uses root directory)
- `railway variables` - Set environment variables
- `railway logs` - View deployment logs
- `railway domain` - Add/manage domains

---

## Architecture Diagram

```
GitHub Repo: eddiesanjuan/glyph
           |
           +-- main branch
                  |
    +-------------+-------------+
    |             |             |
    v             v             v
glyph-api     glyph-www     glyph-sdk
(root /)      (root www/)   (root sdk/)
    |             |             |
    v             v             v
Dockerfile    www/Dockerfile  sdk/Dockerfile
    |             |             |
    v             v             v
api.glyph.run glyph.run     sdk.glyph.run
              (or www-*.railway.app)
```

---

## Troubleshooting

### Service still showing wrong content after root directory change

1. Check Build Logs - ensure the correct Dockerfile is being used
2. Redeploy: Settings > Deploy > Redeploy
3. If still wrong, delete and recreate the service

### PR Previews not appearing

1. Ensure GitHub App has correct permissions
2. Check that the GitHub repo is connected (not just CLI deployed)
3. Verify PR is to `main` branch

### Auto-deploy not triggering

1. Verify service is GitHub-connected (Settings > Source should show GitHub)
2. Check if the changed files are within the service's root directory
3. Check Railway status page for any outages

---

## Next Steps After Setup

1. Configure custom domains:
   - `glyph.run` or `www.glyph.run` -> glyph-www
   - `sdk.glyph.run` -> glyph-sdk
   - `api.glyph.run` -> glyph-api (may already be set)

2. Set up environment variables for each service as needed

3. Configure health check timeouts if deployments are slow

4. Consider setting up a staging environment for each service
