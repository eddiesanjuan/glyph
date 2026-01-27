---
title: Rate Limits
description: Understanding Glyph API rate limits
---

import { Aside } from '@astrojs/starlight/components';

Glyph implements rate limiting to ensure fair usage and maintain service quality. This guide explains how rate limits work and how to handle them in your application.

## Rate Limit Tiers

Rate limits are based on your subscription tier:

| Tier | Requests/Minute | Monthly PDFs | Price |
|------|-----------------|--------------|-------|
| <span class="tier-badge free">Free</span> | 10 | 100 | $0 |
| <span class="tier-badge pro">Pro</span> | 60 | 1,000 | $29/mo |
| <span class="tier-badge scale">Scale</span> | 120 | 10,000 | $99/mo |
| <span class="tier-badge enterprise">Enterprise</span> | 300 | Unlimited | Custom |

## Types of Limits

### Per-Minute Rate Limit

Applies to all API endpoints. Resets every 60 seconds.

### Monthly PDF Limit

Applies only to `/v1/generate` endpoint. Resets on the 1st of each month.

## Rate Limit Headers

Every API response includes rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705320060
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets |

For the generate endpoint, additional headers show monthly usage:

```http
X-Monthly-Limit: 1000
X-Monthly-Used: 150
X-Monthly-Remaining: 850
```

## Rate Limit Exceeded

### Per-Minute Limit Exceeded

HTTP Status: `429 Too Many Requests`

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45,
  "tier": "free",
  "limit": 10,
  "windowMs": 60000
}
```

The `Retry-After` header indicates seconds until you can retry:

```http
Retry-After: 45
```

### Monthly Limit Exceeded

HTTP Status: `429 Too Many Requests`

```json
{
  "error": "Monthly PDF limit exceeded",
  "code": "MONTHLY_LIMIT_EXCEEDED",
  "limit": 100,
  "used": 100,
  "tier": "free",
  "upgrade": "https://glyph.you/pricing"
}
```

## Handling Rate Limits

### JavaScript with Retry Logic

```javascript
async function callGlyphAPI(endpoint, data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`https://api.glyph.you${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return response.json();
  }

  throw new Error('Max retries exceeded');
}
```

### Python with Exponential Backoff

```python
import time
import requests
from requests.exceptions import HTTPError

def call_glyph_api(endpoint, data, max_retries=3):
    for i in range(max_retries):
        response = requests.post(
            f'https://api.glyph.you{endpoint}',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json=data
        )

        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            print(f'Rate limited. Retrying in {retry_after} seconds...')
            time.sleep(retry_after)
            continue

        response.raise_for_status()
        return response.json()

    raise Exception('Max retries exceeded')
```

## Best Practices

### 1. Monitor Your Usage

Track the rate limit headers in your application:

```javascript
function logRateLimits(response) {
  console.log({
    limit: response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    reset: new Date(response.headers.get('X-RateLimit-Reset') * 1000)
  });
}
```

### 2. Implement Request Queuing

For high-volume applications, queue requests to stay within limits:

```javascript
class RateLimitedQueue {
  constructor(requestsPerMinute) {
    this.interval = 60000 / requestsPerMinute;
    this.queue = [];
    this.processing = false;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    }

    setTimeout(() => {
      this.processing = false;
      this.process();
    }, this.interval);
  }
}

// Usage
const queue = new RateLimitedQueue(60); // 60 requests per minute

await queue.add(() => glyphApi.preview(template, data));
```

### 3. Cache Responses

Cache preview responses to avoid redundant API calls:

```javascript
const previewCache = new Map();

async function getPreview(template, data) {
  const cacheKey = `${template}-${JSON.stringify(data)}`;

  if (previewCache.has(cacheKey)) {
    return previewCache.get(cacheKey);
  }

  const result = await glyphApi.preview(template, data);
  previewCache.set(cacheKey, result);

  return result;
}
```

### 4. Batch Operations

If modifying multiple documents, space out requests:

```javascript
async function batchModify(sessions, modifications) {
  const results = [];

  for (const [sessionId, prompt] of Object.entries(modifications)) {
    const result = await glyphApi.modify(sessionId, prompt);
    results.push(result);

    // Wait 1 second between requests to stay well under limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
```

## Upgrading Your Tier

If you're consistently hitting rate limits, consider upgrading:

1. Go to [glyph.you/dashboard](https://dashboard.glyph.you)
2. Navigate to **Billing**
3. Select a higher tier
4. Your new limits apply immediately

<Aside type="tip">
Enterprise customers can request custom rate limits. Contact sales@glyph.you for details.
</Aside>

## Questions?

- Check your current usage in the [dashboard](https://glyph.you/dashboard)
- Contact support@glyph.you for rate limit increases
- Enterprise customers: Contact your account manager
