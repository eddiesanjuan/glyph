import { useState, useEffect, useCallback } from 'preact/hooks'
import './app.css'

// Types
interface DashboardData {
  key: {
    prefix: string
    name: string
    tier: string
    createdAt: string
    lastUsedAt: string | null
  }
  usage: {
    today: number
    thisMonth: number
    pdfsGenerated: number
    monthlyLimit: number
    resetDate: string
  }
  rateLimit: {
    current: number
    limit: number
    percentage: number
  }
}

// Config - Use public URL for production, localhost for development
const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://api.glyph.you'

// Icons as inline SVGs for zero dependencies
const Icons = {
  eye: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  eyeOff: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  copy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  docs: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
}

// Tier badge colors - matching landing page navy blue palette
const tierColors: Record<string, string> = {
  free: '#64748B',
  pro: '#2563EB',
  scale: '#1E3A5F',
  enterprise: '#059669',
}

export function App() {
  const [apiKey, setApiKey] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  // Signup flow state
  const [showSignup, setShowSignup] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const fetchDashboard = useCallback(async (key: string) => {
    if (!key.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/dashboard`, {
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch dashboard')
      }

      const data = await res.json()
      setData(data)
      // Save key to localStorage for convenience
      localStorage.setItem('glyph_api_key', key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load saved key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('glyph_api_key')
    if (savedKey) {
      setApiKey(savedKey)
      fetchDashboard(savedKey)
    }
  }, [fetchDashboard])

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    fetchDashboard(apiKey)
  }

  const handleCopy = async () => {
    const keyToCopy = newKey || apiKey
    await navigator.clipboard.writeText(keyToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/keys/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to regenerate key')
      }

      const result = await res.json()
      setNewKey(result.key)
      setApiKey(result.key)
      localStorage.setItem('glyph_api_key', result.key)
      setShowConfirm(false)
      // Refresh dashboard data
      fetchDashboard(result.key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate key')
    } finally {
      setRegenerating(false)
    }
  }

  // Handle signup / get free API key
  const handleSignup = async (e: Event) => {
    e.preventDefault()
    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setSignupLoading(true)
    setError(null)

    try {
      // For now, generate a demo key format (will connect to Supabase later)
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate a unique-looking key for demo purposes
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 10)
      const demoKey = `gk_free_${timestamp}${random}`

      setGeneratedKey(demoKey)
      setSignupSuccess(true)

      console.log('[Glyph] Free API key requested for:', signupEmail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setSignupLoading(false)
    }
  }

  // Copy generated key
  const handleCopyGeneratedKey = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--error)'
    if (percentage >= 75) return 'var(--warning)'
    return 'var(--glyph-primary-bright)'
  }

  const maskedKey = apiKey ? `${apiKey.slice(0, 11)}${'*'.repeat(16)}` : ''

  return (
    <div class="dashboard">
      {/* Floating Orb Background - matches landing page */}
      <div class="gradient-mesh">
        <div class="gradient-orb gradient-orb--1" />
        <div class="gradient-orb gradient-orb--2" />
      </div>

      {/* Header */}
      <header class="header">
        <div class="header-content">
          <a href="https://glyph.you" class="logo">
            {/* G lettermark logo - matches landing page */}
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M16 2C8.268 2 2 8.268 2 16C2 23.732 8.268 30 16 30C23.732 30 30 23.732 30 16V14H16V18H25.5C24.5 22.5 20.6 26 16 26C10.477 26 6 21.523 6 16C6 10.477 10.477 6 16 6C19.5 6 22.6 7.8 24.5 10.5L28 8C25.3 4.3 21 2 16 2Z" fill="#1E3A5F"/>
            </svg>
            <span class="logo-text">Glyph</span>
          </a>
          <nav class="nav-links">
            <a href="https://glyph.you" class="nav-link">Home</a>
            <a href="https://docs.glyph.you" target="_blank" class="docs-link">
              {Icons.docs}
              <span>Docs</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main class="main">
        <div class="container">
          {/* API Key Input */}
          {!data && !showSignup && (
            <div class="auth-card animate-in">
              <h1>API Dashboard</h1>
              <p class="subtitle">Enter your API key to view usage and manage your account.</p>

              <form onSubmit={handleSubmit} class="auth-form">
                <div class="input-group">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                    placeholder="gk_..."
                    class="api-input mono"
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    class="input-action"
                    onClick={() => setShowKey(!showKey)}
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? Icons.eyeOff : Icons.eye}
                  </button>
                </div>

                <button type="submit" class="btn btn-primary" disabled={loading || !apiKey.trim()}>
                  {loading ? 'Loading...' : 'View Dashboard'}
                </button>

                {!apiKey.trim() && !loading && (
                  <p class="input-hint">Enter your API key above to continue</p>
                )}
              </form>

              {error && (
                <div class="error-banner">
                  {Icons.warning}
                  <span>{error}</span>
                </div>
              )}

              <div class="signup-divider">
                <span>or</span>
              </div>

              <button
                class="btn btn-signup"
                onClick={() => { setShowSignup(true); setError(null); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                Get a Free API Key
              </button>

              <p class="free-tier-note">Free tier: 100 PDFs/month, upgrade anytime</p>
            </div>
          )}

          {/* Signup / Get Free API Key */}
          {!data && showSignup && (
            <div class="auth-card animate-in">
              {!signupSuccess ? (
                <>
                  <h1>Get Your Free API Key</h1>
                  <p class="subtitle">Start building with Glyph. Free tier includes 100 PDFs/month.</p>

                  <form onSubmit={handleSignup} class="auth-form">
                    <div class="input-group">
                      <input
                        type="email"
                        value={signupEmail}
                        onInput={(e) => setSignupEmail((e.target as HTMLInputElement).value)}
                        placeholder="you@example.com"
                        class="api-input"
                        autoComplete="email"
                        autoFocus
                      />
                    </div>

                    <button type="submit" class="btn btn-primary" disabled={signupLoading || !signupEmail.trim()}>
                      {signupLoading ? 'Creating...' : 'Get Free API Key'}
                    </button>
                  </form>

                  {error && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    class="btn btn-ghost back-link"
                    onClick={() => { setShowSignup(false); setError(null); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    Already have a key? Sign in
                  </button>
                </>
              ) : (
                <>
                  <div class="success-icon">
                    {Icons.check}
                  </div>
                  <h1>Your API Key is Ready!</h1>
                  <p class="subtitle">Copy your key now - you won't see it again.</p>

                  <div class="generated-key-display">
                    <code class="mono">{generatedKey}</code>
                    <button class="btn btn-icon" onClick={handleCopyGeneratedKey}>
                      {copied ? Icons.check : Icons.copy}
                    </button>
                  </div>

                  <div class="signup-actions">
                    <button class="btn btn-primary" onClick={handleCopyGeneratedKey}>
                      {copied ? 'Copied!' : 'Copy Key'}
                    </button>
                  </div>

                  <div class="free-tier-features">
                    <div class="feature-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>100 PDFs per month</span>
                    </div>
                    <div class="feature-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>All templates included</span>
                    </div>
                    <div class="feature-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                      <span>Upgrade anytime</span>
                    </div>
                  </div>

                  <button
                    class="btn btn-ghost back-link"
                    onClick={() => { setShowSignup(false); setSignupSuccess(false); setGeneratedKey(null); setSignupEmail(''); }}
                  >
                    Back to sign in
                  </button>
                </>
              )}
            </div>
          )}

          {/* Dashboard Content */}
          {data && (
            <div class="dashboard-content animate-in">
              {/* New Key Alert */}
              {newKey && (
                <div class="new-key-alert">
                  <div class="alert-header">
                    <strong>New API Key Generated</strong>
                    <span>Copy it now - it won't be shown again!</span>
                  </div>
                  <div class="new-key-display">
                    <code class="mono">{newKey}</code>
                    <button class="btn btn-icon" onClick={handleCopy}>
                      {copied ? Icons.check : Icons.copy}
                    </button>
                  </div>
                  <button class="btn btn-ghost" onClick={() => setNewKey(null)}>
                    Dismiss
                  </button>
                </div>
              )}

              {/* Key Info Section */}
              <section class="section">
                <div class="section-header">
                  <h2>API Key</h2>
                  <span class="tier-badge" style={{ background: tierColors[data.key.tier] }}>
                    {data.key.tier}
                  </span>
                </div>

                <div class="key-card">
                  <div class="key-display">
                    <code class="mono">{showKey ? apiKey : maskedKey}</code>
                    <div class="key-actions">
                      <button
                        class="btn btn-icon"
                        onClick={() => setShowKey(!showKey)}
                        aria-label={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? Icons.eyeOff : Icons.eye}
                      </button>
                      <button
                        class="btn btn-icon"
                        onClick={handleCopy}
                        aria-label="Copy key"
                      >
                        {copied ? Icons.check : Icons.copy}
                      </button>
                    </div>
                  </div>

                  <div class="key-meta">
                    <span>Name: {data.key.name}</span>
                    <span>Created: {formatDate(data.key.createdAt)}</span>
                    <span>Last used: {formatDate(data.key.lastUsedAt)}</span>
                  </div>

                  <div class="key-footer">
                    <button
                      class="btn btn-danger-outline"
                      onClick={() => setShowConfirm(true)}
                    >
                      {Icons.refresh}
                      <span>Regenerate Key</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Usage Stats */}
              <section class="section">
                <h2>Usage</h2>

                <div class="stats-grid">
                  <div class="stat-card">
                    <span class="stat-label">Today</span>
                    <span class="stat-value">{data.usage.today}</span>
                    <span class="stat-unit">requests</span>
                  </div>

                  <div class="stat-card">
                    <span class="stat-label">This Month</span>
                    <span class="stat-value">{data.usage.thisMonth}</span>
                    <span class="stat-unit">of {data.usage.monthlyLimit}</span>
                  </div>

                  <div class="stat-card">
                    <span class="stat-label">PDFs Generated</span>
                    <span class="stat-value">{data.usage.pdfsGenerated}</span>
                    <span class="stat-unit">this month</span>
                  </div>
                </div>
              </section>

              {/* Rate Limit */}
              <section class="section">
                <div class="section-header">
                  <h2>Rate Limit</h2>
                  <span class="rate-text">
                    {data.rateLimit.current} / {data.rateLimit.limit} requests
                  </span>
                </div>

                <div class="rate-bar-container">
                  <div
                    class="rate-bar"
                    style={{
                      width: `${Math.min(data.rateLimit.percentage, 100)}%`,
                      background: getUsageColor(data.rateLimit.percentage),
                    }}
                  />
                </div>

                <p class="rate-reset">
                  Resets on {formatDate(data.usage.resetDate)}
                </p>
              </section>

              {/* Error display */}
              {error && (
                <div class="error-banner">
                  {Icons.warning}
                  <span>{error}</span>
                </div>
              )}

              {/* Sign Out */}
              <button
                class="btn btn-ghost sign-out"
                onClick={() => {
                  setData(null)
                  setApiKey('')
                  setNewKey(null)
                  localStorage.removeItem('glyph_api_key')
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Regenerate Confirmation Modal */}
      {showConfirm && (
        <div class="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Regenerate API Key?</h3>
            <p>
              This will invalidate your current key immediately. Any applications
              using it will stop working until updated with the new key.
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button
                class="btn btn-danger"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? 'Regenerating...' : 'Regenerate Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer class="footer">
        <span>Glyph v0.2.0</span>
        <span class="footer-sep">|</span>
        <a href="https://docs.glyph.you">Documentation</a>
        <span class="footer-sep">|</span>
        <a href="https://glyph.you">glyph.you</a>
      </footer>
    </div>
  )
}
