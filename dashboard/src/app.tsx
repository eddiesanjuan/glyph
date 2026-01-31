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

interface SavedTemplate {
  id: string
  name: string
  type: string | null
  description: string | null
  style: string | null
  isDefault: boolean
  version: number
  createdAt: string
  updatedAt: string
}

interface BuiltInTemplate {
  id: string
  name: string
  description: string
  category: string
  style?: string
  tags?: string[]
}

interface DataSource {
  id: string
  name: string
  description: string | null
  source_type: 'airtable' | 'rest_api' | 'webhook' | 'graphql' | 'database' | 'file' | 'manual'
  status: 'active' | 'pending' | 'failed' | 'disabled'
  status_message: string | null
  discovered_schema: {
    fields?: Array<{
      name: string
      path: string
      type: string
      sample?: string
    }>
    record_count?: number
  } | null
  last_sync_at: string | null
  last_sync_record_count: number | null
  created_at: string
  updated_at: string
}

interface Mapping {
  id: string
  template_id: string
  source_id: string
  field_mappings: Record<string, string>  // template field -> source field
  transformations: Record<string, { type: string; config?: any }>
  is_default: boolean
  validation_status: 'valid' | 'stale' | 'broken' | 'pending'
  validation_message: string | null
  created_at: string
  updated_at: string
}

interface MappingSuggestion {
  templateField: string
  sourceField: string
  confidence: number
  reason: string
}

interface BatchJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    total: number
    completed: number
    failed: number
  }
  error?: string
  created_at: string
  completed_at?: string
}

