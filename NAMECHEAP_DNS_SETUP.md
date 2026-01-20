# Glyph DNS Setup Guide - Namecheap

## Domain: glyph.so (or your chosen domain)

This guide covers setting up DNS records to properly route all Glyph services.

---

## Current Architecture

| Service | Current URL | Target URL |
|---------|-------------|------------|
| Landing Page | glyph-ashen.vercel.app | glyph.so |
| API | glyph-api-production-3f73.up.railway.app | api.glyph.so |
| SDK CDN | glyph-sdk.vercel.app | cdn.glyph.so |
| Dashboard | (not deployed yet) | app.glyph.so |
| Docs | (in /docs folder) | docs.glyph.so |

---

## Step 1: Namecheap DNS Records

Log into Namecheap → Domain List → Manage → Advanced DNS

### Required DNS Records

```
Type     Host      Value                                          TTL
─────────────────────────────────────────────────────────────────────────
A        @         76.76.21.21                                    Auto
CNAME    www       cname.vercel-dns.com                          Auto
CNAME    api       glyph-api-production-3f73.up.railway.app      Auto
CNAME    cdn       cname.vercel-dns.com                          Auto
CNAME    app       cname.vercel-dns.com                          Auto
CNAME    docs      cname.vercel-dns.com                          Auto
```

### Explanation

| Record | Purpose |
|--------|---------|
| A @ → 76.76.21.21 | Root domain (glyph.so) points to Vercel |
| CNAME www | www.glyph.so redirects to Vercel |
| CNAME api | api.glyph.so routes to Railway API |
| CNAME cdn | cdn.glyph.so for SDK distribution |
| CNAME app | app.glyph.so for dashboard |
| CNAME docs | docs.glyph.so for documentation |

---

## Step 2: Vercel Domain Configuration

### For Landing Page (glyph.so)

1. Go to Vercel Dashboard → glyph-www project → Settings → Domains
2. Add domain: `glyph.so`
3. Add domain: `www.glyph.so`
4. Vercel will verify DNS and issue SSL automatically

### For SDK CDN (cdn.glyph.so)

1. Go to Vercel Dashboard → glyph-sdk project → Settings → Domains
2. Add domain: `cdn.glyph.so`
3. Update SDK references in code from `glyph-sdk.vercel.app` to `cdn.glyph.so`

### For Dashboard (app.glyph.so)

1. Deploy dashboard to Vercel first
2. Go to Vercel Dashboard → glyph-dashboard project → Settings → Domains
3. Add domain: `app.glyph.so`

### For Docs (docs.glyph.so)

1. Deploy docs to Vercel (or use existing)
2. Add domain: `docs.glyph.so`

---

## Step 3: Railway Domain Configuration

### For API (api.glyph.so)

1. Go to Railway Dashboard → glyph-api service → Settings → Networking
2. Click "Generate Domain" or "Add Custom Domain"
3. Enter: `api.glyph.so`
4. Railway will provide verification instructions
5. SSL is automatic

---

## Step 4: Update Code References

After DNS propagates (up to 48 hours, usually 5-30 minutes), update these files:

### Landing Page (www/index.html)

```javascript
// Change SDK URL
// FROM: https://glyph-sdk.vercel.app/glyph.min.js
// TO:   https://cdn.glyph.so/glyph.min.js

// Change API URL
// FROM: https://glyph-api-production-3f73.up.railway.app
// TO:   https://api.glyph.so
```

### Documentation

```markdown
// Update all SDK references
// FROM: https://cdn.glyph.so/v1.js (incorrect)
// TO:   https://cdn.glyph.so/glyph.min.js
```

### SDK Build Config

Update any hardcoded API URLs in the SDK source.

---

## Step 5: Verify Setup

After DNS propagates, test each subdomain:

```bash
# Test root domain
curl -I https://glyph.so

# Test API
curl https://api.glyph.so/health

# Test SDK
curl -I https://cdn.glyph.so/glyph.min.js

# Test Dashboard
curl -I https://app.glyph.so

# Test Docs
curl -I https://docs.glyph.so
```

---

## DNS Propagation Check

Use these tools to verify DNS propagation:

- https://dnschecker.org
- https://www.whatsmydns.net

Enter each subdomain and verify the CNAME/A records resolve correctly.

---

## SSL Certificates

Both Vercel and Railway automatically provision SSL certificates via Let's Encrypt. No manual certificate setup required.

---

## Troubleshooting

### "DNS_PROBE_FINISHED_NXDOMAIN"
- DNS hasn't propagated yet
- Wait 5-30 minutes and try again
- Clear browser DNS cache: `chrome://net-internals/#dns`

### "ERR_SSL_VERSION_OR_CIPHER_MISMATCH"
- SSL certificate not yet issued
- Wait a few minutes for Vercel/Railway to provision cert

### Vercel says "Invalid Configuration"
- Ensure CNAME points to `cname.vercel-dns.com` exactly
- Remove any conflicting A records for subdomains

### Railway custom domain not working
- Verify CNAME record points to Railway URL
- Check Railway dashboard for domain verification status

---

## Final Checklist

- [ ] Namecheap DNS records added
- [ ] Vercel domains configured for landing page
- [ ] Vercel domains configured for SDK CDN
- [ ] Vercel domains configured for dashboard
- [ ] Vercel domains configured for docs
- [ ] Railway custom domain configured for API
- [ ] DNS propagation verified
- [ ] SSL working on all subdomains
- [ ] Code references updated to use new domains
- [ ] All endpoints tested and working
