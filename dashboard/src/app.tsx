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

interface BetaRequest {
  id: string
  email: string
  name: string | null
  company: string | null
  useCase: string | null
  status: string
  createdAt: string
  reviewedAt: string | null
}

interface BetaInvite {
  id: string
  code: string
  email: string
  name: string | null
  company: string | null
  useCase: string | null
  createdAt: string
  activatedAt: string | null
  revoked: boolean
}

interface BetaStats {
  pending: number
  approved: number
  rejected: number
  activated: number
  totalRequests: number
}

// Config - Use public URL for production, localhost for development
const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://api.glyph.you'

// Page type for routing
type Page = 'login' | 'signup' | 'request-access' | 'activate' | 'dashboard' | 'admin'

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
  sparkles: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  checkCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  mail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  arrowLeft: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
}

// Tier badge colors - matching landing page navy blue palette
const tierColors: Record<string, string> = {
  free: '#64748B',
  beta: '#14B8A6',
  pro: '#2563EB',
  scale: '#1E3A5F',
  enterprise: '#059669',
}

export function App() {
  // Navigation
  const [page, setPage] = useState<Page>('login')

  // Auth state
  const [apiKey, setApiKey] = useState('')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  // Beta request state
  const [requestEmail, setRequestEmail] = useState('')
  const [requestName, setRequestName] = useState('')
  const [requestCompany, setRequestCompany] = useState('')
  const [requestUseCase, setRequestUseCase] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [requestPosition, setRequestPosition] = useState<number | null>(null)

  // Activation state
  const [activateCode, setActivateCode] = useState('')
  const [activating, setActivating] = useState(false)
  const [activatedKey, setActivatedKey] = useState<string | null>(null)
  const [activationSuccess, setActivationSuccess] = useState(false)

  // Admin state
  const [adminToken, setAdminToken] = useState('')
  const [adminAuthed, setAdminAuthed] = useState(false)
  const [betaRequests, setBetaRequests] = useState<BetaRequest[]>([])
  const [betaInvites, setBetaInvites] = useState<BetaInvite[]>([])
  const [betaStats, setBetaStats] = useState<BetaStats | null>(null)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminView, setAdminView] = useState<'requests' | 'invites'>('requests')
  const [approvedCode, setApprovedCode] = useState<string | null>(null)

  // Check for activation code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      setActivateCode(code)
      setPage('activate')
    }
  }, [])

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
      setPage('dashboard')
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

  const handleCopy = async (keyToCopy?: string) => {
    const key = keyToCopy || newKey || activatedKey || apiKey
    await navigator.clipboard.writeText(key)
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

  // Handle beta access request
  const handleRequestAccess = async (e: Event) => {
    e.preventDefault()
    if (!requestEmail.trim() || !requestEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setRequestSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/beta/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: requestEmail,
          name: requestName || undefined,
          company: requestCompany || undefined,
          useCase: requestUseCase || undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit request')
      }

      setRequestSuccess(true)
      setRequestPosition(result.position || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setRequestSubmitting(false)
    }
  }

  // Handle invite code activation
  const handleActivate = async (e: Event) => {
    e.preventDefault()
    if (!activateCode.trim()) {
      setError('Please enter your invite code')
      return
    }

    setActivating(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/beta/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: activateCode,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to activate code')
      }

      setActivatedKey(result.apiKey)
      setActivationSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate code')
    } finally {
      setActivating(false)
    }
  }

  // Admin functions
  const fetchAdminData = async () => {
    setAdminLoading(true)
    setError(null)

    try {
      const [requestsRes, invitesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/v1/beta/requests`, {
          headers: { 'X-Admin-Token': adminToken },
        }),
        fetch(`${API_URL}/v1/beta/invites`, {
          headers: { 'X-Admin-Token': adminToken },
        }),
        fetch(`${API_URL}/v1/beta/stats`, {
          headers: { 'X-Admin-Token': adminToken },
        }),
      ])

      if (!requestsRes.ok || !invitesRes.ok || !statsRes.ok) {
        throw new Error('Admin access denied')
      }

      const [requestsData, invitesData, statsData] = await Promise.all([
        requestsRes.json(),
        invitesRes.json(),
        statsRes.json(),
      ])

      setBetaRequests(requestsData.requests)
      setBetaInvites(invitesData.invites)
      setBetaStats(statsData)
      setAdminAuthed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin access denied')
      setAdminAuthed(false)
    } finally {
      setAdminLoading(false)
    }
  }

  const handleAdminLogin = (e: Event) => {
    e.preventDefault()
    fetchAdminData()
  }

  const handleApprove = async (requestId: string) => {
    setAdminLoading(true)
    setError(null)
    setApprovedCode(null)

    try {
      const res = await fetch(`${API_URL}/v1/beta/approve/${requestId}`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminToken },
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to approve')
      }

      setApprovedCode(result.inviteCode)
      // Refresh data
      fetchAdminData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request')
    } finally {
      setAdminLoading(false)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this request?')) return

    setAdminLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/beta/reject/${requestId}`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminToken },
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to reject')
      }

      // Refresh data
      fetchAdminData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request')
    } finally {
      setAdminLoading(false)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invite? The user will lose access.')) return

    setAdminLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/beta/revoke/${inviteId}`, {
        method: 'POST',
        headers: { 'X-Admin-Token': adminToken },
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to revoke')
      }

      // Refresh data
      fetchAdminData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    } finally {
      setAdminLoading(false)
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

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--error)'
    if (percentage >= 75) return 'var(--warning)'
    return 'var(--glyph-primary-bright)'
  }

  const maskedKey = apiKey ? `${apiKey.slice(0, 11)}${'*'.repeat(16)}` : ''

  const handleSignOut = () => {
    setData(null)
    setApiKey('')
    setNewKey(null)
    setPage('login')
    localStorage.removeItem('glyph_api_key')
  }

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
            {page === 'dashboard' && data && (
              <button class="nav-link" onClick={handleSignOut}>Sign Out</button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main class="main">
        <div class="container">

          {/* ==================== LOGIN PAGE ==================== */}
          {page === 'login' && !data && (
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

              <div class="auth-options">
                <button
                  class="btn btn-beta"
                  onClick={() => { setPage('request-access'); setError(null); }}
                >
                  {Icons.sparkles}
                  <span>Request Early Access</span>
                </button>

                <button
                  class="btn btn-secondary"
                  onClick={() => { setPage('activate'); setError(null); }}
                >
                  {Icons.key}
                  <span>Activate Invite Code</span>
                </button>
              </div>

              <p class="admin-link">
                <button class="btn-link" onClick={() => { setPage('admin'); setError(null); }}>
                  Admin Panel
                </button>
              </p>
            </div>
          )}

          {/* ==================== REQUEST ACCESS PAGE ==================== */}
          {page === 'request-access' && (
            <div class="auth-card animate-in">
              {!requestSuccess ? (
                <>
                  <div class="beta-badge">
                    {Icons.sparkles}
                    <span>Closed Beta</span>
                  </div>

                  <h1>Request Early Access</h1>
                  <p class="subtitle">
                    We're letting in developers who will push Glyph to its limits.
                    Tell us about yourself.
                  </p>

                  <form onSubmit={handleRequestAccess} class="auth-form">
                    <div class="input-group">
                      <input
                        type="email"
                        value={requestEmail}
                        onInput={(e) => setRequestEmail((e.target as HTMLInputElement).value)}
                        placeholder="you@example.com *"
                        class="api-input"
                        autoComplete="email"
                        autoFocus
                        required
                      />
                    </div>

                    <div class="input-group">
                      <input
                        type="text"
                        value={requestName}
                        onInput={(e) => setRequestName((e.target as HTMLInputElement).value)}
                        placeholder="Your name"
                        class="api-input"
                        autoComplete="name"
                      />
                    </div>

                    <div class="input-group">
                      <input
                        type="text"
                        value={requestCompany}
                        onInput={(e) => setRequestCompany((e.target as HTMLInputElement).value)}
                        placeholder="Company / Project"
                        class="api-input"
                        autoComplete="organization"
                      />
                    </div>

                    <div class="input-group">
                      <textarea
                        value={requestUseCase}
                        onInput={(e) => setRequestUseCase((e.target as HTMLTextAreaElement).value)}
                        placeholder="What will you build with Glyph? (optional)"
                        class="api-input textarea"
                        rows={3}
                      />
                    </div>

                    <button type="submit" class="btn btn-primary" disabled={requestSubmitting || !requestEmail.trim()}>
                      {requestSubmitting ? 'Submitting...' : 'Request Access'}
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
                    onClick={() => { setPage('login'); setError(null); }}
                  >
                    {Icons.arrowLeft}
                    Back to sign in
                  </button>
                </>
              ) : (
                <>
                  <div class="success-icon success-icon--large">
                    {Icons.checkCircle}
                  </div>

                  <h1>You're on the list.</h1>
                  <p class="subtitle success-message">
                    We're letting in developers who will push Glyph to its limits.
                    We'll reach out when it's your turn.
                  </p>

                  {requestPosition && (
                    <div class="position-badge">
                      <span class="position-number">#{requestPosition}</span>
                      <span class="position-label">in queue</span>
                    </div>
                  )}

                  <div class="waitlist-features">
                    <div class="feature-item">
                      {Icons.mail}
                      <span>Check your email for updates</span>
                    </div>
                    <div class="feature-item">
                      {Icons.sparkles}
                      <span>Detailed use cases get priority</span>
                    </div>
                  </div>

                  <button
                    class="btn btn-ghost back-link"
                    onClick={() => { setPage('login'); setRequestSuccess(false); setError(null); }}
                  >
                    {Icons.arrowLeft}
                    Back to sign in
                  </button>
                </>
              )}
            </div>
          )}

          {/* ==================== ACTIVATE CODE PAGE ==================== */}
          {page === 'activate' && (
            <div class="auth-card animate-in">
              {!activationSuccess ? (
                <>
                  <div class="invite-icon">
                    {Icons.key}
                  </div>

                  <h1>Activate Your Access</h1>
                  <p class="subtitle">
                    Enter your invite code to unlock Glyph.
                  </p>

                  <form onSubmit={handleActivate} class="auth-form">
                    <div class="input-group">
                      <input
                        type="text"
                        value={activateCode}
                        onInput={(e) => setActivateCode((e.target as HTMLInputElement).value.toUpperCase())}
                        placeholder="GLYPH-XXXX-XXXX"
                        class="api-input mono code-input"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>

                    <button type="submit" class="btn btn-primary" disabled={activating || !activateCode.trim()}>
                      {activating ? 'Activating...' : 'Activate Code'}
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
                    onClick={() => { setPage('login'); setError(null); setActivateCode(''); }}
                  >
                    {Icons.arrowLeft}
                    Back to sign in
                  </button>
                </>
              ) : (
                <>
                  <div class="success-icon success-icon--large success-icon--glow">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>

                  <h1>You're in.</h1>
                  <p class="subtitle success-message">
                    Let's build something incredible.
                  </p>

                  <div class="generated-key-display">
                    <div class="key-label">Your API Key</div>
                    <code class="mono">{activatedKey}</code>
                    <button class="btn btn-icon" onClick={() => handleCopy(activatedKey || '')}>
                      {copied ? Icons.check : Icons.copy}
                    </button>
                  </div>

                  <div class="key-warning">
                    {Icons.warning}
                    <span>Copy this key now. It won't be shown again.</span>
                  </div>

                  <div class="activation-actions">
                    <button class="btn btn-primary" onClick={() => handleCopy(activatedKey || '')}>
                      {copied ? 'Copied!' : 'Copy API Key'}
                    </button>
                  </div>

                  <div class="beta-features">
                    <div class="feature-item">
                      {Icons.check}
                      <span>500 PDFs per month</span>
                    </div>
                    <div class="feature-item">
                      {Icons.check}
                      <span>All AI features unlocked</span>
                    </div>
                    <div class="feature-item">
                      {Icons.check}
                      <span>Priority support</span>
                    </div>
                  </div>

                  <button
                    class="btn btn-secondary"
                    onClick={() => {
                      if (activatedKey) {
                        setApiKey(activatedKey)
                        localStorage.setItem('glyph_api_key', activatedKey)
                        fetchDashboard(activatedKey)
                      }
                    }}
                  >
                    Go to Dashboard
                  </button>
                </>
              )}
            </div>
          )}

          {/* ==================== ADMIN PANEL ==================== */}
          {page === 'admin' && (
            <div class="admin-panel animate-in">
              {!adminAuthed ? (
                <div class="auth-card">
                  <div class="admin-icon">
                    {Icons.shield}
                  </div>

                  <h1>Admin Panel</h1>
                  <p class="subtitle">Enter admin token to manage beta invites.</p>

                  <form onSubmit={handleAdminLogin} class="auth-form">
                    <div class="input-group">
                      <input
                        type="password"
                        value={adminToken}
                        onInput={(e) => setAdminToken((e.target as HTMLInputElement).value)}
                        placeholder="Admin token"
                        class="api-input"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>

                    <button type="submit" class="btn btn-primary" disabled={adminLoading || !adminToken.trim()}>
                      {adminLoading ? 'Authenticating...' : 'Access Admin'}
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
                    onClick={() => { setPage('login'); setError(null); setAdminToken(''); }}
                  >
                    {Icons.arrowLeft}
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <div class="admin-header">
                    <h1>Beta Admin</h1>
                    <button class="btn btn-ghost" onClick={() => { setAdminAuthed(false); setAdminToken(''); }}>
                      Sign Out
                    </button>
                  </div>

                  {/* Stats */}
                  {betaStats && (
                    <div class="admin-stats">
                      <div class="stat-card stat-card--pending">
                        <span class="stat-value">{betaStats.pending}</span>
                        <span class="stat-label">Pending</span>
                      </div>
                      <div class="stat-card stat-card--approved">
                        <span class="stat-value">{betaStats.approved}</span>
                        <span class="stat-label">Approved</span>
                      </div>
                      <div class="stat-card stat-card--activated">
                        <span class="stat-value">{betaStats.activated}</span>
                        <span class="stat-label">Activated</span>
                      </div>
                      <div class="stat-card">
                        <span class="stat-value">{betaStats.totalRequests}</span>
                        <span class="stat-label">Total</span>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div class="admin-tabs">
                    <button
                      class={`tab ${adminView === 'requests' ? 'active' : ''}`}
                      onClick={() => setAdminView('requests')}
                    >
                      {Icons.users}
                      Requests ({betaRequests.length})
                    </button>
                    <button
                      class={`tab ${adminView === 'invites' ? 'active' : ''}`}
                      onClick={() => setAdminView('invites')}
                    >
                      {Icons.key}
                      Invites ({betaInvites.length})
                    </button>
                  </div>

                  {/* Approved Code Modal */}
                  {approvedCode && (
                    <div class="approved-code-banner">
                      <div class="approved-header">
                        {Icons.checkCircle}
                        <strong>Invite Code Generated</strong>
                      </div>
                      <div class="approved-code">
                        <code class="mono">{approvedCode}</code>
                        <button class="btn btn-icon" onClick={() => handleCopy(approvedCode)}>
                          {copied ? Icons.check : Icons.copy}
                        </button>
                      </div>
                      <button class="btn btn-ghost" onClick={() => setApprovedCode(null)}>
                        Dismiss
                      </button>
                    </div>
                  )}

                  {error && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Requests List */}
                  {adminView === 'requests' && (
                    <div class="admin-list">
                      {betaRequests.length === 0 ? (
                        <div class="empty-state">
                          <p>No pending requests</p>
                        </div>
                      ) : (
                        betaRequests.map(req => (
                          <div key={req.id} class="request-card">
                            <div class="request-header">
                              <div class="request-email">{req.email}</div>
                              <div class="request-date">{formatDateTime(req.createdAt)}</div>
                            </div>
                            {req.name && <div class="request-meta"><strong>Name:</strong> {req.name}</div>}
                            {req.company && <div class="request-meta"><strong>Company:</strong> {req.company}</div>}
                            {req.useCase && <div class="request-usecase">{req.useCase}</div>}
                            <div class="request-actions">
                              <button
                                class="btn btn-approve"
                                onClick={() => handleApprove(req.id)}
                                disabled={adminLoading}
                              >
                                {Icons.check}
                                Approve
                              </button>
                              <button
                                class="btn btn-reject"
                                onClick={() => handleReject(req.id)}
                                disabled={adminLoading}
                              >
                                {Icons.x}
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Invites List */}
                  {adminView === 'invites' && (
                    <div class="admin-list">
                      {betaInvites.length === 0 ? (
                        <div class="empty-state">
                          <p>No invites yet</p>
                        </div>
                      ) : (
                        betaInvites.map(inv => (
                          <div key={inv.id} class={`invite-card ${inv.revoked ? 'revoked' : ''}`}>
                            <div class="invite-header">
                              <div class="invite-code mono">{inv.code}</div>
                              <div class={`invite-status ${inv.activatedAt ? 'activated' : inv.revoked ? 'revoked' : 'pending'}`}>
                                {inv.activatedAt ? 'Activated' : inv.revoked ? 'Revoked' : 'Pending'}
                              </div>
                            </div>
                            <div class="invite-email">{inv.email}</div>
                            {inv.name && <div class="invite-meta">{inv.name} {inv.company ? `at ${inv.company}` : ''}</div>}
                            <div class="invite-dates">
                              <span>Created: {formatDateTime(inv.createdAt)}</span>
                              {inv.activatedAt && <span>Activated: {formatDateTime(inv.activatedAt)}</span>}
                            </div>
                            {!inv.revoked && !inv.activatedAt && (
                              <div class="invite-actions">
                                <button class="btn btn-icon" onClick={() => handleCopy(inv.code)}>
                                  {Icons.copy}
                                </button>
                              </div>
                            )}
                            {!inv.revoked && inv.activatedAt && (
                              <div class="invite-actions">
                                <button
                                  class="btn btn-revoke"
                                  onClick={() => handleRevoke(inv.id)}
                                  disabled={adminLoading}
                                >
                                  Revoke Access
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <button
                    class="btn btn-ghost back-link"
                    onClick={() => { setPage('login'); setAdminAuthed(false); setAdminToken(''); setError(null); }}
                  >
                    {Icons.arrowLeft}
                    Back to sign in
                  </button>
                </>
              )}
            </div>
          )}

          {/* ==================== DASHBOARD PAGE ==================== */}
          {page === 'dashboard' && data && (
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
                    <button class="btn btn-icon" onClick={() => handleCopy()}>
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
                        onClick={() => handleCopy()}
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
              <button class="btn btn-ghost sign-out" onClick={handleSignOut}>
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
        <span>Glyph v0.3.0</span>
        <span class="footer-sep">|</span>
        <a href="https://docs.glyph.you">Documentation</a>
        <span class="footer-sep">|</span>
        <a href="https://glyph.you">glyph.you</a>
      </footer>
    </div>
  )
}