interface GeneratedPdf {
  success: boolean
  url: string
  size: number
  recordId?: string
  generatedAt: string
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
type Page = 'login' | 'signup' | 'request-access' | 'activate' | 'dashboard' | 'playground' | 'my-templates' | 'admin'

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
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  ),
  star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  starOutline: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  airtable: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.992 0L2 5.61v12.78l9.992 5.61 9.992-5.61V5.61L11.992 0z"/>
    </svg>
  ),
  api: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  webhook: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/>
      <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/>
      <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12"/>
    </svg>
  ),
  zap: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  database: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  chevronUp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15"/>
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

  // Key recovery state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [recoveredKey, setRecoveredKey] = useState<string | null>(null)
  const [recoverySuccess, setRecoverySuccess] = useState(false)

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

  // Template state
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SavedTemplate | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [builtInTemplates, setBuiltInTemplates] = useState<BuiltInTemplate[]>([])

  // Data Sources state
  const [sources, setSources] = useState<DataSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [addSourceStep, setAddSourceStep] = useState(1)
  const [addSourceType, setAddSourceType] = useState<string | null>(null)
  const [addSourceConfig, setAddSourceConfig] = useState<Record<string, string>>({})
  const [addSourceTesting, setAddSourceTesting] = useState(false)
  const [addSourceError, setAddSourceError] = useState<string | null>(null)
  const [addSourceSchema, setAddSourceSchema] = useState<DataSource['discovered_schema']>(null)
  const [deleteSourceConfirm, setDeleteSourceConfirm] = useState<string | null>(null)
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null)
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null)

  // Mapping state
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [linkingTemplate, setLinkingTemplate] = useState<SavedTemplate | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [showMapper, setShowMapper] = useState(false)
  const [currentMapping, setCurrentMapping] = useState<{
    templateId: string
    sourceId: string
    fieldMappings: Record<string, string>
    transformations: Record<string, { type: string }>
  }>({ templateId: '', sourceId: '', fieldMappings: {}, transformations: {} })
  const [templateFields, setTemplateFields] = useState<string[]>([])
  const [sourceFields, setSourceFields] = useState<Array<{ name: string; path: string; type: string }>>([])
  const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([])
  const [suggestingMappings, setSuggestingMappings] = useState(false)
  const [savingMapping, setSavingMapping] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)

  // Generation state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateTemplate, setGenerateTemplate] = useState<SavedTemplate | null>(null)
  const [generateMapping, setGenerateMapping] = useState<Mapping | null>(null)
  const [generateMode, setGenerateMode] = useState<'single' | 'batch'>('single')
  const [records, setRecords] = useState<any[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [batchLimit, setBatchLimit] = useState(100)
  const [generating, setGenerating] = useState(false)
  const [generatedPdf, setGeneratedPdf] = useState<GeneratedPdf | null>(null)
  const [batchJob, setBatchJob] = useState<BatchJob | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Magic preview state (shown after source connection)
  const [showMagicPreview, setShowMagicPreview] = useState(false)
  const [magicPreviewData, setMagicPreviewData] = useState<{
    html: string
    templateUsed: { id: string; name: string; confidence: number; reasoning: string; isBuiltIn?: boolean }
    mappings: {
      applied: Record<string, string>
      unmapped: string[]
      coverage: number
      suggestions?: Array<{ templateField: string; possibleSourceFields: string[] }>
    }
    sourceId: string
    sessionId?: string
    needsConfirmation?: boolean
    suggestions?: Array<{ id: string; name: string; confidence: number; reasoning: string }>
  } | null>(null)
  const [magicPreviewLoading, setMagicPreviewLoading] = useState(false)
  const [magicPreviewError, setMagicPreviewError] = useState<string | null>(null)
  const [magicMappingOverrides, setMagicMappingOverrides] = useState<Record<string, string>>({})
  const [magicExpandedField, setMagicExpandedField] = useState<string | null>(null)
  const [magicAccepting, setMagicAccepting] = useState(false)
  const [magicSwitchingTemplate, setMagicSwitchingTemplate] = useState(false)
  const [showMagicTemplatePicker, setShowMagicTemplatePicker] = useState(false)

  // Playground state
  const [playgroundTemplate, setPlaygroundTemplate] = useState('quote-modern')
  const [playgroundHtml, setPlaygroundHtml] = useState('')
  const [playgroundSessionId, setPlaygroundSessionId] = useState<string | null>(null)
  const [playgroundLoading, setPlaygroundLoading] = useState(false)
  const [playgroundError, setPlaygroundError] = useState<string | null>(null)
  const [playgroundPrompt, setPlaygroundPrompt] = useState('')
  const [playgroundModifying, setPlaygroundModifying] = useState(false)
  const [playgroundUndoStack, setPlaygroundUndoStack] = useState<string[]>([])
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveTemplateType, setSaveTemplateType] = useState('')
  const [saveTemplateDescription, setSaveTemplateDescription] = useState('')
  const [savingPlaygroundTemplate, setSavingPlaygroundTemplate] = useState(false)

  // Source-first playground state
  const [playgroundSourceId, setPlaygroundSourceId] = useState<string | null>(null)
  const [playgroundMappingId, setPlaygroundMappingId] = useState<string | null>(null)
  const [playgroundSavedTemplateId, setPlaygroundSavedTemplateId] = useState<string | null>(null)
  const [playgroundRecords, setPlaygroundRecords] = useState<any[]>([])
  const [playgroundRecordIndex, setPlaygroundRecordIndex] = useState(0)
  const [playgroundRecordId, setPlaygroundRecordId] = useState<string | null>(null)
  const [playgroundSourceLoading, setPlaygroundSourceLoading] = useState(false)
  const [playgroundTemplateHtml, setPlaygroundTemplateHtml] = useState<string>('')

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

  // Handle key recovery by email
  const handleRecoverKey = async (e: Event) => {
    e.preventDefault()
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setRecovering(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/v1/auth/recover-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: recoveryEmail.trim().toLowerCase(),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.message || result.error || 'Failed to recover key')
      }

      setRecoveredKey(result.newApiKey)
      setRecoverySuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recover key')
    } finally {
      setRecovering(false)
    }
  }

  // Handle using recovered key
  const handleUseRecoveredKey = () => {
    if (recoveredKey) {
      setApiKey(recoveredKey)
      localStorage.setItem('glyph_api_key', recoveredKey)
      setShowRecoveryModal(false)
      setRecoverySuccess(false)
      setRecoveryEmail('')
      setRecoveredKey(null)
      fetchDashboard(recoveredKey)
    }
  }

  // Close recovery modal and reset state
  const closeRecoveryModal = () => {
    setShowRecoveryModal(false)
    setRecoverySuccess(false)
    setRecoveryEmail('')
    setRecoveredKey(null)
    setError(null)
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

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Template functions
  const fetchBuiltInTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/templates`)
      const data = await res.json()
      if (data.templates) {
        setBuiltInTemplates(data.templates)
      }
    } catch (err) {
      console.error('Failed to fetch built-in templates:', err)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    if (!apiKey) return
    setTemplatesLoading(true)
    try {
      const res = await fetch(`${API_URL}/v1/templates/saved`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates)
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setTemplatesLoading(false)
    }
  }, [apiKey])

  const handleUpdateTemplate = async (id: string, updates: Partial<SavedTemplate>) => {
    setTemplateSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/v1/templates/saved/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(updates)
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update template')
      }
      await fetchTemplates()
      setEditingTemplate(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template')
    } finally {
      setTemplateSaving(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/templates/saved/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      if (res.ok) {
        await fetchTemplates()
        setShowDeleteConfirm(null)
      }
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  const copyTemplateId = async (id: string) => {
    await navigator.clipboard.writeText(id)
    setCopiedTemplateId(id)
    setTimeout(() => setCopiedTemplateId(null), 2000)
  }

  // Source functions
  const fetchSources = useCallback(async () => {
    if (!apiKey) return
    setSourcesLoading(true)
    try {
      const res = await fetch(`${API_URL}/v1/sources`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const data = await res.json()
      if (data.success) {
        setSources(data.sources || [])
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err)
    } finally {
      setSourcesLoading(false)
    }
  }, [apiKey])

  const handleTestSource = async (sourceId: string) => {
    setTestingSourceId(sourceId)
    try {
      const res = await fetch(`${API_URL}/v1/sources/${sourceId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const data = await res.json()
      if (data.success) {
        setSources(prev => prev.map(s =>
          s.id === sourceId ? { ...s, status: 'active' as const } : s
        ))
      } else {
        setSources(prev => prev.map(s =>
          s.id === sourceId ? { ...s, status: 'failed' as const, status_message: data.error } : s
        ))
      }
    } catch (err) {
      console.error('Test failed:', err)
    } finally {
      setTestingSourceId(null)
    }
  }

  const handleSyncSource = async (sourceId: string) => {
    setSyncingSourceId(sourceId)
    try {
      const res = await fetch(`${API_URL}/v1/sources/${sourceId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchSources()
      }
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncingSourceId(null)
    }
  }

  const handleCreateSource = async () => {
    setAddSourceTesting(true)
    setAddSourceError(null)

    try {
      const testRes = await fetch(`${API_URL}/v1/sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          name: addSourceConfig.name,
          source_type: addSourceType,
          config: addSourceConfig
        })
      })

      const testData = await testRes.json()

      if (!testRes.ok) {
        throw new Error(testData.error || 'Failed to create source')
      }

      // Capture created source ID for magic preview
      const createdSourceId = testData.source?.id

      setAddSourceSchema(testData.source?.discovered_schema || null)
      setAddSourceStep(3)

      await fetchSources()

      // Close the wizard and trigger magic preview
      setTimeout(() => {
        resetAddSourceWizard()
        // Trigger magic preview with the new source
        if (createdSourceId) {
          fetchMagicPreview(createdSourceId)
        }
      }, 1500) // Slightly shorter delay before showing magic preview

    } catch (err) {
      setAddSourceError(err instanceof Error ? err.message : 'Failed to create source')
    } finally {
      setAddSourceTesting(false)
    }
  }

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const res = await fetch(`${API_URL}/v1/sources/${sourceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      if (res.ok) {
        await fetchSources()
        setDeleteSourceConfirm(null)
      }
    } catch (err) {
      console.error('Failed to delete source:', err)
    }
  }

  const resetAddSourceWizard = () => {
    setShowAddSource(false)
    setAddSourceStep(1)
    setAddSourceType(null)
    setAddSourceConfig({})
    setAddSourceError(null)
    setAddSourceSchema(null)
  }

  // Call auto-generate API to get magic preview after source connection
  const fetchMagicPreview = async (sourceId: string, templateIdOverride?: string, mappingOverrides?: Record<string, string>) => {
    setMagicPreviewLoading(true)
    setMagicPreviewError(null)
    if (!templateIdOverride && !mappingOverrides) {
      setMagicPreviewData(null)
      setMagicMappingOverrides({})
      setMagicExpandedField(null)
    }
    setShowMagicPreview(true)

    try {
      const body: Record<string, unknown> = {
        sourceId,
        format: 'preview',
        confidenceThreshold: 0.5,
        autoAcceptAboveThreshold: true
      }
      if (templateIdOverride) {
        body.templateId = templateIdOverride
      }
      if (mappingOverrides && Object.keys(mappingOverrides).length > 0) {
        body.mappingOverrides = mappingOverrides
      }

      const response = await fetch(`${API_URL}/v1/auto-generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        setMagicPreviewData({
          html: data.preview?.html || '',
          templateUsed: data.templateUsed || { id: '', name: 'Unknown', confidence: 0, reasoning: '' },
          mappings: data.mappings || { applied: {}, unmapped: [], coverage: 0 },
          sourceId,
          sessionId: data.sessionId
        })
        // Keep accumulated overrides
        if (mappingOverrides) {
          setMagicMappingOverrides(mappingOverrides)
        }
      } else if (data.code === 'LOW_CONFIDENCE') {
        // Still show preview but with warning
        setMagicPreviewData({
          html: data.preview?.html || '', // May have partial preview
          templateUsed: data.suggestedTemplates?.[0] || { id: '', name: 'Unknown', confidence: 0, reasoning: '' },
          mappings: data.mappings || { applied: {}, unmapped: [], coverage: 0 },
          sourceId,
          sessionId: data.sessionId,
          needsConfirmation: true,
          suggestions: data.suggestedTemplates
        })
      } else {
        setMagicPreviewError(data.error || 'Failed to generate preview')
      }
    } catch (err) {
      setMagicPreviewError('Failed to connect to API')
    } finally {
      setMagicPreviewLoading(false)
      setMagicSwitchingTemplate(false)
    }
  }

  // Switch template in magic preview
  const handleMagicTemplateSwitch = async (templateId: string) => {
    if (!magicPreviewData) return
    setMagicSwitchingTemplate(true)
    setShowMagicTemplatePicker(false)
    await fetchMagicPreview(magicPreviewData.sourceId, templateId, magicMappingOverrides)
  }

  // Fix a mapping in magic preview
  const handleMagicMappingFix = async (templateField: string, sourceField: string) => {
    if (!magicPreviewData) return
    const newOverrides = { ...magicMappingOverrides, [templateField]: sourceField }
    setMagicMappingOverrides(newOverrides)
    setMagicExpandedField(null)
    await fetchMagicPreview(magicPreviewData.sourceId, magicPreviewData.templateUsed.id, newOverrides)
  }

  // Accept the magic preview and save template/mapping
  const handleMagicAccept = async (setAsDefault: boolean = true) => {
    if (!magicPreviewData?.sessionId) {
      setMagicPreviewError('No session available. Please try again.')
      return
    }

    setMagicAccepting(true)

    try {
      const response = await fetch(`${API_URL}/v1/auto-generate/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: magicPreviewData.sessionId,
          setAsDefault,
          mappingOverrides: Object.keys(magicMappingOverrides).length > 0 ? magicMappingOverrides : undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        // Success! Show toast and close modal
        resetMagicPreview()
        setPage('my-templates')
        // Refresh templates and mappings
        fetchTemplates()
        fetchMappings()
        // Show success feedback (could add a toast here)
        alert(`Template "${data.savedTemplate.name}" saved successfully!${data.defaultSet ? ' Set as default for this source.' : ''}`)
      } else if (data.code === 'DEMO_TIER_LIMITATION') {
        // Demo tier - show helpful upgrade message
        setMagicPreviewError(
          'Template saving requires a registered API key. You can still generate a one-time PDF by clicking "Edit in Playground".'
        )
      } else {
        setMagicPreviewError(data.error || 'Failed to save template')
      }
    } catch (err) {
      setMagicPreviewError('Failed to connect to API')
    } finally {
      setMagicAccepting(false)
    }
  }

  // Open playground with the current magic preview session
  const handleMagicEditInPlayground = () => {
    if (magicPreviewData?.sessionId) {
      setPlaygroundSessionId(magicPreviewData.sessionId)
      setPlaygroundHtml(magicPreviewData.html)
      setPlaygroundSourceId(magicPreviewData.sourceId)
    }
    resetMagicPreview()
    setPage('playground')
  }

  const resetMagicPreview = () => {
    setShowMagicPreview(false)
    setMagicPreviewData(null)
    setMagicPreviewError(null)
    setMagicPreviewLoading(false)
    setMagicMappingOverrides({})
    setMagicExpandedField(null)
    setMagicAccepting(false)
    setMagicSwitchingTemplate(false)
    setShowMagicTemplatePicker(false)
  }

  // Mapping functions
  const fetchMappings = useCallback(async () => {
    if (!apiKey) return
    try {
      const res = await fetch(`${API_URL}/v1/mappings`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const data = await res.json()
      if (data.success) {
        setMappings(data.mappings || [])
      }
    } catch (err) {
      console.error('Failed to fetch mappings:', err)
    }
  }, [apiKey])

  const getTemplateMappings = (templateId: string) => {
    return mappings.filter(m => m.template_id === templateId)
  }

  const getSourceName = (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId)
    return source?.name || 'Unknown Source'
  }

  const openLinkSource = (template: SavedTemplate) => {
    setLinkingTemplate(template)
    setSelectedSourceId('')
  }

  const openFieldMapper = async (templateId: string, sourceId: string) => {
    setShowMapper(true)
    setMappingError(null)
    setCurrentMapping({ templateId, sourceId, fieldMappings: {}, transformations: {} })

    // Fetch template fields
    try {
      const templateRes = await fetch(`${API_URL}/v1/templates/saved/${templateId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const templateData = await templateRes.json()
      if (templateData.success && templateData.template?.required_fields) {
        setTemplateFields(templateData.template.required_fields)
      } else {
        // Fallback: extract from template HTML using regex for {{field}}
        setTemplateFields([])
      }
    } catch (err) {
      console.error('Failed to fetch template fields:', err)
      setTemplateFields([])
    }

    // Get source schema
    const source = sources.find(s => s.id === sourceId)
    if (source?.discovered_schema?.fields) {
      setSourceFields(source.discovered_schema.fields)
    } else {
      setSourceFields([])
    }

    // Check for existing mapping
    const existingMapping = mappings.find(m => m.template_id === templateId && m.source_id === sourceId)
    if (existingMapping) {
      setCurrentMapping({
        templateId,
        sourceId,
        fieldMappings: existingMapping.field_mappings,
        transformations: existingMapping.transformations as Record<string, { type: string }>
      })
    }

    setLinkingTemplate(null)
  }

  const handleSuggestMappings = async () => {
    setSuggestingMappings(true)
    setMappingError(null)

    try {
      const res = await fetch(`${API_URL}/v1/ai/suggest-mappings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          templateId: currentMapping.templateId,
          sourceId: currentMapping.sourceId
        })
      })

      const data = await res.json()

      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions)

        // Apply suggestions to current mapping
        const newFieldMappings: Record<string, string> = { ...currentMapping.fieldMappings }
        data.suggestions.forEach((s: MappingSuggestion) => {
          if (s.confidence > 0.7) {  // Auto-apply high confidence
            newFieldMappings[s.templateField] = s.sourceField
          }
        })
        setCurrentMapping(prev => ({ ...prev, fieldMappings: newFieldMappings }))
      }
    } catch (err) {
      setMappingError('Failed to get AI suggestions')
    } finally {
      setSuggestingMappings(false)
    }
  }

  const updateFieldMapping = (templateField: string, sourceField: string) => {
    setCurrentMapping(prev => ({
      ...prev,
      fieldMappings: {
        ...prev.fieldMappings,
        [templateField]: sourceField
      }
    }))
  }

  const updateTransform = (templateField: string, transformType: string) => {
    setCurrentMapping(prev => ({
      ...prev,
      transformations: {
        ...prev.transformations,
        [templateField]: { type: transformType }
      }
    }))
  }

  const handleSaveMapping = async () => {
    setSavingMapping(true)
    setMappingError(null)

    try {
      // Check if mapping exists
      const existingMapping = mappings.find(
        m => m.template_id === currentMapping.templateId && m.source_id === currentMapping.sourceId
      )

      const method = existingMapping ? 'PUT' : 'POST'
      const url = existingMapping
        ? `${API_URL}/v1/mappings/${existingMapping.id}`
        : `${API_URL}/v1/mappings`

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          template_id: currentMapping.templateId,
          source_id: currentMapping.sourceId,
          field_mappings: currentMapping.fieldMappings,
          transformations: currentMapping.transformations
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save mapping')
      }

      await fetchMappings()
      setShowMapper(false)
      resetMapper()
    } catch (err) {
      setMappingError(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setSavingMapping(false)
    }
  }

  const resetMapper = () => {
    setShowMapper(false)
    setCurrentMapping({ templateId: '', sourceId: '', fieldMappings: {}, transformations: {} })
    setTemplateFields([])
    setSourceFields([])
    setSuggestions([])
    setMappingError(null)
  }

  const getMappingCoverage = () => {
    if (templateFields.length === 0) return 0
    const mappedCount = templateFields.filter(f => currentMapping.fieldMappings[f]).length
    return Math.round((mappedCount / templateFields.length) * 100)
  }

  // Generation functions
  const openGenerateModal = async (template: SavedTemplate, mapping: Mapping) => {
    setGenerateTemplate(template)
    setGenerateMapping(mapping)
    setShowGenerateModal(true)
    setGenerateMode('single')
    setSelectedRecordId('')
    setGeneratedPdf(null)
    setBatchJob(null)
    setGenerateError(null)

    // Fetch records from source
    await fetchRecords(mapping.source_id)
  }

  const fetchRecords = async (sourceId: string) => {
    setRecordsLoading(true)
    try {
      const res = await fetch(`${API_URL}/v1/sources/${sourceId}/records?limit=50`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const data = await res.json()
      if (data.success) {
        setRecords(data.records || [])
      }
    } catch (err) {
      console.error('Failed to fetch records:', err)
      setRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }

  const getRecordLabel = (record: any) => {
    // Try to find a meaningful display label
    const fields = record.fields || record
    const labelFields = ['name', 'title', 'Name', 'Title', 'invoice_number', 'Invoice Number', 'id', 'ID']
    for (const field of labelFields) {
      if (fields[field]) return String(fields[field])
    }
    return record.id || 'Record'
  }

  const handleGenerateSingle = async () => {
    if (!generateTemplate || !generateMapping || !selectedRecordId) return

    setGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch(`${API_URL}/v1/generate/smart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          templateId: generateTemplate.id,
          sourceId: generateMapping.source_id,
          recordId: selectedRecordId,
          format: 'pdf'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      setGeneratedPdf({
        success: true,
        url: data.url,
        size: data.size,
        recordId: selectedRecordId,
        generatedAt: new Date().toISOString()
      })
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleStartBatch = async () => {
    if (!generateTemplate || !generateMapping) return

    setGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch(`${API_URL}/v1/generate/smart/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          templateId: generateTemplate.id,
          sourceId: generateMapping.source_id,
          filter: batchFilter ? { formula: batchFilter, limit: batchLimit } : { limit: batchLimit }
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start batch')
      }

      setBatchJob(data.job)
      // Start polling for status
      pollBatchStatus(data.job.id)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to start batch')
    } finally {
      setGenerating(false)
    }
  }

  const pollBatchStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/v1/generate/smart/batch/${jobId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        const data = await res.json()

        if (data.success) {
          setBatchJob(data.job)

          if (data.job.status === 'pending' || data.job.status === 'processing') {
            setTimeout(poll, 2000) // Poll every 2 seconds
          }
        }
      } catch (err) {
        console.error('Failed to poll batch status:', err)
      }
    }
    poll()
  }

  const handleDownloadBatch = async () => {
    if (!batchJob) return

    try {
      const res = await fetch(`${API_URL}/v1/generate/smart/batch/${batchJob.id}/download`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })

      if (!res.ok) {
        throw new Error('Download failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-${batchJob.id}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setGenerateError('Failed to download batch')
    }
  }

  const handleDownloadPdf = () => {
    if (!generatedPdf) return

    // If it's a data URL, convert to blob and download
    if (generatedPdf.url.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = generatedPdf.url
      link.download = `generated-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      window.open(generatedPdf.url, '_blank')
    }
  }

  const resetGenerateModal = () => {
    setShowGenerateModal(false)
    setGenerateTemplate(null)
    setGenerateMapping(null)
    setGenerateMode('single')
    setRecords([])
    setSelectedRecordId('')
    setBatchFilter('')
    setBatchLimit(100)
    setGeneratedPdf(null)
    setBatchJob(null)
    setGenerateError(null)
  }

  // ==================== PLAYGROUND FUNCTIONS ====================

  // Sample data for templates - matches quote-modern schema
  const sampleQuoteData = {
    meta: {
      quoteNumber: 'Q-2024-0042',
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      notes: 'Thank you for your business!',
      terms: 'Payment due within 30 days of invoice date.\nAll prices in USD.'
    },
    client: {
      name: 'Jane Smith',
      company: 'Smith Enterprises',
      address: '123 Main Street\nSuite 400\nNew York, NY 10001',
      email: 'jane@example.com'
    },
    lineItems: [
      { description: 'Enterprise License', quantity: 1, unitPrice: '2,400.00', total: '2,400.00' },
      { description: 'Premium Support (12 mo)', quantity: 12, unitPrice: '100.00', total: '1,200.00' }
    ],
    totals: {
      subtotal: '3,600.00',
      tax: '0.00',
      total: '3,600.00'
    },
    branding: {
      companyName: 'Acme Corp',
      companyAddress: '456 Tech Blvd\nSan Francisco, CA 94102'
    }
  }

  // Sample data for work-order template
  const sampleWorkOrderData = {
    work_order_number: 'WO-2024-00157',
    customer_name: 'Johnson Residence',
    customer_address: '1842 Oak Street\nSpringfield, IL 62701',
    contact_phone: '(555) 123-4567',
    work_description: 'HVAC system inspection and repair. Customer reports AC unit not cooling properly. Inspect refrigerant levels, check compressor, clean condenser coils, and replace air filter.',
    materials: [
      { item: 'R-410A Refrigerant (lb)', quantity: 2, unit_price: 45.00, line_total: 90.00 },
      { item: 'Air Filter 20x25x1', quantity: 1, unit_price: 18.00, line_total: 18.00 },
      { item: 'Capacitor 45/5 MFD', quantity: 1, unit_price: 35.00, line_total: 35.00 }
    ],
    labor_hours: 2.5,
    labor_rate: 85.00,
    labor_total: 212.50,
    materials_subtotal: 143.00,
    grand_total: 355.50,
    scheduled_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    technician_name: 'Mike Rodriguez',
    priority: 'normal'
  }

  // Get appropriate sample data for a template
  const getSampleDataForTemplate = (template: string): Record<string, unknown> => {
    // Extract template name from saved: prefix if present
    const templateName = template.startsWith('saved:') ? template.replace('saved:', '') : template

    switch (templateName) {
      case 'work-order':
        return sampleWorkOrderData
      default:
        return sampleQuoteData
    }
  }

  // Initialize playground session
  const initPlaygroundSession = useCallback(async (template: string = playgroundTemplate) => {
    if (!apiKey) return

    setPlaygroundLoading(true)
    setPlaygroundError(null)

    try {
      // Check if this is a saved template (prefixed with "saved:")
      const isSavedTemplate = template.startsWith('saved:')
      const templateId = isSavedTemplate ? template.replace('saved:', '') : template

      // Use appropriate sample data based on template
      const sampleData = getSampleDataForTemplate(template)

      const requestBody: Record<string, unknown> = {
        data: sampleData
      }

      if (isSavedTemplate) {
        // Use savedTemplateId for user's saved templates
        requestBody.savedTemplateId = templateId
      } else {
        // Use template for built-in templates
        requestBody.template = templateId
      }

      const response = await fetch(`${API_URL}/v1/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to load preview')
      }

      const result = await response.json()
      setPlaygroundHtml(result.html)
      setPlaygroundSessionId(result.sessionId)
      setPlaygroundUndoStack([])
    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setPlaygroundLoading(false)
    }
  }, [apiKey, playgroundTemplate])

  // Check if prompt is an instant action (no AI needed)
  const isInstantAction = (prompt: string): boolean => {
    const lowPrompt = prompt.toLowerCase()
    const instantPatterns = [
      /qr\s*code/i,
      /watermark/i,
      /group.*by.*category/i,
      /payment\s*terms/i,
      /net\s*\d+/i,
      /bold.*header/i,
      /larger.*header/i,
      /add.*date/i,
      /add.*border/i,
      /thank.*you.*note/i,
      /add.*signature/i
    ]
    return instantPatterns.some(pattern => pattern.test(lowPrompt))
  }

  // Apply instant action locally (no AI)
  const applyInstantAction = (prompt: string, html: string): string => {
    const lowPrompt = prompt.toLowerCase()
    let modifiedHtml = html

    // QR Code
    if (/qr\s*code/i.test(lowPrompt)) {
      const qrHtml = `
        <div style="position: absolute; bottom: 20px; right: 20px; text-align: center;">
          <svg viewBox="0 0 100 100" width="60" height="60" fill="none" stroke="#1E3A5F" stroke-width="3">
            <rect x="10" y="10" width="25" height="25"/><rect x="15" y="15" width="15" height="15" fill="#1E3A5F"/>
            <rect x="65" y="10" width="25" height="25"/><rect x="70" y="15" width="15" height="15" fill="#1E3A5F"/>
            <rect x="10" y="65" width="25" height="25"/><rect x="15" y="70" width="15" height="15" fill="#1E3A5F"/>
            <rect x="40" y="40" width="20" height="20" fill="#1E3A5F"/>
          </svg>
          <div style="font-size: 8px; color: #64748B; margin-top: 4px;">Scan to Pay</div>
        </div>`
      if (html.includes('</body>')) {
        modifiedHtml = html.replace('</body>', qrHtml + '</body>')
      }
    }

    // Watermark
    if (/watermark/i.test(lowPrompt)) {
      const watermarkHtml = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 72px; color: rgba(30, 58, 95, 0.1); font-weight: bold; pointer-events: none; z-index: 1000;">DRAFT</div>`
      if (html.includes('</body>')) {
        modifiedHtml = html.replace('</body>', watermarkHtml + '</body>')
      }
    }

    // Payment terms
    if (/payment\s*terms/i.test(lowPrompt) || /net\s*\d+/i.test(lowPrompt)) {
      const termsHtml = `
        <div style="margin-top: 24px; padding: 16px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid #1E3A5F;">
          <div style="font-weight: 600; color: #1E3A5F; margin-bottom: 4px;">Payment Terms</div>
          <div style="color: #64748B; font-size: 14px;">Net 30 days from invoice date. 2% discount for payment within 10 days.</div>
        </div>`
      if (html.includes('</body>')) {
        modifiedHtml = html.replace('</body>', termsHtml + '</body>')
      }
    }

    // Add signature
    if (/signature/i.test(lowPrompt)) {
      const signatureHtml = `
        <div style="margin-top: 40px; display: flex; gap: 40px;">
          <div style="flex: 1;">
            <div style="border-bottom: 1px solid #CBD5E1; margin-bottom: 8px; height: 40px;"></div>
            <div style="color: #64748B; font-size: 12px;">Client Signature</div>
          </div>
          <div style="width: 120px;">
            <div style="border-bottom: 1px solid #CBD5E1; margin-bottom: 8px; height: 40px;"></div>
            <div style="color: #64748B; font-size: 12px;">Date</div>
          </div>
        </div>`
      if (html.includes('</body>')) {
        modifiedHtml = html.replace('</body>', signatureHtml + '</body>')
      }
    }

    return modifiedHtml
  }

  // Apply modifications to playground
  const applyPlaygroundModification = async (prompt: string) => {
    if (!prompt.trim() || !playgroundHtml) return

    setPlaygroundModifying(true)
    setPlaygroundError(null)

    // Save current state to undo stack
    setPlaygroundUndoStack(prev => [...prev.slice(-9), playgroundHtml])

    try {
      // Check if instant action
      if (isInstantAction(prompt)) {
        const modifiedHtml = applyInstantAction(prompt, playgroundHtml)
        setPlaygroundHtml(modifiedHtml)
        setPlaygroundPrompt('')
        setPlaygroundModifying(false)
        return
      }

      // AI modification
      const response = await fetch(`${API_URL}/v1/modify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          sessionId: playgroundSessionId,
          prompt,
          html: playgroundHtml
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Modification failed')
      }

      const result = await response.json()
      setPlaygroundHtml(result.html)
      setPlaygroundPrompt('')
    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : 'Modification failed')
      // Restore from undo stack on error
      setPlaygroundUndoStack(prev => {
        if (prev.length > 0) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setPlaygroundModifying(false)
    }
  }

  // Undo last modification
  const undoPlaygroundModification = () => {
    if (playgroundUndoStack.length === 0) return
    const previousHtml = playgroundUndoStack[playgroundUndoStack.length - 1]
    setPlaygroundHtml(previousHtml)
    setPlaygroundUndoStack(prev => prev.slice(0, -1))
  }

  // Download PDF from playground
  const downloadPlaygroundPdf = async () => {
    if (!playgroundHtml) return

    setPlaygroundLoading(true)
    try {
      const response = await fetch(`${API_URL}/v1/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          html: playgroundHtml,
          format: 'pdf'
        })
      })

      if (!response.ok) {
        throw new Error('PDF generation failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `glyph-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : 'PDF download failed')
    } finally {
      setPlaygroundLoading(false)
    }
  }

  // Save template from playground
  const savePlaygroundTemplate = async () => {
    if (!playgroundHtml || !saveTemplateName.trim()) return

    setSavingPlaygroundTemplate(true)
    setPlaygroundError(null)

    try {
      // If we have a saved template and session (source-first workflow), use Mustache-safe endpoint
      if (playgroundSavedTemplateId && playgroundSessionId) {
        const response = await fetch(`${API_URL}/v1/templates/saved/${playgroundSavedTemplateId}/save-from-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            sessionId: playgroundSessionId,
            saveAs: 'update'
          })
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to save template')
        }
      } else {
        // Original save path for new templates (non-source workflow)
        const response = await fetch(`${API_URL}/v1/templates/saved`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            name: saveTemplateName.trim(),
            type: saveTemplateType || undefined,
            description: saveTemplateDescription || undefined,
            html: playgroundTemplateHtml || playgroundHtml // Prefer template_html if available
          })
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to save template')
        }
      }

      // Success - close modal and refresh templates
      setShowSaveTemplateModal(false)
      setSaveTemplateName('')
      setSaveTemplateType('')
      setSaveTemplateDescription('')
      await fetchTemplates()
    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSavingPlaygroundTemplate(false)
    }
  }

  // Switch playground template
  const switchPlaygroundTemplate = (template: string) => {
    setPlaygroundTemplate(template)
    // Reset source-first state when switching templates
    setPlaygroundSourceId(null)
    setPlaygroundMappingId(null)
    setPlaygroundSavedTemplateId(null)
    setPlaygroundRecords([])
    setPlaygroundRecordIndex(0)
    setPlaygroundRecordId(null)
    setPlaygroundTemplateHtml('')
    initPlaygroundSession(template)
  }

  // Handle source selection for source-first playground
  const handleSourceSelect = async (sourceId: string) => {
    if (!sourceId) {
      // Reset to sample data mode
      setPlaygroundSourceId(null)
      setPlaygroundMappingId(null)
      setPlaygroundSavedTemplateId(null)
      setPlaygroundRecords([])
      setPlaygroundRecordIndex(0)
      setPlaygroundRecordId(null)
      setPlaygroundTemplateHtml('')
      initPlaygroundSession(playgroundTemplate)
      return
    }

    setPlaygroundSourceId(sourceId)
    setPlaygroundSourceLoading(true)
    setPlaygroundError(null)

    try {
      // 1. Find or create mapping for this source
      const mappingsRes = await fetch(`${API_URL}/v1/mappings?source_id=${sourceId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const mappingsData = await mappingsRes.json()

      let mappingId: string

      if (mappingsData.mappings?.length > 0) {
        // Use existing mapping
        mappingId = mappingsData.mappings[0].id
        setPlaygroundMappingId(mappingId)
        setPlaygroundSavedTemplateId(mappingsData.mappings[0].template_id)
      } else {
        // No mapping - prompt user to create one or clone a template
        setPlaygroundError('No template linked to this source. Link a template first in My Templates.')
        setPlaygroundSourceLoading(false)
        return
      }

      // 2. Fetch records for navigation
      const recordsRes = await fetch(`${API_URL}/v1/sources/${sourceId}/records?limit=100`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const recordsData = await recordsRes.json()
      setPlaygroundRecords(recordsData.records || [])

      if (!recordsData.records?.length) {
        setPlaygroundError('No records found in this data source.')
        setPlaygroundSourceLoading(false)
        return
      }

      // 3. Create session from mapping
      const sessionRes = await fetch(`${API_URL}/v1/sessions/from-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          mapping_id: mappingId,
          record_id: recordsData.records[0]?.id
        })
      })
      const sessionData = await sessionRes.json()

      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to create session')
      }

      setPlaygroundHtml(sessionData.preview.html)
      setPlaygroundSessionId(sessionData.sessionId)
      setPlaygroundTemplateHtml(sessionData.template?.template_html || '')
      setPlaygroundRecordId(sessionData.preview.record_id || recordsData.records[0]?.id)
      setPlaygroundRecordIndex(0)
      setPlaygroundUndoStack([])

    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : 'Failed to load source')
    } finally {
      setPlaygroundSourceLoading(false)
    }
  }

  // Navigate between records in source-first playground
  const navigateRecord = async (direction: number) => {
    const newIndex = playgroundRecordIndex + direction
    if (newIndex < 0 || newIndex >= playgroundRecords.length) return
    if (!playgroundMappingId) return

    setPlaygroundSourceLoading(true)
    setPlaygroundRecordIndex(newIndex)

    try {
      const recordId = playgroundRecords[newIndex].id

      // Create new session with different record
      const sessionRes = await fetch(`${API_URL}/v1/sessions/from-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          mapping_id: playgroundMappingId,
          record_id: recordId
        })
      })
      const sessionData = await sessionRes.json()

      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to load record')
      }

      setPlaygroundHtml(sessionData.preview.html)
      setPlaygroundSessionId(sessionData.sessionId)
      setPlaygroundTemplateHtml(sessionData.template?.template_html || '')
      setPlaygroundRecordId(recordId)
      setPlaygroundUndoStack([])
    } catch (err) {
      setPlaygroundError(err instanceof Error ? err.message : 'Failed to navigate')
    } finally {
      setPlaygroundSourceLoading(false)
    }
  }

  // Fetch built-in templates on mount (no auth required)
  useEffect(() => {
    fetchBuiltInTemplates()
  }, [fetchBuiltInTemplates])

  // Fetch user templates when dashboard data loads
  useEffect(() => {
    if (data && apiKey) {
      fetchTemplates()
      fetchSources()
    }
  }, [data, apiKey, fetchTemplates, fetchSources])

  // Fetch mappings when sources load
  useEffect(() => {
    if (data && apiKey && sources.length > 0) {
      fetchMappings()
    }
  }, [data, apiKey, sources, fetchMappings])

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'var(--error)'
    if (percentage >= 75) return 'var(--warning)'
    return 'var(--glyph-primary-bright)'
  }

  const maskedKey = apiKey ? `${apiKey.slice(0, 11)}${'*'.repeat(16)}` : ''

  // Generate playground URL with API key for cross-domain auth
  const getPlaygroundUrl = (hash = '') => {
    if (apiKey && apiKey.startsWith('gk_') && apiKey !== 'gk_demo_playground_2024') {
      return `https://glyph.you${hash}?apiKey=${encodeURIComponent(apiKey)}`
    }
    return `https://glyph.you${hash}`
  }

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
          <a href={getPlaygroundUrl()} class="logo">
            {/* G lettermark logo - matches landing page */}
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M16 2C8.268 2 2 8.268 2 16C2 23.732 8.268 30 16 30C23.732 30 30 23.732 30 16V14H16V18H25.5C24.5 22.5 20.6 26 16 26C10.477 26 6 21.523 6 16C6 10.477 10.477 6 16 6C19.5 6 22.6 7.8 24.5 10.5L28 8C25.3 4.3 21 2 16 2Z" fill="#1E3A5F"/>
            </svg>
            <span class="logo-text">Glyph</span>
          </a>
          <nav class="nav-links">
            {data && (
              <>
                <button
                  class={`nav-link ${page === 'dashboard' ? 'nav-link--active' : ''}`}
                  onClick={() => setPage('dashboard')}
                >
                  Dashboard
                </button>
                <button
                  class={`nav-link ${page === 'playground' ? 'nav-link--active' : ''}`}
                  onClick={() => { setPage('playground'); if (!playgroundHtml) initPlaygroundSession(); }}
                >
                  Playground
                </button>
                <button
                  class={`nav-link ${page === 'my-templates' ? 'nav-link--active' : ''}`}
                  onClick={() => setPage('my-templates')}
                >
                  My Templates
                </button>
              </>
            )}
            <a href="https://docs.glyph.you" target="_blank" class="docs-link">
              {Icons.docs}
              <span>Docs</span>
            </a>
            {(page === 'dashboard' || page === 'playground' || page === 'my-templates') && data && (
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
              {/* Value Preview - Show what users get before asking for login */}
              <div class="value-preview">
                <div class="value-preview-item">
                  <div class="value-preview-icon">
                    {Icons.key}
                  </div>
                  <div class="value-preview-text">
                    <strong>Your API Keys</strong>
                    <span>Manage and regenerate keys</span>
                  </div>
                </div>
                <div class="value-preview-item">
                  <div class="value-preview-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 20V10"/>
                      <path d="M12 20V4"/>
                      <path d="M6 20v-6"/>
                    </svg>
                  </div>
                  <div class="value-preview-text">
                    <strong>Usage Analytics</strong>
                    <span>Track requests and limits</span>
                  </div>
                </div>
                <div class="value-preview-item">
                  <div class="value-preview-icon">
                    {Icons.docs}
                  </div>
                  <div class="value-preview-text">
                    <strong>Integration Setup</strong>
                    <span>Code snippets and guides</span>
                  </div>
                </div>
              </div>

              <div class="value-preview-cta">
                <span class="free-tier-badge">Free tier: 100 PDFs/month</span>
              </div>

              <div class="auth-divider">
                <span>Sign in to access</span>
              </div>

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

                <button
                  type="button"
                  class="btn-link forgot-key-link"
                  onClick={() => { setShowRecoveryModal(true); setError(null); }}
                >
                  Forgot your API key?
                </button>
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

              {/* Templates */}
              <section class="section">
                <div class="section-header">
                  <h2>Saved Templates</h2>
                  <span class="template-count">{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
                </div>

                {templatesLoading ? (
                  <div class="templates-loading">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div class="templates-empty">
                    <div class="empty-icon">{Icons.file}</div>
                    <p class="empty-title">No templates yet</p>
                    <p class="empty-description">Save templates from the playground to manage them here</p>
                    <button onClick={() => setPage('playground')} class="empty-cta">
                      Open Playground
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div class="templates-list">
                    {templates.map(template => (
                      <div key={template.id} class="template-card">
                        <div class="template-header">
                          <div class="template-name">
                            {template.isDefault && (
                              <span class="default-indicator" title="Default template">
                                {Icons.star}
                              </span>
                            )}
                            {template.name}
                          </div>
                          <div class="template-badges">
                            {template.type && (
                              <span class="type-badge">{template.type}</span>
                            )}
                            {template.style && (
                              <span class="style-badge">{template.style}</span>
                            )}
                          </div>
                        </div>
                        {template.description && (
                          <p class="template-description">{template.description}</p>
                        )}
                        <div class="template-meta">
                          <span>v{template.version}</span>
                          <span>Updated {formatDate(template.updatedAt)}</span>
                        </div>
                        <div class="template-actions">
                          <button
                            class="btn btn-icon"
                            onClick={() => copyTemplateId(template.id)}
                            title="Copy template ID"
                          >
                            {copiedTemplateId === template.id ? Icons.check : Icons.copy}
                          </button>
                          <button
                            class="btn btn-icon"
                            onClick={() => setEditingTemplate(template)}
                            title="Edit template"
                          >
                            {Icons.edit}
                          </button>
                          <button
                            class="btn btn-icon btn-icon-danger"
                            onClick={() => setShowDeleteConfirm(template.id)}
                            title="Delete template"
                          >
                            {Icons.trash}
                          </button>
                        </div>

                        {/* Linked Sources */}
                        {sources.length > 0 && (
                          <div class="template-sources">
                            <div class="template-sources-header">
                              <span class="sources-label">Data Sources</span>
                              <button
                                class="btn btn-sm btn-outline"
                                onClick={() => openLinkSource(template)}
                              >
                                + Link
                              </button>
                            </div>

                            {getTemplateMappings(template.id).length > 0 ? (
                              <div class="linked-sources-list">
                                {getTemplateMappings(template.id).map(mapping => (
                                  <div key={mapping.id} class="linked-source">
                                    <span class="linked-source-name">
                                      {getSourceName(mapping.source_id)}
                                    </span>
                                    {mapping.is_default && (
                                      <span class="default-badge">Default</span>
                                    )}
                                    <span class={`validation-badge validation-badge--${mapping.validation_status}`}>
                                      {mapping.validation_status}
                                    </span>
                                    <button
                                      class="btn btn-icon btn-sm"
                                      onClick={() => openFieldMapper(template.id, mapping.source_id)}
                                      title="Edit mapping"
                                    >
                                      {Icons.edit}
                                    </button>
                                    <button
                                      class="btn btn-icon btn-sm btn-generate"
                                      onClick={() => openGenerateModal(template, mapping)}
                                      title="Generate PDF"
                                    >
                                      {Icons.file}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p class="no-sources-linked">No sources linked</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Data Sources Section */}
              <section class="section">
                <div class="section-header">
                  <h2>Data Sources</h2>
                  <button
                    class="btn btn-primary-outline"
                    onClick={() => setShowAddSource(true)}
                  >
                    + Add Source
                  </button>
                </div>

                {sourcesLoading ? (
                  <div class="sources-loading">Loading sources...</div>
                ) : sources.length === 0 ? (
                  <div class="sources-empty">
                    <div class="empty-icon">{Icons.database}</div>
                    <p class="empty-title">No data sources connected</p>
                    <p class="empty-description">Connect Airtable, REST APIs, or webhooks to generate PDFs from your data</p>
                    <button class="btn btn-primary" onClick={() => setShowAddSource(true)}>
                      Connect Your First Source
                    </button>
                  </div>
                ) : (
                  <div class="sources-list">
                    {sources.map(source => (
                      <div key={source.id} class="source-card">
                        <div class="source-header">
                          <div class="source-icon">
                            {source.source_type === 'airtable' && Icons.airtable}
                            {source.source_type === 'rest_api' && Icons.api}
                            {source.source_type === 'webhook' && Icons.webhook}
                            {source.source_type === 'database' && Icons.database}
                            {!['airtable', 'rest_api', 'webhook', 'database'].includes(source.source_type) && Icons.database}
                          </div>
                          <div class="source-info">
                            <div class="source-name">{source.name}</div>
                            <div class="source-type">{source.source_type.replace('_', ' ')}</div>
                          </div>
                          <div class={`source-status source-status--${source.status}`}>
                            {source.status}
                          </div>
                        </div>

                        {source.discovered_schema && (
                          <div class="source-schema">
                            <span>{source.discovered_schema.fields?.length || 0} fields</span>
                            <span class="dot"></span>
                            <span>{source.last_sync_record_count || source.discovered_schema.record_count || 0} records</span>
                          </div>
                        )}

                        {source.status_message && source.status === 'failed' && (
                          <div class="source-error">{source.status_message}</div>
                        )}

                        <div class="source-meta">
                          <span>Last sync: {source.last_sync_at ? formatDate(source.last_sync_at) : 'Never'}</span>
                        </div>

                        <div class="source-actions">
                          <button
                            class="btn btn-icon"
                            onClick={() => handleTestSource(source.id)}
                            title="Test connection"
                            disabled={testingSourceId === source.id}
                          >
                            {testingSourceId === source.id ? Icons.refresh : Icons.zap}
                          </button>
                          <button
                            class="btn btn-icon"
                            onClick={() => handleSyncSource(source.id)}
                            title="Sync schema"
                            disabled={syncingSourceId === source.id}
                          >
                            {Icons.refresh}
                          </button>
                          <button
                            class="btn btn-icon btn-icon-danger"
                            onClick={() => setDeleteSourceConfirm(source.id)}
                            title="Delete"
                          >
                            {Icons.trash}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

          {/* ==================== PLAYGROUND PAGE ==================== */}
          {page === 'playground' && data && (
            <div class="playground-page animate-in">
              <div class="playground-header">
                <h1>Playground</h1>
                <p class="playground-subtitle">Customize your PDF template with natural language commands</p>
              </div>

              {/* Template Selector */}
              <div class="playground-toolbar">
                <div class="playground-template-select">
                  <label>Template:</label>
                  <select
                    class="api-input"
                    value={playgroundTemplate}
                    onChange={(e) => switchPlaygroundTemplate((e.target as HTMLSelectElement).value)}
                  >
                    {builtInTemplates.length > 0 && (
                      <optgroup label="Default Templates">
                        {builtInTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {templates.length > 0 && (
                      <optgroup label="Your Templates">
                        {templates.map(t => (
                          <option key={t.id} value={`saved:${t.id}`}>{t.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {builtInTemplates.length === 0 && templates.length === 0 && (
                      <option value="quote-modern">Quote - Modern</option>
                    )}
                  </select>
                </div>
                <div class="playground-actions-right">
                  <button
                    class="btn btn-secondary"
                    onClick={downloadPlaygroundPdf}
                    disabled={playgroundLoading || !playgroundHtml}
                    title="Download PDF"
                  >
                    {Icons.file}
                    <span>Download PDF</span>
                  </button>
                  <button
                    class="btn btn-primary"
                    onClick={() => {
                      // Pre-fill template name based on current template
                      const templateNames: Record<string, string> = {
                        'quote-modern': 'Quote - Modern',
                        'quote-professional': 'Quote - Professional',
                        'quote-bold': 'Quote - Bold',
                        'invoice-modern': 'Invoice - Modern',
                        'receipt-modern': 'Receipt - Modern',
                      }
                      const templateTypes: Record<string, string> = {
                        'quote-modern': 'quote',
                        'quote-professional': 'quote',
                        'quote-bold': 'quote',
                        'invoice-modern': 'invoice',
                        'receipt-modern': 'receipt',
                      }
                      const baseName = templateNames[playgroundTemplate] || playgroundTemplate
                      setSaveTemplateName(`${baseName} (Modified)`)
                      setSaveTemplateType(templateTypes[playgroundTemplate] || '')
                      setShowSaveTemplateModal(true)
                    }}
                    disabled={!playgroundHtml}
                    title="Save as template"
                  >
                    {Icons.star}
                    <span>Save Template</span>
                  </button>
                </div>
              </div>

              {/* Data Source Selector - show when user has sources */}
              {sources.length > 0 && (
                <div class="playground-source-selector">
                  <label class="playground-source-selector__label">Data Source:</label>
                  <select
                    class="api-input playground-source-selector__dropdown"
                    value={playgroundSourceId || ''}
                    onChange={(e) => handleSourceSelect((e.target as HTMLSelectElement).value)}
                    disabled={playgroundSourceLoading}
                  >
                    <option value="">Use sample data</option>
                    {sources.map(source => (
                      <option value={source.id} key={source.id}>
                        {source.name} ({source.source_type})
                      </option>
                    ))}
                  </select>
                  {playgroundSourceId && playgroundRecords.length > 0 && (
                    <span class="playground-source-selector__badge">
                      {playgroundRecords.length} records
                    </span>
                  )}
                  {playgroundSourceLoading && (
                    <span class="playground-source-selector__loading">Loading...</span>
                  )}
                </div>
              )}

              {/* Record Navigator - show when source is selected with multiple records */}
              {playgroundSourceId && playgroundRecords.length > 1 && (
                <div class="record-navigator">
                  <button
                    class="record-navigator__btn"
                    onClick={() => navigateRecord(-1)}
                    disabled={playgroundRecordIndex === 0 || playgroundSourceLoading}
                    title="Previous record"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6"/>
                    </svg>
                  </button>
                  <span class="record-navigator__count" title={playgroundRecordId || undefined}>
                    Record {playgroundRecordIndex + 1} of {playgroundRecords.length}
                  </span>
                  <button
                    class="record-navigator__btn"
                    onClick={() => navigateRecord(1)}
                    disabled={playgroundRecordIndex >= playgroundRecords.length - 1 || playgroundSourceLoading}
                    title="Next record"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                </div>
              )}

              <div class="playground-content">
                {/* Input Area */}
                <div class="playground-input-panel">
                  <div class="playground-quick-actions">
                    <h3>Quick Actions</h3>
                    <div class="quick-action-buttons">
                      <button
                        class="quick-action-btn"
                        onClick={() => applyPlaygroundModification('Add a diagonal watermark that says DRAFT across the page')}
                        disabled={playgroundModifying || !playgroundHtml}
                      >
                        Add Watermark
                        <span class="quick-action-badge">instant</span>
                      </button>
                      <button
                        class="quick-action-btn"
                        onClick={() => applyPlaygroundModification('Add a QR code in the corner for quick mobile payment')}
                        disabled={playgroundModifying || !playgroundHtml}
                      >
                        Add QR Code
                        <span class="quick-action-badge">instant</span>
                      </button>
                      <button
                        class="quick-action-btn"
                        onClick={() => applyPlaygroundModification('Add payment terms: Net 30 with 2% early payment discount')}
                        disabled={playgroundModifying || !playgroundHtml}
                      >
                        Add Terms
                        <span class="quick-action-badge">instant</span>
                      </button>
                      <button
                        class="quick-action-btn"
                        onClick={() => applyPlaygroundModification('Add a signature line with date field')}
                        disabled={playgroundModifying || !playgroundHtml}
                      >
                        Add Signature
                        <span class="quick-action-badge">instant</span>
                      </button>
                    </div>
                  </div>

                  <div class="playground-prompt-section">
                    <h3>Custom Changes</h3>
                    <p class="playground-prompt-hint">Describe any change you want to make to the document</p>
                    <textarea
                      class="playground-prompt-input"
                      value={playgroundPrompt}
                      onInput={(e) => setPlaygroundPrompt((e.target as HTMLTextAreaElement).value)}
                      placeholder="e.g., Make the header blue, add a thank you note at the bottom, change the font to serif..."
                      rows={3}
                      disabled={playgroundModifying}
                    />
                    <div class="playground-prompt-actions">
                      <button
                        class="btn btn-primary"
                        onClick={() => applyPlaygroundModification(playgroundPrompt)}
                        disabled={playgroundModifying || !playgroundPrompt.trim() || !playgroundHtml}
                      >
                        {playgroundModifying ? 'Applying...' : 'Apply Changes'}
                      </button>
                      <button
                        class="btn btn-secondary"
                        onClick={undoPlaygroundModification}
                        disabled={playgroundUndoStack.length === 0 || playgroundModifying}
                        title="Undo last change"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8m-5-10l4-4m-4 4l4 4"/>
                        </svg>
                        Undo
                      </button>
                    </div>
                  </div>

                  {playgroundError && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{playgroundError}</span>
                      <button class="btn btn-icon" onClick={() => setPlaygroundError(null)}>
                        {Icons.x}
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview Area */}
                <div class="playground-preview-panel">
                  <div class="playground-preview-header">
                    <span class="playground-preview-label">Live Preview</span>
                    <span class={`playground-preview-status ${playgroundLoading || playgroundModifying ? 'loading' : 'ready'}`}>
                      {playgroundLoading || playgroundModifying ? 'Processing...' : 'Ready'}
                    </span>
                  </div>
                  <div class="playground-preview-container">
                    {playgroundLoading ? (
                      <div class="playground-loading">
                        <div class="playground-loading-spinner" />
                        <span>Loading preview...</span>
                      </div>
                    ) : playgroundHtml ? (
                      <div class="playground-preview-paper">
                        <iframe
                          class="playground-preview-frame"
                          srcDoc={playgroundHtml}
                          title="Document Preview"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    ) : (
                      <div class="playground-empty">
                        <p>Select a template to get started</p>
                        <button class="btn btn-primary" onClick={() => initPlaygroundSession()}>
                          Load Template
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== MY TEMPLATES PAGE ==================== */}
          {page === 'my-templates' && data && (
            <div class="my-templates-page animate-in">
              <div class="my-templates-header">
                <h1>My Templates</h1>
                <p class="my-templates-subtitle">Templates linked to your data sources</p>
              </div>

              {templatesLoading ? (
                <div class="my-templates-loading">
                  <div class="my-templates-spinner" />
                  <p>Loading your templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div class="my-templates-empty-state">
                  <div class="empty-icon-large">{Icons.file}</div>
                  <h2>No templates yet</h2>
                  <p>Connect a data source to get started with auto-matched templates</p>

                  <div class="empty-actions">
                    <button
                      class="btn btn-primary"
                      onClick={() => { setPage('playground'); if (!playgroundHtml) initPlaygroundSession(); }}
                    >
                      Go to Playground
                    </button>
                  </div>

                  <div class="quick-start-tips">
                    <h4>Quick Start</h4>
                    <ol>
                      <li>Connect your Airtable or REST API</li>
                      <li>We'll auto-match the best template</li>
                      <li>Customize it in the playground</li>
                      <li>Generate PDFs with one API call</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div class="my-templates-grid">
                  {templates.map(template => {
                    const templateMappings = getTemplateMappings(template.id)
                    const defaultMapping = templateMappings.find(m => m.is_default)
                    const linkedSource = defaultMapping
                      ? sources.find(s => s.id === defaultMapping.source_id)
                      : null

                    return (
                      <div key={template.id} class="my-template-card">
                        <div class="my-template-card-header">
                          <h3>{template.name}</h3>
                          {template.type && <span class="my-template-type-badge">{template.type}</span>}
                        </div>

                        {template.description && (
                          <p class="my-template-description">{template.description}</p>
                        )}

                        {linkedSource ? (
                          <div class="my-linked-source-info">
                            <span class="my-source-icon">
                              {linkedSource.source_type === 'airtable' ? Icons.airtable :
                               linkedSource.source_type === 'rest_api' ? Icons.api : Icons.database}
                            </span>
                            <span class="my-source-name">{linkedSource.name}</span>
                            {linkedSource.last_sync_record_count !== null && (
                              <span class="my-record-count">
                                {linkedSource.last_sync_record_count} records
                              </span>
                            )}
                          </div>
                        ) : (
                          <div class="my-no-source-info">
                            <span class="my-no-source-text">No data source linked</span>
                            <button
                              class="btn btn-sm btn-outline"
                              onClick={() => openLinkSource(template)}
                            >
                              + Link Source
                            </button>
                          </div>
                        )}

                        <div class="my-template-card-meta">
                          <span class="my-last-updated">
                            Updated {formatRelativeTime(template.updatedAt)}
                          </span>
                          {template.style && (
                            <span class="my-style-badge">{template.style}</span>
                          )}
                        </div>

                        <div class="my-template-card-actions">
                          <button
                            class="btn btn-edit"
                            onClick={() => {
                              const params = new URLSearchParams()
                              params.set('templateId', template.id)
                              if (linkedSource) {
                                params.set('sourceId', linkedSource.id)
                              }
                              window.open(`https://glyph.you?${params.toString()}`, '_blank')
                            }}
                          >
                            Edit Template
                          </button>
                          {linkedSource && defaultMapping && (
                            <button
                              class="btn btn-generate"
                              onClick={() => openGenerateModal(template, defaultMapping)}
                            >
                              Generate PDF
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div class="modal-overlay" onClick={() => setShowSaveTemplateModal(false)}>
          <div class="modal modal-save-template" onClick={(e) => e.stopPropagation()}>
            <h3>Save Template</h3>
            <p class="modal-subtitle">Save your customized template for reuse</p>

            <form
              class="save-template-form"
              onSubmit={(e) => {
                e.preventDefault()
                savePlaygroundTemplate()
              }}
            >
              <div class="form-group">
                <label htmlFor="save-template-name">Template Name *</label>
                <input
                  id="save-template-name"
                  type="text"
                  class="api-input"
                  value={saveTemplateName}
                  onInput={(e) => setSaveTemplateName((e.target as HTMLInputElement).value)}
                  placeholder="My Custom Quote"
                  required
                  autoFocus
                />
              </div>

              <div class="form-group">
                <label htmlFor="save-template-type">Type</label>
                <select
                  id="save-template-type"
                  class="api-input"
                  value={saveTemplateType}
                  onChange={(e) => setSaveTemplateType((e.target as HTMLSelectElement).value)}
                >
                  <option value="">None</option>
                  <option value="invoice">Invoice</option>
                  <option value="quote">Quote</option>
                  <option value="report">Report</option>
                  <option value="certificate">Certificate</option>
                  <option value="letter">Letter</option>
                  <option value="receipt">Receipt</option>
                  <option value="contract">Contract</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div class="form-group">
                <label htmlFor="save-template-description">Description</label>
                <textarea
                  id="save-template-description"
                  class="api-input textarea"
                  value={saveTemplateDescription}
                  onInput={(e) => setSaveTemplateDescription((e.target as HTMLTextAreaElement).value)}
                  placeholder="Optional description of your template..."
                  rows={2}
                />
              </div>

              {playgroundError && (
                <div class="error-banner">
                  {Icons.warning}
                  <span>{playgroundError}</span>
                </div>
              )}

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={() => {
                    setShowSaveTemplateModal(false)
                    setSaveTemplateName('')
                    setSaveTemplateType('')
                    setSaveTemplateDescription('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={savingPlaygroundTemplate || !saveTemplateName.trim()}
                >
                  {savingPlaygroundTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Key Recovery Modal */}
      {showRecoveryModal && (
        <div class="modal-overlay" onClick={closeRecoveryModal}>
          <div class="modal modal-recovery" onClick={(e) => e.stopPropagation()}>
            {!recoverySuccess ? (
              <>
                <h3>
                  {Icons.mail}
                  <span>Recover API Key</span>
                </h3>
                <p class="modal-description">
                  Enter the email address associated with your API key.
                  This will generate a new key and invalidate your old one.
                </p>

                <form onSubmit={handleRecoverKey} class="recovery-form">
                  <div class="input-group">
                    <input
                      type="email"
                      value={recoveryEmail}
                      onInput={(e) => setRecoveryEmail((e.target as HTMLInputElement).value)}
                      placeholder="you@example.com"
                      class="api-input"
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>

                  {error && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{error}</span>
                    </div>
                  )}

                  <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onClick={closeRecoveryModal}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      disabled={recovering || !recoveryEmail.trim()}
                    >
                      {recovering ? 'Recovering...' : 'Recover Key'}
                    </button>
                  </div>
                </form>

                <p class="recovery-warning">
                  {Icons.shield}
                  <span>For security, this will generate a new key. Your old key will stop working immediately.</span>
                </p>
              </>
            ) : (
              <>
                <div class="success-icon">
                  {Icons.checkCircle}
                </div>
                <h3>Key Recovered!</h3>
                <p class="modal-description">
                  Your new API key has been generated. Copy it now - it won't be shown again.
                </p>

                <div class="new-key-display">
                  <code class="mono">{recoveredKey}</code>
                  <button
                    type="button"
                    class="btn btn-icon"
                    onClick={() => {
                      if (recoveredKey) {
                        navigator.clipboard.writeText(recoveredKey)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }
                    }}
                    aria-label="Copy key"
                  >
                    {copied ? Icons.check : Icons.copy}
                  </button>
                </div>

                <div class="modal-actions">
                  <button class="btn btn-primary" onClick={handleUseRecoveredKey}>
                    Use This Key
                  </button>
                </div>

                <p class="recovery-note">
                  This key has been saved. Click "Use This Key" to sign in automatically.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div class="modal-overlay" onClick={() => setEditingTemplate(null)}>
          <div class="modal modal-edit-template" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Template</h3>
            <form
              class="edit-template-form"
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const formData = new FormData(form)
                handleUpdateTemplate(editingTemplate.id, {
                  name: formData.get('name') as string,
                  type: formData.get('type') as string || null,
                  description: formData.get('description') as string || null,
                  style: formData.get('style') as string || null,
                  isDefault: formData.get('isDefault') === 'on',
                })
              }}
            >
              <div class="form-group">
                <label htmlFor="template-name">Name</label>
                <input
                  id="template-name"
                  name="name"
                  type="text"
                  class="api-input"
                  defaultValue={editingTemplate.name}
                  required
                />
              </div>

              <div class="form-group">
                <label htmlFor="template-type">Type</label>
                <select
                  id="template-type"
                  name="type"
                  class="api-input"
                  defaultValue={editingTemplate.type || ''}
                >
                  <option value="">None</option>
                  <option value="invoice">Invoice</option>
                  <option value="quote">Quote</option>
                  <option value="report">Report</option>
                  <option value="certificate">Certificate</option>
                  <option value="letter">Letter</option>
                  <option value="receipt">Receipt</option>
                  <option value="contract">Contract</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div class="form-group">
                <label htmlFor="template-description">Description</label>
                <textarea
                  id="template-description"
                  name="description"
                  class="api-input textarea"
                  rows={3}
                  defaultValue={editingTemplate.description || ''}
                  placeholder="Optional description..."
                />
              </div>

              <div class="form-group">
                <label htmlFor="template-style">Style</label>
                <select
                  id="template-style"
                  name="style"
                  class="api-input"
                  defaultValue={editingTemplate.style || ''}
                >
                  <option value="">None</option>
                  <option value="professional">Professional</option>
                  <option value="minimal">Minimal</option>
                  <option value="bold">Bold</option>
                  <option value="classic">Classic</option>
                  <option value="corporate">Corporate</option>
                  <option value="modern">Modern</option>
                  <option value="vibrant">Vibrant</option>
                </select>
              </div>

              <div class="form-group form-group-checkbox">
                <input
                  id="template-default"
                  name="isDefault"
                  type="checkbox"
                  defaultChecked={editingTemplate.isDefault}
                />
                <label htmlFor="template-default">Make default for this type</label>
              </div>

              {error && (
                <div class="error-banner">
                  {Icons.warning}
                  <span>{error}</span>
                </div>
              )}

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={() => { setEditingTemplate(null); setError(null) }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={templateSaving}
                >
                  {templateSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Template Confirmation Modal */}
      {showDeleteConfirm && (
        <div class="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Template?</h3>
            <p>
              This will permanently delete this template. This action cannot be undone.
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                class="btn btn-danger"
                onClick={() => handleDeleteTemplate(showDeleteConfirm)}
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Source Wizard Modal */}
      {showAddSource && (
        <div class="modal-overlay" onClick={resetAddSourceWizard}>
          <div class="modal modal-wizard" onClick={(e) => e.stopPropagation()}>
            <div class="wizard-header">
              <h3>Add Data Source</h3>
              <button class="btn btn-icon" onClick={resetAddSourceWizard}>
                {Icons.x}
              </button>
            </div>

            <div class="wizard-steps">
              <div class={`wizard-step-indicator ${addSourceStep >= 1 ? 'active' : ''} ${addSourceStep > 1 ? 'complete' : ''}`} />
              <div class={`wizard-step-indicator ${addSourceStep >= 2 ? 'active' : ''} ${addSourceStep > 2 ? 'complete' : ''}`} />
              <div class={`wizard-step-indicator ${addSourceStep >= 3 ? 'active' : ''}`} />
            </div>

            {/* Step 1: Choose Type */}
            {addSourceStep === 1 && (
              <div class="wizard-content">
                <p class="wizard-subtitle">Choose your data source type</p>

                <div class="type-selector">
                  <button
                    class={`type-option ${addSourceType === 'airtable' ? 'selected' : ''}`}
                    onClick={() => { setAddSourceType('airtable'); setAddSourceStep(2); }}
                  >
                    <div class="type-option-icon">{Icons.airtable}</div>
                    <div class="type-option-label">Airtable</div>
                  </button>

                  <button
                    class={`type-option ${addSourceType === 'rest_api' ? 'selected' : ''}`}
                    onClick={() => { setAddSourceType('rest_api'); setAddSourceStep(2); }}
                  >
                    <div class="type-option-icon">{Icons.api}</div>
                    <div class="type-option-label">REST API</div>
                  </button>

                  <button
                    class={`type-option ${addSourceType === 'webhook' ? 'selected' : ''}`}
                    onClick={() => { setAddSourceType('webhook'); setAddSourceStep(2); }}
                  >
                    <div class="type-option-icon">{Icons.webhook}</div>
                    <div class="type-option-label">Webhook</div>
                  </button>
                </div>

                <div class="type-selector type-selector--coming-soon">
                  <button class="type-option disabled">
                    <div class="type-option-icon">{Icons.database}</div>
                    <div class="type-option-label">Database</div>
                    <div class="type-option-coming">Coming Soon</div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Configure Airtable */}
            {addSourceStep === 2 && addSourceType === 'airtable' && (
              <div class="wizard-content">
                <p class="wizard-subtitle">Configure Airtable connection</p>

                <form class="wizard-form" onSubmit={(e) => { e.preventDefault(); handleCreateSource(); }}>
                  <div class="form-group">
                    <label>Source Name *</label>
                    <input
                      type="text"
                      class="api-input"
                      placeholder="Production Invoices"
                      value={addSourceConfig.name || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, name: (e.target as HTMLInputElement).value})}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Personal Access Token *</label>
                    <input
                      type="password"
                      class="api-input mono"
                      placeholder="pat..."
                      value={addSourceConfig.personal_access_token || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, personal_access_token: (e.target as HTMLInputElement).value})}
                      required
                    />
                    <span class="form-hint">Get from airtable.com/account</span>
                  </div>

                  <div class="form-group">
                    <label>Base ID *</label>
                    <input
                      type="text"
                      class="api-input mono"
                      placeholder="appXXXXXXXXXXXX"
                      value={addSourceConfig.base_id || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, base_id: (e.target as HTMLInputElement).value})}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Table ID *</label>
                    <input
                      type="text"
                      class="api-input mono"
                      placeholder="tblXXXXXXXXXXXX"
                      value={addSourceConfig.table_id || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, table_id: (e.target as HTMLInputElement).value})}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>View ID (optional)</label>
                    <input
                      type="text"
                      class="api-input mono"
                      placeholder="viwXXXXXXXXXXXX"
                      value={addSourceConfig.view_id || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, view_id: (e.target as HTMLInputElement).value})}
                    />
                  </div>

                  {addSourceError && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{addSourceError}</span>
                    </div>
                  )}

                  <div class="wizard-actions">
                    <button type="button" class="btn btn-ghost" onClick={() => { setAddSourceStep(1); setAddSourceType(null); }}>
                      Back
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      disabled={addSourceTesting || !addSourceConfig.name || !addSourceConfig.personal_access_token || !addSourceConfig.base_id || !addSourceConfig.table_id}
                    >
                      {addSourceTesting ? 'Testing...' : 'Test & Connect'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 2: Configure REST API */}
            {addSourceStep === 2 && addSourceType === 'rest_api' && (
              <div class="wizard-content">
                <p class="wizard-subtitle">Configure REST API connection</p>

                <form class="wizard-form" onSubmit={(e) => { e.preventDefault(); handleCreateSource(); }}>
                  <div class="form-group">
                    <label>Source Name *</label>
                    <input
                      type="text"
                      class="api-input"
                      placeholder="CRM Contacts"
                      value={addSourceConfig.name || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, name: (e.target as HTMLInputElement).value})}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Endpoint URL *</label>
                    <input
                      type="url"
                      class="api-input mono"
                      placeholder="https://api.example.com/data"
                      value={addSourceConfig.endpoint || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, endpoint: (e.target as HTMLInputElement).value})}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Authentication</label>
                    <select
                      class="api-input"
                      value={addSourceConfig.auth_type || 'none'}
                      onChange={(e) => setAddSourceConfig({...addSourceConfig, auth_type: (e.target as HTMLSelectElement).value})}
                    >
                      <option value="none">None</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="api_key">API Key</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>

                  {addSourceConfig.auth_type === 'bearer' && (
                    <div class="form-group">
                      <label>Bearer Token *</label>
                      <input
                        type="password"
                        class="api-input mono"
                        placeholder="your-token"
                        value={addSourceConfig.bearer_token || ''}
                        onInput={(e) => setAddSourceConfig({...addSourceConfig, bearer_token: (e.target as HTMLInputElement).value})}
                        required
                      />
                    </div>
                  )}

                  {addSourceConfig.auth_type === 'api_key' && (
                    <>
                      <div class="form-group">
                        <label>Header Name *</label>
                        <input
                          type="text"
                          class="api-input"
                          placeholder="X-API-Key"
                          value={addSourceConfig.api_key_header || ''}
                          onInput={(e) => setAddSourceConfig({...addSourceConfig, api_key_header: (e.target as HTMLInputElement).value})}
                          required
                        />
                      </div>
                      <div class="form-group">
                        <label>API Key *</label>
                        <input
                          type="password"
                          class="api-input mono"
                          placeholder="your-api-key"
                          value={addSourceConfig.api_key_value || ''}
                          onInput={(e) => setAddSourceConfig({...addSourceConfig, api_key_value: (e.target as HTMLInputElement).value})}
                          required
                        />
                      </div>
                    </>
                  )}

                  <div class="form-group">
                    <label>Response Path (optional)</label>
                    <input
                      type="text"
                      class="api-input mono"
                      placeholder="data.records"
                      value={addSourceConfig.response_path || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, response_path: (e.target as HTMLInputElement).value})}
                    />
                    <span class="form-hint">Path to the array of records in the response</span>
                  </div>

                  {addSourceError && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{addSourceError}</span>
                    </div>
                  )}

                  <div class="wizard-actions">
                    <button type="button" class="btn btn-ghost" onClick={() => { setAddSourceStep(1); setAddSourceType(null); }}>
                      Back
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      disabled={addSourceTesting || !addSourceConfig.name || !addSourceConfig.endpoint}
                    >
                      {addSourceTesting ? 'Testing...' : 'Test & Connect'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 2: Configure Webhook */}
            {addSourceStep === 2 && addSourceType === 'webhook' && (
              <div class="wizard-content">
                <p class="wizard-subtitle">Configure Webhook receiver</p>

                <form class="wizard-form" onSubmit={(e) => { e.preventDefault(); handleCreateSource(); }}>
                  <div class="form-group">
                    <label>Source Name *</label>
                    <input
                      type="text"
                      class="api-input"
                      placeholder="Order Events"
                      value={addSourceConfig.name || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, name: (e.target as HTMLInputElement).value})}
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label>Webhook Secret (optional)</label>
                    <input
                      type="password"
                      class="api-input mono"
                      placeholder="whsec_..."
                      value={addSourceConfig.secret || ''}
                      onInput={(e) => setAddSourceConfig({...addSourceConfig, secret: (e.target as HTMLInputElement).value})}
                    />
                    <span class="form-hint">Used to verify incoming webhook signatures</span>
                  </div>

                  {addSourceError && (
                    <div class="error-banner">
                      {Icons.warning}
                      <span>{addSourceError}</span>
                    </div>
                  )}

                  <div class="wizard-actions">
                    <button type="button" class="btn btn-ghost" onClick={() => { setAddSourceStep(1); setAddSourceType(null); }}>
                      Back
                    </button>
                    <button
                      type="submit"
                      class="btn btn-primary"
                      disabled={addSourceTesting || !addSourceConfig.name}
                    >
                      {addSourceTesting ? 'Creating...' : 'Create Webhook'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: Success */}
            {addSourceStep === 3 && (
              <div class="wizard-content wizard-success">
                <div class="success-icon success-icon--large">
                  {Icons.checkCircle}
                </div>
                <h4>Connected Successfully!</h4>

                {addSourceSchema && addSourceSchema.fields && (
                  <div class="schema-preview">
                    <p>Found {addSourceSchema.fields.length} fields{addSourceSchema.record_count ? ` and ${addSourceSchema.record_count} records` : ''}:</p>
                    <div class="schema-fields">
                      {addSourceSchema.fields.slice(0, 5).map((field) => (
                        <div key={field.path} class="schema-field">
                          <span class="field-name">{field.name}</span>
                          <span class="field-type">{field.type}</span>
                        </div>
                      ))}
                      {addSourceSchema.fields.length > 5 && (
                        <div class="schema-more">+{addSourceSchema.fields.length - 5} more fields</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Source Confirmation Modal */}
      {deleteSourceConfirm && (
        <div class="modal-overlay" onClick={() => setDeleteSourceConfirm(null)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Data Source?</h3>
            <p>
              This will permanently delete this data source and all its mappings. This action cannot be undone.
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" onClick={() => setDeleteSourceConfirm(null)}>
                Cancel
              </button>
              <button
                class="btn btn-danger"
                onClick={() => handleDeleteSource(deleteSourceConfirm)}
              >
                Delete Source
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Source Modal */}
      {linkingTemplate && (
        <div class="modal-overlay" onClick={() => setLinkingTemplate(null)}>
          <div class="modal modal-link-source" onClick={(e) => e.stopPropagation()}>
            <h3>Link Data Source</h3>
            <p class="modal-subtitle">Select a source to link to "{linkingTemplate.name}"</p>

            {sources.length === 0 ? (
              <div class="no-sources-message">
                <p>No data sources available.</p>
                <button class="btn btn-primary" onClick={() => { setLinkingTemplate(null); setShowAddSource(true); }}>
                  Add Your First Source
                </button>
              </div>
            ) : (
              <>
                <div class="source-select-list">
                  {sources.map(source => (
                    <button
                      key={source.id}
                      class={`source-select-item ${selectedSourceId === source.id ? 'selected' : ''}`}
                      onClick={() => setSelectedSourceId(source.id)}
                    >
                      <div class="source-select-icon">
                        {source.source_type === 'airtable' && Icons.airtable}
                        {source.source_type === 'rest_api' && Icons.api}
                        {source.source_type === 'webhook' && Icons.webhook}
                        {!['airtable', 'rest_api', 'webhook'].includes(source.source_type) && Icons.database}
                      </div>
                      <div class="source-select-info">
                        <div class="source-select-name">{source.name}</div>
                        <div class="source-select-meta">
                          {source.discovered_schema?.fields?.length || 0} fields
                        </div>
                      </div>
                      {selectedSourceId === source.id && (
                        <div class="source-select-check">{Icons.check}</div>
                      )}
                    </button>
                  ))}
                </div>

                <div class="modal-actions">
                  <button class="btn btn-ghost" onClick={() => setLinkingTemplate(null)}>
                    Cancel
                  </button>
                  <button
                    class="btn btn-primary"
                    disabled={!selectedSourceId}
                    onClick={() => openFieldMapper(linkingTemplate.id, selectedSourceId)}
                  >
                    Configure Mapping
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Field Mapper Modal */}
      {showMapper && (
        <div class="modal-overlay mapper-overlay" onClick={resetMapper}>
          <div class="modal modal-mapper" onClick={(e) => e.stopPropagation()}>
            <div class="mapper-header">
              <h3>Map Fields</h3>
              <div class="mapper-coverage">
                Coverage: <span class="coverage-value">{getMappingCoverage()}%</span>
              </div>
              <button
                class="btn btn-ai"
                onClick={handleSuggestMappings}
                disabled={suggestingMappings}
              >
                {Icons.sparkles}
                {suggestingMappings ? 'Suggesting...' : 'AI Suggest'}
              </button>
              <button class="btn btn-icon" onClick={resetMapper}>
                {Icons.x}
              </button>
            </div>

            <div class="mapper-body">
              {templateFields.length === 0 ? (
                <div class="mapper-empty">
                  <p>No template fields detected.</p>
                  <p class="mapper-empty-hint">Template fields are extracted from {'{{placeholders}}'} in your template.</p>
                </div>
              ) : (
                <div class="mapping-rows">
                  {templateFields.map(field => {
                    const suggestion = suggestions.find(s => s.templateField === field)
                    return (
                      <div key={field} class="mapping-row">
                        <div class="mapping-template-field">
                          <code>{`{{${field}}}`}</code>
                        </div>

                        <div class="mapping-arrow">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </div>

                        <div class="mapping-source-field">
                          <select
                            class="mapping-select"
                            value={currentMapping.fieldMappings[field] || ''}
                            onChange={(e) => updateFieldMapping(field, (e.target as HTMLSelectElement).value)}
                          >
                            <option value="">Select field...</option>
                            {sourceFields.map(sf => (
                              <option key={sf.path} value={sf.path}>
                                {sf.name} ({sf.type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div class="mapping-transform">
                          <select
                            class="transform-select"
                            value={currentMapping.transformations[field]?.type || ''}
                            onChange={(e) => updateTransform(field, (e.target as HTMLSelectElement).value)}
                          >
                            <option value="">No transform</option>
                            <option value="currency">Currency ($)</option>
                            <option value="date">Date</option>
                            <option value="uppercase">UPPERCASE</option>
                            <option value="lowercase">lowercase</option>
                            <option value="number">Number</option>
                          </select>
                        </div>

                        {suggestion && suggestion.confidence > 0 && (
                          <div class="mapping-confidence" title={suggestion.reason}>
                            AI: {Math.round(suggestion.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {mappingError && (
              <div class="error-banner mapper-error">
                {Icons.warning}
                <span>{mappingError}</span>
              </div>
            )}

            <div class="mapper-footer">
              <button class="btn btn-ghost" onClick={resetMapper}>
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={handleSaveMapping}
                disabled={savingMapping || getMappingCoverage() === 0}
              >
                {savingMapping ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate PDF Modal */}
      {showGenerateModal && generateTemplate && generateMapping && (
        <div class="modal-overlay" onClick={resetGenerateModal}>
          <div class="modal modal-generate" onClick={(e) => e.stopPropagation()}>
            <div class="generate-header">
              <h3>Generate PDF</h3>
              <button class="btn btn-icon" onClick={resetGenerateModal}>
                {Icons.x}
              </button>
            </div>

            <div class="generate-info">
              <div class="info-row">
                <span class="info-label">Template:</span>
                <span class="info-value">{generateTemplate.name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Source:</span>
                <span class="info-value">{getSourceName(generateMapping.source_id)}</span>
              </div>
            </div>

            {!generatedPdf && !batchJob && (
              <>
                <div class="generate-tabs">
                  <button
                    class={`generate-tab ${generateMode === 'single' ? 'active' : ''}`}
                    onClick={() => setGenerateMode('single')}
                  >
                    Single Record
                  </button>
                  <button
                    class={`generate-tab ${generateMode === 'batch' ? 'active' : ''}`}
                    onClick={() => setGenerateMode('batch')}
                  >
                    Batch Generate
                  </button>
                </div>

                {generateMode === 'single' ? (
                  <div class="generate-single">
                    <div class="form-group">
                      <label>Select Record</label>
                      {recordsLoading ? (
                        <div class="records-loading">Loading records...</div>
                      ) : records.length === 0 ? (
                        <div class="no-records">No records found in source</div>
                      ) : (
                        <select
                          class="api-input"
                          value={selectedRecordId}
                          onChange={(e) => setSelectedRecordId((e.target as HTMLSelectElement).value)}
                        >
                          <option value="">Choose a record...</option>
                          {records.map(record => (
                            <option key={record.id} value={record.id}>
                              {getRecordLabel(record)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedRecordId && (
                      <div class="record-preview">
                        <h4>Record Data</h4>
                        <pre class="record-json">
                          {JSON.stringify(records.find(r => r.id === selectedRecordId)?.fields || {}, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div class="generate-batch">
                    <div class="form-group">
                      <label>Filter Formula (optional)</label>
                      <input
                        type="text"
                        class="api-input mono"
                        placeholder="Status = 'Ready'"
                        value={batchFilter}
                        onInput={(e) => setBatchFilter((e.target as HTMLInputElement).value)}
                      />
                      <span class="form-hint">Airtable formula syntax for filtering records</span>
                    </div>

                    <div class="form-group">
                      <label>Limit</label>
                      <input
                        type="number"
                        class="api-input"
                        value={batchLimit}
                        onInput={(e) => setBatchLimit(parseInt((e.target as HTMLInputElement).value) || 100)}
                        min={1}
                        max={1000}
                      />
                      <span class="form-hint">Maximum number of PDFs to generate (1-1000)</span>
                    </div>

                    <div class="batch-estimate">
                      Will generate up to <strong>{batchLimit}</strong> PDFs
                    </div>
                  </div>
                )}

                {generateError && (
                  <div class="error-banner">
                    {Icons.warning}
                    <span>{generateError}</span>
                  </div>
                )}

                <div class="generate-actions">
                  <button class="btn btn-ghost" onClick={resetGenerateModal}>
                    Cancel
                  </button>
                  <button
                    class="btn btn-primary"
                    onClick={generateMode === 'single' ? handleGenerateSingle : handleStartBatch}
                    disabled={generating || (generateMode === 'single' && !selectedRecordId)}
                  >
                    {generating ? 'Generating...' : generateMode === 'single' ? 'Generate PDF' : 'Start Batch'}
                  </button>
                </div>
              </>
            )}

            {/* Single PDF Result */}
            {generatedPdf && (
              <div class="generate-result">
                <div class="result-success">
                  <div class="success-icon success-icon--large">
                    {Icons.checkCircle}
                  </div>
                  <h4>PDF Generated!</h4>
                  <p class="result-size">{Math.round(generatedPdf.size / 1024)} KB</p>
                </div>

                <div class="result-actions">
                  <button class="btn btn-primary" onClick={handleDownloadPdf}>
                    Download PDF
                  </button>
                  <button class="btn btn-secondary" onClick={() => { setGeneratedPdf(null); setSelectedRecordId(''); }}>
                    Generate Another
                  </button>
                </div>
              </div>
            )}

            {/* Batch Progress */}
            {batchJob && (
              <div class="batch-progress-container">
                <div class="batch-status">
                  <span class={`status-badge status-badge--${batchJob.status}`}>
                    {batchJob.status}
                  </span>
                </div>

                <div class="batch-progress">
                  <div class="progress-bar-container">
                    <div
                      class="progress-bar-fill"
                      style={{ width: `${(batchJob.progress.completed / batchJob.progress.total) * 100}%` }}
                    />
                  </div>
                  <div class="progress-text">
                    {batchJob.progress.completed} / {batchJob.progress.total}
                    {batchJob.progress.failed > 0 && (
                      <span class="failed-count"> ({batchJob.progress.failed} failed)</span>
                    )}
                  </div>
                </div>

                {batchJob.status === 'completed' && (
                  <div class="batch-complete">
                    <div class="success-icon success-icon--large">
                      {Icons.checkCircle}
                    </div>
                    <p>Batch complete!</p>
                    <button class="btn btn-primary" onClick={handleDownloadBatch}>
                      Download ZIP ({batchJob.progress.completed} PDFs)
                    </button>
                  </div>
                )}

                {batchJob.status === 'failed' && (
                  <div class="batch-error">
                    <div class="error-icon">
                      {Icons.warning}
                    </div>
                    <p>{batchJob.error || 'Batch generation failed'}</p>
                    <button class="btn btn-secondary" onClick={() => setBatchJob(null)}>
                      Try Again
                    </button>
                  </div>
                )}

                {(batchJob.status === 'pending' || batchJob.status === 'processing') && (
                  <div class="batch-running">
                    <p class="running-hint">You can close this modal - the batch will continue in the background.</p>
                    <button class="btn btn-ghost" onClick={resetGenerateModal}>
                      Run in Background
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Magic Preview Modal */}
      {showMagicPreview && (
        <div class="modal-overlay" onClick={resetMagicPreview}>
          <div class="modal modal-magic-preview" onClick={e => e.stopPropagation()}>
            <button class="btn btn-icon modal-close-btn" onClick={resetMagicPreview} disabled={magicAccepting}>
              {Icons.x}
            </button>

            {magicPreviewLoading && !magicSwitchingTemplate ? (
              <div class="magic-loading">
                <div class="spinner spinner-lg" />
                <h3>Analyzing your data...</h3>
                <p>Finding the best template and mapping fields</p>
              </div>
            ) : magicPreviewError ? (
              <div class="magic-error">
                <div class="error-icon">
                  {Icons.warning}
                </div>
                <h3>Couldn't auto-generate preview</h3>
                <p>{magicPreviewError}</p>
                <div class="magic-actions">
                  <button class="btn btn-ghost" onClick={handleMagicEditInPlayground}>
                    Edit in Playground
                  </button>
                  <button class="btn btn-secondary" onClick={resetMagicPreview}>Close</button>
                </div>
              </div>
            ) : magicPreviewData ? (
              <div class="magic-content">
                <div class="magic-header">
                  <div class="magic-header-icon">
                    {magicPreviewData.templateUsed.confidence >= 0.8 ? Icons.checkCircle : Icons.warning}
                  </div>
                  <h2>Here's your document!</h2>

                  {/* Template Switcher - always visible when suggestions exist */}
                  <div class="magic-template-selector">
                    <button
                      class="magic-template-btn"
                      onClick={() => setShowMagicTemplatePicker(!showMagicTemplatePicker)}
                      disabled={magicSwitchingTemplate || magicAccepting}
                    >
                      <span class="template-name">{magicPreviewData.templateUsed.name}</span>
                      <span class={`confidence-pill ${magicPreviewData.templateUsed.confidence >= 0.8 ? 'high' : magicPreviewData.templateUsed.confidence >= 0.5 ? 'medium' : 'low'}`}>
                        {Math.round(magicPreviewData.templateUsed.confidence * 100)}%
                      </span>
                      {magicPreviewData.suggestions && magicPreviewData.suggestions.length > 1 && (
                        <span class="dropdown-arrow">{showMagicTemplatePicker ? Icons.chevronUp : Icons.chevronDown}</span>
                      )}
                    </button>

                    {/* Template alternatives dropdown */}
                    {showMagicTemplatePicker && magicPreviewData.suggestions && magicPreviewData.suggestions.length > 1 && (
                      <div class="magic-template-dropdown">
                        <p class="dropdown-hint">Try a different template:</p>
                        {magicPreviewData.suggestions.map(template => (
                          <button
                            key={template.id}
                            class={`template-option ${template.id === magicPreviewData.templateUsed.id ? 'current' : ''}`}
                            onClick={() => handleMagicTemplateSwitch(template.id)}
                            disabled={magicSwitchingTemplate}
                          >
                            <span class="option-name">{template.name}</span>
                            <span class={`confidence-pill ${template.confidence >= 0.8 ? 'high' : template.confidence >= 0.5 ? 'medium' : 'low'}`}>
                              {Math.round(template.confidence * 100)}%
                            </span>
                            {template.id === magicPreviewData.templateUsed.id && <span class="current-badge">current</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <p class="magic-summary">
                    Matched <strong>{Object.keys(magicPreviewData.mappings.applied).length}</strong> fields
                    ({Math.round(magicPreviewData.mappings.coverage * 100)}% coverage)
                  </p>

                  {magicPreviewData.templateUsed.confidence < 0.7 && (
                    <div class="confidence-warning">
                      <span>Please verify the preview looks correct</span>
                    </div>
                  )}
                </div>

                {/* Preview with loading overlay when switching */}
                <div class={`magic-preview-wrapper ${magicSwitchingTemplate || magicPreviewLoading ? 'loading' : ''}`}>
                  {(magicSwitchingTemplate || magicPreviewLoading) && (
                    <div class="preview-loading-overlay">
                      <div class="spinner" />
                      <span>Updating preview...</span>
                    </div>
                  )}
                  {magicPreviewData.html ? (
                    <div class="magic-preview-frame">
                      <iframe
                        srcDoc={magicPreviewData.html}
                        title="Document Preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  ) : (
                    <div class="magic-no-preview">
                      <p>Preview not available - select a template to generate</p>
                    </div>
                  )}
                </div>

                {/* Interactive unmapped fields */}
                {magicPreviewData.mappings.unmapped.length > 0 && (
                  <div class="unmapped-fields-interactive">
                    <p class="unmapped-header">
                      <strong>Fix {magicPreviewData.mappings.unmapped.length} unmapped field{magicPreviewData.mappings.unmapped.length > 1 ? 's' : ''}:</strong>
                      <span class="optional-hint">(optional)</span>
                    </p>
                    <div class="unmapped-list">
                      {magicPreviewData.mappings.unmapped.slice(0, 8).map(field => {
                        const suggestion = magicPreviewData.mappings.suggestions?.find(s => s.templateField === field)
                        const source = sources.find(s => s.id === magicPreviewData.sourceId)
                        const sourceFieldsList = source?.discovered_schema?.fields || []
                        const isExpanded = magicExpandedField === field

                        return (
                          <div key={field} class={`unmapped-field-card ${isExpanded ? 'expanded' : ''}`}>
                            <button
                              class="field-header"
                              onClick={() => setMagicExpandedField(isExpanded ? null : field)}
                              disabled={magicSwitchingTemplate || magicAccepting}
                            >
                              <span class="field-name">{field}</span>
                              <span class="field-expand">{isExpanded ? Icons.chevronUp : Icons.chevronDown}</span>
                            </button>

                            {isExpanded && (
                              <div class="field-options">
                                {suggestion?.possibleSourceFields && suggestion.possibleSourceFields.length > 0 ? (
                                  <>
                                    <p class="options-hint">Did you mean:</p>
                                    <div class="source-field-chips">
                                      {suggestion.possibleSourceFields.map(sf => (
                                        <button
                                          key={sf}
                                          class="source-chip"
                                          onClick={() => handleMagicMappingFix(field, sf)}
                                          disabled={magicPreviewLoading}
                                        >
                                          {sf}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                ) : sourceFieldsList.length > 0 ? (
                                  <>
                                    <p class="options-hint">Available source fields:</p>
                                    <div class="source-field-chips">
                                      {sourceFieldsList.slice(0, 6).map(sf => (
                                        <button
                                          key={sf.path}
                                          class="source-chip"
                                          onClick={() => handleMagicMappingFix(field, sf.path)}
                                          disabled={magicPreviewLoading}
                                        >
                                          {sf.name}
                                        </button>
                                      ))}
                                      {sourceFieldsList.length > 6 && (
                                        <span class="more-fields-hint">+{sourceFieldsList.length - 6} more</span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <p class="no-suggestions">No similar fields found</p>
                                )}
                                <button
                                  class="skip-field-btn"
                                  onClick={() => setMagicExpandedField(null)}
                                >
                                  Skip this field
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {magicPreviewData.mappings.unmapped.length > 8 && (
                        <p class="more-fields">+{magicPreviewData.mappings.unmapped.length - 8} more fields</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div class="magic-actions">
                  <button
                    class="btn btn-ghost"
                    onClick={handleMagicEditInPlayground}
                    disabled={magicAccepting}
                  >
                    Edit in Playground
                  </button>
                  <button
                    class="btn btn-primary magic-accept-btn"
                    onClick={() => handleMagicAccept(true)}
                    disabled={magicAccepting || magicSwitchingTemplate || !magicPreviewData.sessionId}
                  >
                    {magicAccepting ? (
                      <>
                        <span class="spinner spinner-sm" />
                        Saving...
                      </>
                    ) : (
                      <>
                        {Icons.checkCircle}
                        Make This My Default
                      </>
                    )}
                  </button>
                </div>

                {/* Demo tier hint */}
                {!apiKey.startsWith('gk_') && (
                  <p class="demo-hint">
                    Using demo mode. Sign up for an API key to save templates.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer class="footer">
        <span>Glyph v0.3.0</span>
        <span class="footer-sep">|</span>
        <a href="https://docs.glyph.you">Documentation</a>
        <span class="footer-sep">|</span>
        <button onClick={() => setPage('playground')} class="footer-link">Playground</button>
      </footer>
    </div>
  )
}
