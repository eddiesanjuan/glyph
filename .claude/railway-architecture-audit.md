# Glyph Railway Migration Architecture Audit

**Audit Date:** 2026-01-19
**Auditor:** Auditor Agent
**Scope:** Railway configuration, security, performance, cost optimization

---

## Executive Summary

The Glyph Railway migration architecture is generally well-structured for a multi-service deployment. However, there are **3 Critical**, **4 High**, and **5 Medium** severity issues that should be addressed before or shortly after production deployment. The most urgent concerns are:

1. **Missing security headers** on Railway-served static files (www, sdk)
2. **Demo API key hardcoded** in public HTML
3. **In-memory rate limiting** won't scale across multiple instances
4. **No compression** configured for static file servers

The architecture decision to use separate services (www, sdk, api) is sound for isolation but may be over-engineered for current scale. SDK consolidation into www is recommended.

---

## Critical Findings

### Finding: Demo API Key Exposed in Public HTML

**Severity:** Critical
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/www/index.html:4668`
```javascript
const DEMO_API_KEY = 'gk_demo_playground_2024'; // Demo key for playground
```

#### Problem
The demo API key is hardcoded in client-side JavaScript that ships to every browser. While this is labeled as a "demo" key, it still:
- Allows anyone to consume your API quota for demo functionality
- Could be abused for testing/scraping if not properly rate-limited
- Creates confusion about key management patterns

#### Recommended Fix
1. Create a dedicated public demo endpoint that doesn't require auth:
```typescript
// api/src/index.ts - Add public demo route
app.post("/demo/preview", async (c) => {
  // Apply strict demo-only rate limiting by IP
  // Limited template options, watermarked output
  return handleDemoPreview(c);
});
```

2. Or inject the demo key at build time via environment variable:
```javascript
// www/index.html
const DEMO_API_KEY = '__DEMO_API_KEY__'; // Replaced at build time
```

3. In `Dockerfile.www`, add build-time replacement:
```dockerfile
ARG DEMO_API_KEY
RUN sed -i "s/__DEMO_API_KEY__/$DEMO_API_KEY/g" index.html
```

#### Acceptance Criteria
- [ ] Demo API key is not visible in source view of production page
- [ ] Demo functionality still works with same UX
- [ ] Demo endpoint has stricter rate limiting (5 req/min per IP)

---

### Finding: Missing Security Headers on Static Services

**Severity:** Critical
**Type:** Security
**Effort:** Medium (1-4hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/www/vercel.json` has security headers configured:
```json
{
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-XSS-Protection", "value": "1; mode=block" }
  ]
}
```

But `serve` in the Railway Dockerfiles does not apply these headers. The `serve` npm package does not support custom headers via CLI flags.

`/Users/eddiesanjuan/Projects/glyph/Dockerfile.www:13`
```dockerfile
CMD ["serve", ".", "-s", "-l", "3000"]
```

#### Problem
Static files served via Railway will lack:
- Content-Type-Options (MIME sniffing protection)
- X-Frame-Options (clickjacking protection)
- X-XSS-Protection (legacy XSS protection)
- Content-Security-Policy (critical for SDK pages)
- Strict-Transport-Security (HSTS)

#### Recommended Fix
**Option A (Recommended):** Replace `serve` with a lightweight Express/Fastify server with headers:

Create `/Users/eddiesanjuan/Projects/glyph/www/server.js`:
```javascript
const express = require('express');
const path = require('path');
const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve static files with caching
app.use(express.static('.', {
  maxAge: '1d',
  etag: true
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => console.log('www listening on 3000'));
```

Update `Dockerfile.www`:
```dockerfile
FROM node:20-slim
WORKDIR /app
RUN npm install express
COPY www/ .
EXPOSE 3000
CMD ["node", "server.js"]
```

**Option B:** Use Caddy as a lightweight server with automatic headers.

#### Acceptance Criteria
- [ ] `curl -I https://glyph.so` returns X-Content-Type-Options header
- [ ] `curl -I https://glyph.so` returns X-Frame-Options header
- [ ] `curl -I https://glyph.so` returns Strict-Transport-Security header
- [ ] SDK service has same headers

---

### Finding: In-Memory Rate Limiting Won't Scale

