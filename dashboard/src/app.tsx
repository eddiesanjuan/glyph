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

// Config
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

// Tier badge colors
const tierColors: Record<string, string> = {
  free: '#71717a',
  pro: '#7C3AED',
  scale: '#2563eb',
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
    return 'var(--glyph-purple)'
  }

  const maskedKey = apiKey ? `${apiKey.slice(0, 11)}${'*'.repeat(16)}` : ''

  return (
    <div class="dashboard">
      {/* Header */}
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#7C3AED"/>
              <path d="M10 12H22M10 16H18M10 20H22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span class="logo-text">Glyph</span>
          </div>
          <a href="https://docs.glyph.dev" target="_blank" class="docs-link">
            {Icons.docs}
            <span>Docs</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main class="main">
        <div class="container">
          {/* API Key Input */}
          {!data && (
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
              </form>

              {error && (
                <div class="error-banner">
                  {Icons.warning}
                  <span>{error}</span>
                </div>
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
        <span>Glyph v0.1.0</span>
        <span class="footer-sep">|</span>
        <a href="https://docs.glyph.dev">Documentation</a>
        <span class="footer-sep">|</span>
        <a href="https://glyph.dev">glyph.dev</a>
      </footer>
    </div>
  )
}
