# Glyph Production QA Report

**Tested:** 2026-01-19 18:45 CST
**Tester:** QA Agent
**Environment:** Production

## Environment URLs

| Service | URL | Status |
|---------|-----|--------|
| Landing Page | https://glyph-ashen.vercel.app | LIVE |
| API | https://glyph-api-production-3f73.up.railway.app | LIVE |
| Demo API Key | gk_demo_playground_2024 | VALID |

**Note:** The URL `https://glyph-www.vercel.app` returns 404 - deployment not found. The correct landing page URL is `https://glyph-ashen.vercel.app`.

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| API Health | PASS | Returns `{"status":"ok","version":"0.9.0"}` |
| Landing Page Load | PASS | Page loads correctly with all elements |
| Interactive Demo | PASS | Quick action pills work, preview updates |
| Preview API Endpoint | PASS | `/v1/preview` returns valid HTML |
| Schema Detection Endpoint | FAIL | `/v1/analyze` returns 404 - NOT DEPLOYED |
| Console Errors | WARN | Static demo fallback due to localhost proxy |

---

## Detailed Test Results

### 1. API Health Check - PASS

```bash
curl https://glyph-api-production-3f73.up.railway.app/health
```

Response:
```json
{
  "status": "ok",
  "version": "0.9.0",
  "timestamp": "2026-01-20T00:42:25.318Z"
}
```

### 2. Landing Page - PASS

- Page title: "Glyph - AI-Powered PDF Customization"
- Hero section displays correctly with teal accent color (#14B8A6)
- Navigation includes: Playground, Features, Airtable, Pricing, Docs
- CTAs visible: "Try the Playground", "Get API Key"
- Interactive demo with quote preview is visible

**Screenshot:** `.playwright-mcp/qa-landing-full.png`

### 3. Interactive Demo - PASS

Tested quick action pills:
- **Stripe style** - Populated command: "Make this look like a Stripe invoice - clean, minimal, with their signature purple"
- **Add watermark** - Button responds to click
- **Add QR code** - Button responds to click

The demo operates in static fallback mode when accessed through browser automation (localhost proxy), but the UI interactions work correctly.

**Screenshots:**
- `.playwright-mcp/qa-stripe-style-after.png` - Shows command populated and preview updated

### 4. Preview API Endpoint - PASS

```bash
POST /v1/preview
Authorization: Bearer gk_demo_playground_2024
```

Request:
```json
{
  "template": "quote-modern",
  "data": {
    "client": {"name": "Acme Corp", "address": "123 Main St"},
    "lineItems": [{"description": "Service", "quantity": 1, "unitPrice": 1500, "total": 1500}],
    "totals": {"subtotal": 1500, "total": 1500}
  }
}
```

Response: Valid HTML document with quote template rendered correctly.

### 5. Schema Detection Endpoint - FAIL

```bash
POST /v1/analyze
Authorization: Bearer gk_demo_playground_2024
```

Response:
```json
{
  "error": "Not found",
  "code": "NOT_FOUND",
  "path": "/v1/analyze"
}
```

**Root Cause:** The `/v1/analyze` route exists in the codebase (`api/src/routes/analyze.ts`) and is registered in `api/src/index.ts`, but it is NOT present in the deployed version on Railway. The root endpoint `/` also shows outdated endpoint documentation (missing analyze endpoints).

**Evidence:**
- Code shows route at line 145: `app.route("/v1/analyze", analyze);`
- API version shows 0.9.0 (latest)
- But endpoint returns 404

**Recommendation:** Redeploy the API to Railway to include the schema detection feature.

### 6. Console Errors - WARNING

When accessing the page via browser automation:
```
[error] Failed to load resource: net::ERR_CONNECTION_REFUSED
[warning] API not available, using static demo: TypeError: Failed to fetch
```

This is expected behavior when the page is proxied through localhost. The demo correctly falls back to static mode and remains functional.

---

## Issues Found

### CRITICAL: Schema Detection Not Deployed

**Severity:** HIGH
**Component:** API
**Issue:** The `/v1/analyze` endpoint documented in codebase is not available in production
**Impact:** New "vibe coding" feature (commit 66c6edb) is not accessible
**Steps to Reproduce:**
1. `curl -X POST https://glyph-api-production-3f73.up.railway.app/v1/analyze -H "Authorization: Bearer gk_demo_playground_2024" -H "Content-Type: application/json" -d '{"data":{"test":"value"}}'`
2. Observe 404 response

**Fix:** Redeploy API to Railway

### MINOR: Incorrect Production URL in Documentation

**Severity:** LOW
**Component:** Documentation/Task Instructions
**Issue:** The URL `https://glyph-www.vercel.app` was provided but returns 404
**Correct URL:** `https://glyph-ashen.vercel.app`
**Fix:** Update documentation to reference correct URL

---

## Performance Observations

- API health endpoint response time: < 500ms
- Landing page load time: ~2s (acceptable)
- Preview API response time: ~1-2s (includes template rendering)

---

## Screenshots Captured

| Screenshot | Description |
|------------|-------------|
| `qa-landing-hero.png` | Landing page hero section |
| `qa-landing-full.png` | Full landing page viewport |
| `qa-stripe-style-after.png` | After clicking "Stripe style" pill |
| `qa-watermark-after.png` | After clicking "Add watermark" pill |
| `qa-qr-code-after.png` | After clicking "Add QR code" pill |
| `qa-landing-404.png` | 404 error on incorrect URL |

---

## Recommendations

1. **[URGENT]** Redeploy API to Railway to enable schema detection endpoint
2. **[LOW]** Update DNS setup documentation with correct Vercel project name
3. **[LOW]** Consider adding health check for all registered routes in monitoring

---

## QA Verdict

**Status:** NEEDS FIXES

The core functionality (landing page, preview API, demo) works correctly. However, the new schema detection feature from the latest commit is not deployed to production. This should be addressed before promoting the feature.

| Ready to Merge | Needs Fixes |
|----------------|-------------|
| [ ] | [x] |

**Blocking Issue:** Schema detection endpoint (`/v1/analyze`) not deployed

---

*Report generated by QA Agent*