**Severity:** Critical
**Type:** Code
**Effort:** Medium (1-4hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/api/src/middleware/rateLimit.ts:36`
```typescript
// In-memory rate tracking (would use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();
```

#### Problem
Railway scales by adding instances. With in-memory rate limiting:
- Each instance has its own limit counter
- A user could make 10 requests per minute PER INSTANCE
- With 3 instances, effective limit becomes 30 req/min instead of 10
- No protection against distributed attacks

#### Recommended Fix
Add Railway-compatible Redis integration:

1. Add `upstash/redis` dependency (serverless Redis, works well with Railway):
```bash
npm install @upstash/redis
```

2. Update `/Users/eddiesanjuan/Projects/glyph/api/src/middleware/rateLimit.ts`:
```typescript
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Fallback to in-memory for local dev
const rateLimitStore = new Map<string, RateLimitEntry>();

export async function rateLimitMiddleware(c: Context, next: Next) {
  const key = apiKeyId ? `rate:${apiKeyId}` : `rate:ip:${getClientIP(c)}`;
  const config = TIER_LIMITS[tier] || TIER_LIMITS.free;

  if (redis) {
    // Production: Use Redis with TTL
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, Math.ceil(config.windowMs / 1000));
    }

    if (count > config.maxRequests) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }
  } else {
    // Local dev: Use in-memory (existing logic)
    // ... existing code
  }

  await next();
}
```

3. Add Upstash Redis to Railway project (free tier: 10K commands/day).

#### Acceptance Criteria
- [ ] Rate limiting persists across Railway deployments
- [ ] Rate limiting is consistent across multiple instances
- [ ] Local development still works without Redis
- [ ] Upstash Redis dashboard shows rate limit keys

---

## High Severity Findings

### Finding: No Compression for Static Assets

**Severity:** High
**Type:** Performance
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/Dockerfile.www:13`
```dockerfile
CMD ["serve", ".", "-s", "-l", "3000"]
```

The `serve` package does not enable compression by default.

#### Problem
- `index.html` is ~86KB uncompressed (from token count estimate)
- SDK JS files typically 20-50KB
- No gzip/brotli = ~3x larger transfers
- Slower initial page load, especially on mobile

#### Recommended Fix
If using the Express server from the security headers fix:
```javascript
const compression = require('compression');
app.use(compression());
```

Add to package.json: `"compression": "^1.7.4"`

Alternatively, add a Railway-level CDN or Cloudflare proxy which handles compression automatically.

#### Acceptance Criteria
- [ ] Response includes `Content-Encoding: gzip` or `br` header
- [ ] Lighthouse performance score improves by 5+ points
- [ ] Network tab shows compressed transfer sizes

---

### Finding: CORS Configuration Too Permissive

**Severity:** High
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/api/src/index.ts:52`
```typescript
// In production, could restrict further
return origin; // Allow all for now during beta
```

#### Problem
The CORS middleware allows ANY origin in production. This means:
- Any website can make API calls using a user's session
- Increases XSS attack surface
- Violates principle of least privilege

#### Recommended Fix
Update `/Users/eddiesanjuan/Projects/glyph/api/src/index.ts`:
```typescript
cors({
  origin: (origin) => {
    if (!origin) return origin; // Allow curl/mobile
    if (origin.includes("localhost")) return origin; // Dev

    // Explicit allowlist for production
    const allowed = [
      'https://glyph.so',
      'https://www.glyph.so',
      'https://glyph.dev',
      'https://app.glyph.so',
      /\.glyph\.so$/,  // Subdomains
      /\.vercel\.app$/, // Preview deployments (remove after migration)
    ];

    if (allowed.some(a =>
      typeof a === 'string' ? origin === a : a.test(origin)
    )) {
      return origin;
    }

    // Reject unknown origins
    return null;
  },
  // ... rest of config
})
```

#### Acceptance Criteria
- [ ] API returns CORS error for requests from `https://evil.com`
- [ ] API still works from `https://glyph.so`
- [ ] SDK demos on customer sites still work (they use direct API calls, not CORS)

---

### Finding: API URL Detection Logic is Redundant

**Severity:** High
**Type:** Code
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/www/index.html:4657-4667`
```javascript
const API_URL = (() => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  // Railway internal networking for speed
  if (window.location.hostname.includes('.railway.app')) {
    return 'https://glyph-api-production-3f73.up.railway.app'; // Same for now, internal later
  }
  // Custom domain fallback
  return 'https://glyph-api-production-3f73.up.railway.app';
})();
```

#### Problem
1. The comment "internal later" is misleading - client-side JS CANNOT use Railway internal URLs (`http://service.railway.internal`). Those only work for server-to-server communication.
2. All branches except localhost return the same URL, making the conditional pointless.
3. Hardcoding the Railway URL creates coupling.

