# Glyph Railway Migration QA Report

**QA Date:** 2026-01-19
**QA Agent:** QA Agent
**Status:** BLOCKED - Deployments Not Complete

---

## Executive Summary

The Railway migration for www and SDK services has **not been deployed yet**. The `glyph-www-production.up.railway.app` URL currently serves the API instead of the landing page. Testing is blocked until the developer completes the deployment.

---

## Environment Check Results

### Service URLs Tested

| Service | URL | Status | Response |
|---------|-----|--------|----------|
| API | `https://glyph-api-production-3f73.up.railway.app` | LIVE | API JSON (correct) |
| www | `https://glyph-www-production.up.railway.app` | MISCONFIGURED | API JSON (wrong) |
| SDK | `https://glyph-sdk-production.up.railway.app/glyph.min.js` | NOT FOUND | 404 |

### Evidence

```bash
# www service returning API response (WRONG)
$ curl -s "https://glyph-www-production.up.railway.app" | head -1
{"name":"Glyph API","version":"0.9.0"...}

# Both endpoints return identical health checks
$ curl -s "https://glyph-api-production-3f73.up.railway.app/health"
{"status":"ok","version":"0.9.0","timestamp":"2026-01-20T01:21:25.382Z"}

$ curl -s "https://glyph-www-production.up.railway.app/health"
{"status":"ok","version":"0.9.0","timestamp":"2026-01-20T01:21:27.792Z"}
```

---

## Root Cause Analysis

### Git Status Shows Uncommitted Migration Files

```
Changes not staged for commit:
  modified:   www/index.html
  modified:   www/railway.toml

Untracked files:
  Dockerfile.sdk
  Dockerfile.www
  sdk/Dockerfile
  sdk/railway.toml
  www/Dockerfile
```

### The Problem

1. **www service** is pointing to the root project `Dockerfile` (API) instead of `www/Dockerfile`
2. **SDK service** does not exist on Railway yet
3. The Dockerfile and railway.toml changes have not been committed or deployed

### Railway Configuration Issue

The root `railway.toml` specifies:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"  # Points to API Dockerfile
```

The www service needs to use the subdirectory-specific configuration in `www/railway.toml`:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"  # Should use www/Dockerfile
```

---

## Blocking Issues

### CRITICAL: www Service Serving API Instead of Landing Page

- **Severity:** Critical (Blocking)
- **Description:** The glyph-www Railway service is deploying from the wrong Dockerfile
- **Expected:** Landing page HTML at root URL
- **Actual:** API JSON response at root URL
- **Fix Required:**
  1. Commit the www/Dockerfile and www/railway.toml changes
  2. Configure Railway service to deploy from `www/` subdirectory
  3. Trigger redeploy

### CRITICAL: SDK Service Not Deployed

- **Severity:** Critical (Blocking)
- **Description:** No SDK Railway service exists or returns 404
- **Expected:** `glyph.min.js` accessible at SDK URL
- **Actual:** 404 Not Found
- **Fix Required:**
  1. Create glyph-sdk service in Railway project
  2. Point it to the `sdk/` subdirectory
  3. Deploy with proper configuration

---

## Tests Not Executed (Blocked)

The following tests could not be run due to deployment issues:

### Landing Page Tests
- [ ] Page loads without errors - **BLOCKED**
- [ ] All CSS/JS loads correctly - **BLOCKED**
- [ ] Demo playground renders - **BLOCKED**
- [ ] Can type in demo input - **BLOCKED**
- [ ] Demo API calls work - **BLOCKED**
- [ ] Mobile responsive layout - **BLOCKED**

### SDK Tests
- [ ] `glyph.min.js` accessible - **BLOCKED**
- [ ] `glyph.esm.js` accessible - **BLOCKED**
- [ ] `style.css` accessible - **BLOCKED**
- [ ] CORS headers correct - **BLOCKED**
- [ ] Cache headers appropriate - **BLOCKED**

### Integration Tests
- [ ] Landing page loads SDK - **BLOCKED**
- [ ] Demo modifications work - **BLOCKED**
- [ ] PDF download works - **BLOCKED**

### Latency Measurements
- [ ] Compare Vercel vs Railway latency - **BLOCKED**

---

## API Service (Verified Working)

The API service is correctly deployed and functioning:

```bash
$ curl -s "https://glyph-api-production-3f73.up.railway.app/health"
{"status":"ok","version":"0.9.0","timestamp":"2026-01-20T01:21:25.382Z"}
```

API endpoints verified:
- GET /health - Working
- Root endpoint - Returns API documentation JSON

---

## Developer Action Required

Before QA can continue, the developer must:

1. **Commit migration files:**
   ```bash
   git add www/Dockerfile www/railway.toml sdk/Dockerfile sdk/railway.toml
   git commit -m "feat: Add Railway Dockerfiles for www and sdk services"
   git push
   ```

2. **Configure Railway services correctly:**
   - Create `glyph-sdk` service pointing to `sdk/` subdirectory
   - Reconfigure `glyph-www` service to use `www/` subdirectory
   - OR use the root-level Dockerfile.www and Dockerfile.sdk with proper service configuration

3. **Verify deployments:**
   - `https://glyph-www-production.up.railway.app` should return HTML
   - `https://glyph-sdk-production.up.railway.app/glyph.min.js` should return JavaScript

4. **Notify QA:** Once deployed, ping QA agent to resume testing

---

## Recommendation

**DO NOT MERGE** - The Railway migration is incomplete. The www and SDK services are not properly deployed.

Once the developer fixes the deployment configuration and the services are live, QA testing can proceed with:
- Visual testing via Agent Browser CLI
- Latency measurements
- Full integration testing
- Mobile responsiveness verification

---

## Reference Documents

- Architecture Audit: `/Users/eddiesanjuan/Projects/glyph/.claude/railway-architecture-audit.md`
- Production QA Report (Vercel): `/Users/eddiesanjuan/Projects/glyph/.claude/production-qa-report.md`
- Landing Page Audit: `/Users/eddiesanjuan/Projects/glyph/.claude/landing-page-audit.md`

---

*Report generated by QA Agent. Awaiting deployment completion to resume testing.*