#### Recommended Fix
```javascript
const API_URL = (() => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  // Production API - use custom domain when ready
  return 'https://api.glyph.so';
})();
```

For Railway, set up the custom domain `api.glyph.so` pointing to the glyph-api service.

#### Acceptance Criteria
- [ ] API_URL logic is simplified to two cases: localhost vs production
- [ ] `api.glyph.so` custom domain is configured in Railway
- [ ] Landing page playground works with new URL

---

### Finding: Health Check Configuration Inconsistencies

**Severity:** High
**Type:** Code
**Effort:** Small (<1hr)

#### Current State
Different services have different health check configurations:

| Service | Path | Timeout |
|---------|------|---------|
| API (`/Users/eddiesanjuan/Projects/glyph/railway.toml`) | `/health` | 60s |
| www (`/Users/eddiesanjuan/Projects/glyph/www/railway.toml`) | `/` | 30s |
| SDK (`/Users/eddiesanjuan/Projects/glyph/sdk/railway.toml`) | `/glyph.min.js` | 30s |
| Dashboard (`/Users/eddiesanjuan/Projects/glyph/dashboard/railway.toml`) | `/` | 10s |

#### Problem
- SDK health check path `/glyph.min.js` returns the actual SDK file, wasting bandwidth
- Dashboard timeout of 10s is too aggressive for cold starts
- No health check endpoint returns actual service health (just "file exists")

#### Recommended Fix
1. For www/sdk, check for a lightweight file or add a health endpoint
2. Standardize timeouts based on cold start times

Update `/Users/eddiesanjuan/Projects/glyph/www/railway.toml`:
```toml
[deploy]
healthcheckPath = "/health.txt"  # Create a 4-byte file
healthcheckTimeout = 30
```

Create `/Users/eddiesanjuan/Projects/glyph/www/health.txt`:
```
OK
```

Update SDK similarly.

#### Acceptance Criteria
- [ ] All services use lightweight health check endpoints
- [ ] Health checks complete in <1s under normal conditions
- [ ] Railway shows green health status for all services

---

## Medium Severity Findings

### Finding: Playwright Browser Pool Size Too Small

**Severity:** Medium
**Type:** Performance
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/api/src/services/pdf.ts:14`
```typescript
const MAX_POOL_SIZE = 3;
```

#### Problem
With 3 pages in the pool:
- 4th concurrent request must wait for a page
- Batch jobs (up to 100 PDFs) will serialize
- Memory is barely saved (Chromium context is lightweight)

#### Recommended Fix
```typescript
// Scale pool based on available memory
// Each page uses ~50MB, Chromium base ~100MB
const MAX_POOL_SIZE = Math.min(
  parseInt(process.env.PDF_POOL_SIZE || '10'),
  Math.floor((parseInt(process.env.MEMORY_MB || '512') - 100) / 50)
);
```

Set `PDF_POOL_SIZE=10` and `MEMORY_MB=1024` in Railway environment.

#### Acceptance Criteria
- [ ] Pool size is configurable via environment
- [ ] Batch jobs of 10 PDFs complete 2x faster
- [ ] Memory usage stays under Railway container limits

---

### Finding: SDK Could Be Served from www Service

**Severity:** Medium
**Type:** Cost
**Effort:** Medium (1-4hr)

#### Current State
Separate services:
- `glyph-www` - Landing page
- `glyph-sdk` - SDK JS/CSS files

#### Problem
Running a separate Railway service for SDK adds:
- Minimum $5/month in compute
- Additional deployment complexity
- Another domain to manage
- No real isolation benefit (both are static files)

#### Recommended Fix
Consolidate SDK into www service:

1. Update www build to include SDK:
```dockerfile
# Dockerfile.www
FROM node:20-slim
WORKDIR /app

# Build SDK first
COPY sdk/package*.json ./sdk/
RUN cd sdk && npm install
COPY sdk/ ./sdk/
RUN cd sdk && npm run build

# Copy www files
COPY www/ ./www/

# Move SDK dist to www/sdk/
RUN mkdir -p www/sdk && cp sdk/dist/* www/sdk/

# Serve from www
WORKDIR /app/www
RUN npm install express compression
EXPOSE 3000
CMD ["node", "server.js"]
```

2. Update SDK references:
```html
<!-- Before -->
<script src="https://sdk.glyph.so/glyph.min.js"></script>

<!-- After -->
<script src="https://glyph.so/sdk/glyph.min.js"></script>
```

3. Sunset the glyph-sdk Railway service.

#### Acceptance Criteria
- [ ] `https://glyph.so/sdk/glyph.min.js` returns the SDK
- [ ] Existing SDK URLs redirect or continue working (CDN/redirect rule)
- [ ] One fewer Railway service to manage

---

### Finding: Missing Request Timeout on PDF Generation

**Severity:** Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/api/src/services/pdf.ts:88-91`
```typescript
await page.setContent(html, {
  waitUntil: 'networkidle',
  timeout: 30000,
});
```

#### Problem
- `networkidle` waits for network to be quiet, but malicious HTML could keep connections open
- 30s timeout per operation, but multiple operations = potentially 90s+ request
- No global request timeout

#### Recommended Fix
Add a global timeout wrapper in the generate route:

`/Users/eddiesanjuan/Projects/glyph/api/src/routes/generate.ts`:
```typescript
import { setTimeout } from 'timers/promises';

app.post("/", async (c) => {
  const controller = new AbortController();
  const timeout = setTimeout(45000).then(() => {
    controller.abort();
    throw new Error("PDF generation timeout");
  });

  try {
    const result = await Promise.race([
      generatePDF(html, options),
      timeout
    ]);
    return c.json(result);
  } catch (err) {
    if (err.message === "PDF generation timeout") {
      return c.json({ error: "Request timeout" }, 504);
    }
    throw err;
  }
});
```

#### Acceptance Criteria
- [ ] PDF generation requests timeout after 45s maximum
- [ ] Client receives 504 on timeout, not hanging connection
- [ ] Playwright page is properly cleaned up on timeout

---

### Finding: No Content-Security-Policy for API Responses

**Severity:** Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
The API returns JSON responses but does not set CSP headers.

#### Problem
While JSON APIs don't typically need CSP, the API serves:
- HTML previews (could contain scripts)
- PDFs (could contain embedded content)

Without CSP, if an attacker injects HTML into a preview response, the browser will execute it.

#### Recommended Fix
Add CSP middleware in `/Users/eddiesanjuan/Projects/glyph/api/src/index.ts`:
```typescript
// After cors middleware
app.use('*', async (c, next) => {
  await next();

  // Only add CSP to HTML responses
  const contentType = c.res.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    c.header('Content-Security-Policy',
      "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com; " +
      "font-src 'self' fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "script-src 'none';" // Prevent any scripts in previews
    );
  }
});
```

#### Acceptance Criteria
- [ ] `/v1/preview` responses include CSP header
- [ ] Inline scripts in preview HTML are blocked by browser
- [ ] Styles and fonts still load correctly

---

### Finding: No Graceful Shutdown Handling

**Severity:** Medium
**Type:** Code
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/api/src/services/pdf.ts:194-196`
```typescript
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

But the main server doesn't handle graceful shutdown.

#### Problem
When Railway restarts the service:
- In-flight requests are terminated abruptly
- Users see 502 errors
- PDF generation might leave orphaned processes

#### Recommended Fix
Update `/Users/eddiesanjuan/Projects/glyph/api/src/index.ts`:
```typescript
const server = serve({
  fetch: app.fetch,
  port,
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Wait for in-flight requests (max 10s)
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Cleanup Playwright
  await cleanup();

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Update Railway config to allow graceful shutdown:
```toml
[deploy]
# ... existing config
gracePeriodSeconds = 15
```

#### Acceptance Criteria
- [ ] Deployments don't cause user-visible errors
- [ ] In-flight PDF generations complete before shutdown
- [ ] Logs show "shutting down gracefully" message

---

## Low Severity Findings

### Finding: Dockerfile Uses node:20-slim Instead of Alpine

**Severity:** Low
**Type:** Performance
**Effort:** Small (<1hr)

#### Current State
All Dockerfiles use `node:20-slim` (~180MB).

#### Problem
`node:20-alpine` is ~50MB smaller, faster to pull/deploy.

However, Playwright requires Debian-based images for browser dependencies, so the API Dockerfile correctly uses slim.

#### Recommended Fix
For www and sdk services ONLY (no Playwright):
```dockerfile
FROM node:20-alpine
# ... rest of dockerfile
```

Keep API on `node:20-slim` for Playwright compatibility.

#### Acceptance Criteria
- [ ] www and sdk images are <150MB
- [ ] Deployment times decrease by ~10s

---

### Finding: Missing Dockerfile Layer Caching Optimization

**Severity:** Low
**Type:** Performance
**Effort:** Small (<1hr)

#### Current State
`/Users/eddiesanjuan/Projects/glyph/Dockerfile:21-22`
```dockerfile
COPY api/src ./src
COPY api/tsconfig.json ./
```

#### Problem
Any change to `src/` invalidates the layer, forcing `npm install` to re-run.

#### Recommended Fix
```dockerfile
# Already good - package.json copied first
COPY api/package*.json ./
RUN npm install

# Good - Playwright installed after npm
RUN npx playwright install chromium --with-deps

# Source last - changes don't invalidate npm cache
COPY api/src ./src
COPY api/tsconfig.json ./
```

Current Dockerfile is actually well-optimized. No change needed.

---

## Positive Observations

1. **Good API structure**: Hono framework with proper middleware separation (auth, rate limiting) is clean and maintainable.

2. **Tier-based rate limiting**: The `TIER_LIMITS` and `MONTHLY_LIMITS` configuration is well-designed and easy to adjust.

3. **API key security**: Keys are hashed before storage, key format validation exists, and expiration is checked.

4. **Playwright browser pooling**: The page pool pattern avoids cold-start latency on PDF generation.

5. **Railway configuration**: Using `restartPolicyType = "on_failure"` with retry limits is a good resilience pattern.

6. **TypeScript throughout**: Consistent type safety across the codebase.

---

## Architecture Recommendations

### Recommended Service Topology

| Service | Status | Notes |
|---------|--------|-------|
| glyph-api | Keep | Core service, cannot consolidate |
| glyph-www | Keep + enhance | Add SDK files, security headers, compression |
| glyph-sdk | Remove | Consolidate into www |
| glyph-dashboard | Keep | Separate app with auth, makes sense isolated |

### Internal Networking Note

The mission mentioned investigating Railway private networking for speed. Important clarification:

**Railway internal URLs (`http://service.railway.internal`) only work for server-to-server communication.**

Client-side JavaScript (running in user browsers) cannot access these URLs. The browser is not inside the Railway network.

**Options for speed improvement:**
1. **Edge functions**: Deploy API preview endpoint to edge (Cloudflare Workers, Vercel Edge)
2. **CDN caching**: Add Cloudflare in front of API for cacheable responses
3. **Optimistic UI**: Show placeholder while API loads
4. **Preconnect hints**: `<link rel="preconnect" href="https://api.glyph.so">`

---

## Priority Implementation Order

1. **Week 1 - Critical Security**
   - [ ] Remove hardcoded demo API key
   - [ ] Add security headers to static servers
   - [ ] Add Redis for distributed rate limiting

2. **Week 2 - High Priority**
   - [ ] Configure compression
   - [ ] Restrict CORS origins
   - [ ] Fix API URL detection logic
   - [ ] Standardize health checks

3. **Week 3 - Optimization**
   - [ ] Consolidate SDK into www
   - [ ] Increase Playwright pool size
   - [ ] Add request timeouts
   - [ ] Add CSP headers

4. **Week 4 - Polish**
   - [ ] Graceful shutdown handling
   - [ ] Alpine images for static services
   - [ ] Documentation updates

---

## Cost Analysis

### Current Architecture (4 services)
| Service | Estimated Cost |
|---------|---------------|
| glyph-api | $10-25/mo (Playwright memory needs) |
| glyph-www | $5/mo minimum |
| glyph-sdk | $5/mo minimum |
| glyph-dashboard | $5/mo minimum |
| **Total** | **$25-40/mo** |

### Optimized Architecture (3 services)
| Service | Estimated Cost |
|---------|---------------|
| glyph-api | $10-25/mo |
| glyph-www (with SDK) | $5/mo |
| glyph-dashboard | $5/mo |
| Upstash Redis | $0 (free tier) |
| **Total** | **$20-35/mo** |

**Savings: ~$5/mo** by consolidating SDK + proper Redis free tier usage.

---

*Report generated by Auditor Agent. Findings are recommendations only - implementation decisions rest with the development team.*
