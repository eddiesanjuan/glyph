/**
 * FieldAutocomplete - Magical field suggestion UI for the Glyph SDK
 *
 * Provides IDE-like autocomplete with:
 * - Smart contextual suggestions based on document analysis
 * - Intent detection for "make", "add", "change" prefixes
 * - Organized categories (Quick Actions, Data Fields, AI Suggestions, Recent)
 * - Fuzzy matching for natural typing
 * - Keyboard navigation with smooth animations
 */

// ============================================
// Types
// ============================================

export interface FieldDefinition {
  category: string;
  name: string;
  path: string;
  description: string;
  example?: string;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

export interface AutocompleteSuggestion {
  type: 'field' | 'action' | 'suggestion' | 'recent';
  category: string;
  icon: string;
  label: string;
  description: string;
  value: string;  // What gets inserted/executed
  score: number;  // For ranking
  path?: string;  // For field types
  example?: string;
}

export interface DocumentContext {
  hasLogo: boolean;
  hasQrCode: boolean;
  hasTerms: boolean;
  hasDiscount: boolean;
  hasSignature: boolean;
  hasTax: boolean;
  hasNotes: boolean;
  hasWatermark: boolean;
  hasClientEmail: boolean;
  hasClientPhone: boolean;
  hasClientAddress: boolean;
  hasPaymentInfo: boolean;
  hasThankYouNote: boolean;
  regions: string[];
  fieldCount: number;
  accentColor: string | null;
}

export interface FieldAutocompleteOptions {
  inputElement: HTMLInputElement | HTMLTextAreaElement;
  container: HTMLElement;
  onSelect: (suggestion: AutocompleteSuggestion, composedPrompt: string) => void;
  fields?: FieldDefinition[];
  accentColor?: string;
  getDocumentHtml?: () => string;  // Function to get current document HTML
}

// ============================================
// Default Fields
// ============================================

const DEFAULT_FIELDS: FieldDefinition[] = [
  // Client fields
  { category: 'Client', name: 'Client Name', path: 'client.name', description: 'Client full name', example: 'John Smith', type: 'string' },
  { category: 'Client', name: 'Company', path: 'client.company', description: 'Client company name', example: 'Acme Corporation', type: 'string' },
  { category: 'Client', name: 'Email', path: 'client.email', description: 'Client email address', example: 'john@acme.com', type: 'string' },
  { category: 'Client', name: 'Phone', path: 'client.phone', description: 'Client phone number', example: '(555) 123-4567', type: 'string' },
  { category: 'Client', name: 'Address', path: 'client.address', description: 'Client mailing address', example: '123 Main Street', type: 'string' },

  // Quote Info fields
  { category: 'Quote Info', name: 'Quote Number', path: 'meta.quoteNumber', description: 'Unique quote identifier', example: 'Q-2024-001', type: 'string' },
  { category: 'Quote Info', name: 'Date', path: 'meta.date', description: 'Quote creation date', example: 'January 15, 2024', type: 'date' },
  { category: 'Quote Info', name: 'Valid Until', path: 'meta.validUntil', description: 'Quote expiration date', example: 'February 15, 2024', type: 'date' },
  { category: 'Quote Info', name: 'Notes', path: 'meta.notes', description: 'Additional notes', example: 'Thank you for your business!', type: 'string' },
  { category: 'Quote Info', name: 'Terms', path: 'meta.terms', description: 'Terms and conditions', example: 'Payment due within 30 days', type: 'string' },

  // Branding fields
  { category: 'Company', name: 'Company Name', path: 'branding.companyName', description: 'Your company name', example: 'Design Studio Pro', type: 'string' },
  { category: 'Company', name: 'Logo URL', path: 'branding.logoUrl', description: 'Company logo image URL', example: 'https://...', type: 'string' },
  { category: 'Company', name: 'Company Address', path: 'branding.companyAddress', description: 'Business address', example: '456 Creative Ave', type: 'string' },

  // Totals fields
  { category: 'Totals', name: 'Subtotal', path: 'totals.subtotal', description: 'Sum before adjustments', example: '10,000.00', type: 'number' },
  { category: 'Totals', name: 'Discount', path: 'totals.discount', description: 'Discount amount', example: '500.00', type: 'number' },
  { category: 'Totals', name: 'Discount %', path: 'totals.discountPercent', description: 'Discount percentage', example: '5%', type: 'number' },
  { category: 'Totals', name: 'Tax', path: 'totals.tax', description: 'Tax amount', example: '760.00', type: 'number' },
  { category: 'Totals', name: 'Tax Rate', path: 'totals.taxRate', description: 'Tax percentage', example: '8%', type: 'number' },
  { category: 'Totals', name: 'Total', path: 'totals.total', description: 'Final total', example: '10,260.00', type: 'number' },

  // Line Items (array note)
  { category: 'Line Items', name: 'Description', path: 'lineItems[].description', description: 'Item description', example: 'Website Design', type: 'string' },
  { category: 'Line Items', name: 'Details', path: 'lineItems[].details', description: 'Additional details', example: 'Custom responsive design', type: 'string' },
  { category: 'Line Items', name: 'Quantity', path: 'lineItems[].quantity', description: 'Item quantity', example: '1', type: 'number' },
  { category: 'Line Items', name: 'Unit Price', path: 'lineItems[].unitPrice', description: 'Price per unit', example: '3,500.00', type: 'number' },
  { category: 'Line Items', name: 'Line Total', path: 'lineItems[].total', description: 'Line item total', example: '3,500.00', type: 'number' },

  // Style fields
  { category: 'Styles', name: 'Accent Color', path: 'styles.accentColor', description: 'Primary accent color', example: '#1e3a5f', type: 'string' },
  { category: 'Styles', name: 'Font Family', path: 'styles.fontFamily', description: 'Font family override', example: 'Inter, sans-serif', type: 'string' },
  { category: 'Styles', name: 'Font Size', path: 'styles.fontSize', description: 'Base font size', example: '14px', type: 'string' },
];

// ============================================
// Quick Actions - Common design modifications
// ============================================

const QUICK_ACTIONS: AutocompleteSuggestion[] = [
  {
    type: 'action',
    category: 'Quick Actions',
    icon: 'qr',
    label: 'Add QR code for payment',
    description: 'Easy mobile payment scanning',
    value: 'Add a QR code in the bottom right corner for easy mobile payment',
    score: 95
  },
  {
    type: 'action',
    category: 'Quick Actions',
    icon: 'image',
    label: 'Add company logo',
    description: 'Brand your document',
    value: 'Add the company logo in the header, sized appropriately',
    score: 94
  },
  {
    type: 'action',
    category: 'Quick Actions',
    icon: 'sparkles',
    label: 'Make design more professional',
    description: 'Enhance overall appearance',
    value: 'Make this design look more professional and polished with better typography and spacing',
    score: 93
  },
  {
    type: 'action',
    category: 'Quick Actions',
    icon: 'stamp',
    label: 'Add DRAFT watermark',
    description: 'Mark as work in progress',
    value: 'Add a subtle DRAFT watermark diagonally across the document',
    score: 85
  },
  {
    type: 'action',
    category: 'Quick Actions',
    icon: 'pen',
    label: 'Add signature line',
    description: 'Space for client approval',
    value: 'Add a signature line at the bottom with date field for client approval',
    score: 84
  },
  {
    type: 'action',
    category: 'Quick Actions',
    icon: 'layout',
    label: 'Make layout compact',
    description: 'Reduce whitespace',
    value: 'Make the layout more compact, reducing unnecessary whitespace while keeping it readable',
    score: 80
  }
];

// ============================================
// Intent-based suggestions
// ============================================

const MAKE_SUGGESTIONS: AutocompleteSuggestion[] = [
  { type: 'action', category: 'Make Changes', icon: 'arrow-up', label: 'make header bigger', description: 'Increase header size', value: 'Make the header section bigger and more prominent', score: 90 },
  { type: 'action', category: 'Make Changes', icon: 'dollar', label: 'make totals prominent', description: 'Highlight totals section', value: 'Make the totals section more prominent with larger text and better contrast', score: 89 },
  { type: 'action', category: 'Make Changes', icon: 'compress', label: 'make layout compact', description: 'Reduce whitespace', value: 'Make the layout more compact with tighter spacing', score: 88 },
  { type: 'action', category: 'Make Changes', icon: 'text', label: 'make text larger', description: 'Increase font size', value: 'Make all text slightly larger for better readability', score: 87 },
  { type: 'action', category: 'Make Changes', icon: 'sparkles', label: 'make it look modern', description: 'Contemporary styling', value: 'Make this look more modern with clean lines and contemporary styling', score: 86 },
  { type: 'action', category: 'Make Changes', icon: 'moon', label: 'make it dark mode', description: 'Dark theme', value: 'Make this a dark mode design with light text on dark background', score: 85 },
  { type: 'action', category: 'Make Changes', icon: 'sun', label: 'make colors brighter', description: 'Vivid colors', value: 'Make the accent colors brighter and more vivid', score: 84 },
  { type: 'action', category: 'Make Changes', icon: 'minimize', label: 'make it minimal', description: 'Minimalist design', value: 'Make this design more minimal, removing decorative elements', score: 83 },
];

const ADD_SUGGESTIONS: AutocompleteSuggestion[] = [
  { type: 'action', category: 'Add Elements', icon: 'qr', label: 'add QR code', description: 'Payment QR code', value: 'Add a QR code in the bottom right for mobile payment', score: 95 },
  { type: 'action', category: 'Add Elements', icon: 'image', label: 'add logo', description: 'Company logo', value: 'Add the company logo in the header', score: 94 },
  { type: 'action', category: 'Add Elements', icon: 'stamp', label: 'add watermark', description: 'Background watermark', value: 'Add a subtle watermark to the document', score: 90 },
  { type: 'action', category: 'Add Elements', icon: 'file-text', label: 'add terms', description: 'Payment terms', value: 'Add payment terms section at the bottom: Net 30 days', score: 89 },
  { type: 'action', category: 'Add Elements', icon: 'heart', label: 'add thank you note', description: 'Appreciation message', value: 'Add a thank you note at the bottom of the document', score: 88 },
  { type: 'action', category: 'Add Elements', icon: 'percent', label: 'add discount row', description: 'Discount in totals', value: 'Add a discount row to the totals section', score: 87 },
  { type: 'action', category: 'Add Elements', icon: 'pen', label: 'add signature line', description: 'Approval signature', value: 'Add a signature line for client approval', score: 86 },
  { type: 'action', category: 'Add Elements', icon: 'credit-card', label: 'add payment info', description: 'Bank details', value: 'Add bank account details for wire transfer payments', score: 85 },
  { type: 'action', category: 'Add Elements', icon: 'calendar', label: 'add due date', description: 'Payment due date', value: 'Add a prominent payment due date', score: 84 },
  { type: 'action', category: 'Add Elements', icon: 'border', label: 'add border', description: 'Document border', value: 'Add a subtle border around the document', score: 80 },
];

const CHANGE_SUGGESTIONS: AutocompleteSuggestion[] = [
  { type: 'action', category: 'Change Style', icon: 'palette', label: 'change colors', description: 'Modify color scheme', value: 'Change the accent color to a different shade', score: 90 },
  { type: 'action', category: 'Change Style', icon: 'palette', label: 'change to blue', description: 'Blue color scheme', value: 'Change the accent color to a professional blue (#2563eb)', score: 89 },
  { type: 'action', category: 'Change Style', icon: 'palette', label: 'change to purple', description: 'Purple color scheme', value: 'Change the accent color to a modern purple (#7c3aed)', score: 88 },
  { type: 'action', category: 'Change Style', icon: 'palette', label: 'change to green', description: 'Green color scheme', value: 'Change the accent color to a fresh green (#10b981)', score: 87 },
  { type: 'action', category: 'Change Style', icon: 'type', label: 'change font', description: 'Different typography', value: 'Change the font family to something more modern', score: 86 },
  { type: 'action', category: 'Change Style', icon: 'layout', label: 'change layout', description: 'Different arrangement', value: 'Change the overall layout to be more dynamic', score: 85 },
  { type: 'action', category: 'Change Style', icon: 'columns', label: 'change to two columns', description: 'Multi-column layout', value: 'Change the layout to use two columns for better space usage', score: 84 },
];

// ============================================
// Fuzzy Matching
// ============================================

/**
 * Simple fuzzy match scoring
 * Returns 0-100 score based on how well query matches target
 */
function fuzzyMatch(query: string, target: string): number {
  if (!query) return 50; // Neutral score for empty query

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Starts with query
  if (t.startsWith(q)) return 95;

  // Contains query as word
  if (t.includes(` ${q}`) || t.includes(`${q} `)) return 85;

  // Contains query anywhere
  if (t.includes(q)) return 75;

  // Character-by-character fuzzy match
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let totalMatches = 0;

  for (let i = 0; i < t.length && queryIndex < q.length; i++) {
    if (t[i] === q[queryIndex]) {
      queryIndex++;
      totalMatches++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
  }

  // All query chars found
  if (queryIndex === q.length) {
    // Score based on consecutive matches and total length ratio
    const lengthRatio = q.length / t.length;
    const consecutiveBonus = (maxConsecutive / q.length) * 20;
    return Math.min(70, 40 + (lengthRatio * 20) + consecutiveBonus);
  }

  return 0;
}

/**
 * Special fuzzy shortcuts
 */
const FUZZY_SHORTCUTS: Record<string, string[]> = {
  'ph': ['phone', 'photo'],
  'qr': ['QR code', 'QR'],
  '$': ['total', 'subtotal', 'price', 'amount', 'dollar', 'currency'],
  'em': ['email'],
  'addr': ['address'],
  'comp': ['company', 'compact'],
  'disc': ['discount'],
  'sig': ['signature'],
  'wat': ['watermark'],
  'pro': ['professional'],
  'mod': ['modern'],
  'min': ['minimal', 'minimize'],
  'col': ['color', 'column'],
};

function applyFuzzyShortcuts(query: string): string[] {
  const q = query.toLowerCase();
  const expansions: string[] = [query];

  for (const [shortcut, targets] of Object.entries(FUZZY_SHORTCUTS)) {
    if (q.startsWith(shortcut) || q === shortcut) {
      expansions.push(...targets);
    }
  }

  return expansions;
}

// ============================================
// Document Context Analysis
// ============================================

function analyzeDocument(html: string): DocumentContext {
  const lowerHtml = html.toLowerCase();

  return {
    hasLogo: lowerHtml.includes('logo') || lowerHtml.includes('<img') && lowerHtml.includes('header'),
    hasQrCode: lowerHtml.includes('qr') || lowerHtml.includes('qrcode'),
    hasTerms: lowerHtml.includes('terms') || lowerHtml.includes('payment terms') || lowerHtml.includes('net 30') || lowerHtml.includes('net 15'),
    hasDiscount: lowerHtml.includes('discount') || lowerHtml.includes('savings'),
    hasSignature: lowerHtml.includes('signature') || lowerHtml.includes('sign here') || lowerHtml.includes('authorized'),
    hasTax: lowerHtml.includes('tax') && (lowerHtml.includes('$') || lowerHtml.includes('%')),
    hasNotes: lowerHtml.includes('notes') || lowerHtml.includes('note:'),
    hasWatermark: lowerHtml.includes('watermark') || lowerHtml.includes('draft'),
    hasClientEmail: lowerHtml.includes('email') && lowerHtml.includes('@'),
    hasClientPhone: lowerHtml.includes('phone') || /\(\d{3}\)/.test(html) || /\d{3}-\d{3}-\d{4}/.test(html),
    hasClientAddress: lowerHtml.includes('address') || lowerHtml.includes('street') || /\d+\s+\w+\s+(st|ave|blvd|rd|dr)/i.test(html),
    hasPaymentInfo: lowerHtml.includes('bank') || lowerHtml.includes('routing') || lowerHtml.includes('account'),
    hasThankYouNote: lowerHtml.includes('thank you') || lowerHtml.includes('thanks'),
    regions: extractRegions(html),
    fieldCount: (html.match(/\{\{[^}]+\}\}/g) || []).length,
    accentColor: extractAccentColor(html),
  };
}

function extractRegions(html: string): string[] {
  const regions: string[] = [];
  const lowerHtml = html.toLowerCase();

  if (lowerHtml.includes('header')) regions.push('header');
  if (lowerHtml.includes('footer')) regions.push('footer');
  if (lowerHtml.includes('totals') || lowerHtml.includes('total')) regions.push('totals');
  if (lowerHtml.includes('items') || lowerHtml.includes('line-item')) regions.push('line-items');
  if (lowerHtml.includes('client') || lowerHtml.includes('bill-to')) regions.push('client');

  return regions;
}

function extractAccentColor(html: string): string | null {
  // Try to find accent color in styles
  const colorMatch = html.match(/(?:accent|primary|brand).*?#([0-9a-fA-F]{6})/i) ||
                     html.match(/(?:background|border).*?#([0-9a-fA-F]{6})/i);
  return colorMatch ? `#${colorMatch[1]}` : null;
}

// ============================================
// Recent Actions Storage
// ============================================

const RECENT_ACTIONS_KEY = 'glyph_recent_actions';
const MAX_RECENT_ACTIONS = 5;

interface RecentAction {
  label: string;
  value: string;
  timestamp: number;
}

function getRecentActions(): RecentAction[] {
  try {
    const stored = localStorage.getItem(RECENT_ACTIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // Ignore storage errors
  }
  return [];
}

function saveRecentAction(label: string, value: string): void {
  try {
    const recent = getRecentActions();

    // Remove if already exists
    const filtered = recent.filter(a => a.value !== value);

    // Add to front
    filtered.unshift({ label, value, timestamp: Date.now() });

    // Keep only last N
    const trimmed = filtered.slice(0, MAX_RECENT_ACTIONS);

    localStorage.setItem(RECENT_ACTIONS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // Ignore storage errors
  }
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// ============================================
// Main Autocomplete Class
// ============================================

export class FieldAutocomplete {
  private input: HTMLInputElement | HTMLTextAreaElement;
  private container: HTMLElement;
  private dropdown: HTMLElement | null = null;
  private fields: FieldDefinition[];
  private suggestions: AutocompleteSuggestion[] = [];
  private selectedIndex: number = -1;
  private isVisible: boolean = false;
  private onSelect: (suggestion: AutocompleteSuggestion, composedPrompt: string) => void;
  private getDocumentHtml: () => string;

  // Category icons for visual polish
  private categoryIcons: Record<string, string> = {
    'Quick Actions': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'Recent': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'Suggestions': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    'Data Fields': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    'Add Elements': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    'Make Changes': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    'Change Style': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="13.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    'Client': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'Quote Info': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'Company': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'Totals': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'Line Items': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    'Styles': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  // Suggestion type icons
  private suggestionIcons: Record<string, string> = {
    'qr': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>',
    'image': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    'sparkles': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L14.5 8.5L20 9L15.5 13L17 19L12 16L7 19L8.5 13L4 9L9.5 8.5L12 3Z"/></svg>',
    'stamp': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 22h14"/><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z"/><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/></svg>',
    'pen': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    'layout': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    'arrow-up': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    'dollar': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'compress': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    'text': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    'moon': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    'sun': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    'minimize': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    'file-text': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    'heart': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    'percent': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    'credit-card': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    'calendar': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'border': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',
    'palette': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="13.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    'type': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    'columns': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
    'clock': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'lightbulb': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
    'field': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    'number': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>',
    'date': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  };

  constructor(options: FieldAutocompleteOptions) {
    this.input = options.inputElement;
    this.container = options.container;
    this.onSelect = options.onSelect;
    this.fields = options.fields || DEFAULT_FIELDS;
    this.getDocumentHtml = options.getDocumentHtml || (() => '');

    this.init();
  }

  private init() {
    this.createDropdown();
    this.attachEventListeners();
  }

  private createDropdown() {
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'glyph-autocomplete-dropdown';
    this.dropdown.setAttribute('role', 'listbox');
    this.dropdown.setAttribute('aria-label', 'Suggestions');
    this.dropdown.style.display = 'none';
    this.container.appendChild(this.dropdown);
  }

  private attachEventListeners() {
    this.input.addEventListener('input', this.handleInput.bind(this));
    this.input.addEventListener('keydown', this.handleKeydown.bind(this) as EventListener);
    this.input.addEventListener('blur', this.handleBlur.bind(this));
    this.input.addEventListener('focus', this.handleFocus.bind(this));

    this.dropdown?.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
  }

  private handleFocus() {
    // Show suggestions immediately on focus for magical experience
    this.generateSuggestions(this.input.value);
  }

  private handleBlur() {
    setTimeout(() => {
      this.hide();
    }, 150);
  }

  private handleInput() {
    this.generateSuggestions(this.input.value);
  }

  private generateSuggestions(inputValue: string) {
    const cursorPosition = (this.input as HTMLInputElement).selectionStart || inputValue.length;
    const textBeforeCursor = inputValue.substring(0, cursorPosition).trim();

    const suggestions: AutocompleteSuggestion[] = [];
    const documentHtml = this.getDocumentHtml();
    const context = analyzeDocument(documentHtml);

    // Detect intent based on prefix
    const lowerInput = textBeforeCursor.toLowerCase();
    const isMakeIntent = lowerInput.startsWith('make ');
    const isAddIntent = lowerInput.startsWith('add ');
    const isChangeIntent = lowerInput.startsWith('change ');
    const isMustacheIntent = textBeforeCursor.endsWith('{{');

    // Extract search term after intent prefix
    let searchTerm = textBeforeCursor;
    if (isMakeIntent) searchTerm = textBeforeCursor.slice(5);
    else if (isAddIntent) searchTerm = textBeforeCursor.slice(4);
    else if (isChangeIntent) searchTerm = textBeforeCursor.slice(7);
    else if (isMustacheIntent) searchTerm = '';

    // 1. Add recent actions (highest priority when no input)
    if (!textBeforeCursor || textBeforeCursor.length < 3) {
      const recentActions = getRecentActions();
      for (const action of recentActions) {
        suggestions.push({
          type: 'recent',
          category: 'Recent',
          icon: 'clock',
          label: action.label,
          description: formatTimeAgo(action.timestamp),
          value: action.value,
          score: 100 - suggestions.length, // Recent first
        });
      }
    }

    // 2. Add contextual AI suggestions (based on what's missing)
    if (!textBeforeCursor || isAddIntent) {
      const contextualSuggestions = this.getContextualSuggestions(context);
      suggestions.push(...contextualSuggestions);
    }

    // 3. Add intent-specific suggestions
    if (isMakeIntent) {
      suggestions.push(...this.filterSuggestionsByQuery(MAKE_SUGGESTIONS, searchTerm));
    } else if (isAddIntent) {
      suggestions.push(...this.filterSuggestionsByQuery(ADD_SUGGESTIONS, searchTerm));
    } else if (isChangeIntent) {
      suggestions.push(...this.filterSuggestionsByQuery(CHANGE_SUGGESTIONS, searchTerm));
    }

    // 4. Add quick actions (when no specific intent)
    if (!isMakeIntent && !isChangeIntent && !isMustacheIntent) {
      const filteredQuickActions = this.filterSuggestionsByQuery(QUICK_ACTIONS, searchTerm);
      suggestions.push(...filteredQuickActions);
    }

    // 5. Add data fields (especially for mustache intent)
    const fieldSuggestions = this.getFieldSuggestions(searchTerm, isMustacheIntent);
    suggestions.push(...fieldSuggestions);

    // Remove duplicates and sort by score
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    uniqueSuggestions.sort((a, b) => b.score - a.score);

    // Limit to reasonable number
    this.suggestions = uniqueSuggestions.slice(0, 15);

    if (this.suggestions.length > 0) {
      this.selectedIndex = 0;
      this.renderDropdown();
      this.show();
    } else {
      this.hide();
    }
  }

  private getContextualSuggestions(context: DocumentContext): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = [];

    if (!context.hasQrCode) {
      suggestions.push({
        type: 'suggestion',
        category: 'Suggestions',
        icon: 'lightbulb',
        label: 'Add QR code for payment',
        description: 'Make it easy for clients to pay',
        value: 'Add a QR code in the bottom right for easy mobile payment',
        score: 92
      });
    }

    if (!context.hasLogo) {
      suggestions.push({
        type: 'suggestion',
        category: 'Suggestions',
        icon: 'lightbulb',
        label: 'Add company logo',
        description: 'Brand your document professionally',
        value: 'Add the company logo in the header, sized appropriately',
        score: 91
      });
    }

    if (!context.hasTerms) {
      suggestions.push({
        type: 'suggestion',
        category: 'Suggestions',
        icon: 'lightbulb',
        label: 'Add payment terms - Net 30?',
        description: 'Your invoice has no payment terms',
        value: 'Add payment terms at the bottom: Net 30 days',
        score: 88
      });
    }

    if (!context.hasDiscount && context.hasTax) {
      suggestions.push({
        type: 'suggestion',
        category: 'Suggestions',
        icon: 'lightbulb',
        label: 'Consider adding a discount',
        description: 'Incentivize early payment',
        value: 'Add an early payment discount row: 2% off if paid within 10 days',
        score: 82
      });
    }

    if (!context.hasThankYouNote) {
      suggestions.push({
        type: 'suggestion',
        category: 'Suggestions',
        icon: 'lightbulb',
        label: 'Add a thank you note',
        description: 'Personal touch builds relationships',
        value: 'Add a thank you note at the bottom: "Thank you for your business!"',
        score: 80
      });
    }

    if (!context.hasSignature) {
      suggestions.push({
        type: 'suggestion',
        category: 'Suggestions',
        icon: 'lightbulb',
        label: 'Add signature line',
        description: 'For client approval',
        value: 'Add a signature line with date for client approval',
        score: 78
      });
    }

    return suggestions;
  }

  private filterSuggestionsByQuery(suggestions: AutocompleteSuggestion[], query: string): AutocompleteSuggestion[] {
    if (!query) return suggestions;

    const queryExpansions = applyFuzzyShortcuts(query);

    return suggestions
      .map(s => {
        // Get best match score across query expansions
        let bestScore = 0;
        for (const q of queryExpansions) {
          const labelScore = fuzzyMatch(q, s.label);
          const descScore = fuzzyMatch(q, s.description) * 0.7;
          bestScore = Math.max(bestScore, labelScore, descScore);
        }

        return { ...s, score: bestScore > 0 ? s.score * (bestScore / 100) : 0 };
      })
      .filter(s => s.score > 20);
  }

  private getFieldSuggestions(query: string, prioritize: boolean): AutocompleteSuggestion[] {
    const queryExpansions = applyFuzzyShortcuts(query);

    return this.fields
      .map(field => {
        let bestScore = 0;
        for (const q of queryExpansions) {
          const nameScore = fuzzyMatch(q, field.name);
          const pathScore = fuzzyMatch(q, field.path) * 0.9;
          const categoryScore = fuzzyMatch(q, field.category) * 0.6;
          bestScore = Math.max(bestScore, nameScore, pathScore, categoryScore);
        }

        // Boost score if prioritizing fields (mustache intent)
        const baseScore = prioritize ? 85 : 60;
        const finalScore = query ? baseScore * (bestScore / 100) : baseScore;

        return {
          type: 'field' as const,
          category: 'Data Fields',
          icon: this.getFieldIcon(field.type),
          label: field.name,
          description: `{{${field.path}}}`,
          value: `{{${field.path}}}`,
          path: field.path,
          example: field.example,
          score: finalScore
        };
      })
      .filter(s => !query || s.score > 15);
  }

  private getFieldIcon(type?: string): string {
    switch (type) {
      case 'number': return 'number';
      case 'date': return 'date';
      case 'boolean': return 'field';
      default: return 'field';
    }
  }

  private deduplicateSuggestions(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    const seen = new Map<string, AutocompleteSuggestion>();

    for (const s of suggestions) {
      const key = s.value.toLowerCase();
      const existing = seen.get(key);

      if (!existing || s.score > existing.score) {
        seen.set(key, s);
      }
    }

    return Array.from(seen.values());
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.isVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.moveSelection(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveSelection(-1);
        break;
      case 'Enter':
        if (this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
          e.preventDefault();
          this.selectSuggestion(this.suggestions[this.selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
      case 'Tab':
        if (this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
          e.preventDefault();
          this.selectSuggestion(this.suggestions[this.selectedIndex]);
        } else {
          this.hide();
        }
        break;
    }
  }

  private moveSelection(direction: number) {
    const maxIndex = this.suggestions.length - 1;
    let newIndex = this.selectedIndex + direction;

    if (newIndex < 0) newIndex = maxIndex;
    if (newIndex > maxIndex) newIndex = 0;

    this.selectedIndex = newIndex;
    this.updateSelectionUI();
    this.scrollToSelected();
  }

  private updateSelectionUI() {
    if (!this.dropdown) return;

    const items = this.dropdown.querySelectorAll('.glyph-autocomplete-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
      item.setAttribute('aria-selected', index === this.selectedIndex ? 'true' : 'false');
    });
  }

  private scrollToSelected() {
    if (!this.dropdown) return;

    const selectedItem = this.dropdown.querySelector('.glyph-autocomplete-item.selected') as HTMLElement;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private show() {
    if (this.dropdown) {
      this.dropdown.style.display = 'block';
      this.isVisible = true;
      this.positionDropdown();
    }
  }

  private hide() {
    if (this.dropdown) {
      this.dropdown.style.display = 'none';
      this.isVisible = false;
      this.selectedIndex = -1;
    }
  }

  private positionDropdown() {
    if (!this.dropdown) return;

    const inputRect = this.input.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const top = inputRect.bottom - containerRect.top + 4;
    const left = inputRect.left - containerRect.left;

    this.dropdown.style.position = 'absolute';
    this.dropdown.style.top = `${top}px`;
    this.dropdown.style.left = `${left}px`;
    this.dropdown.style.width = `${Math.min(inputRect.width, 480)}px`;
    this.dropdown.style.maxWidth = '480px';
    this.dropdown.style.zIndex = '1000';
  }

  private renderDropdown() {
    if (!this.dropdown) return;

    // Group suggestions by category
    const grouped = this.groupByCategory(this.suggestions);

    let html = '';
    let globalIndex = 0;

    // Render in specific order: Recent, Suggestions, Quick Actions, Intent categories, Data Fields
    const categoryOrder = ['Recent', 'Suggestions', 'Quick Actions', 'Make Changes', 'Add Elements', 'Change Style', 'Data Fields'];

    for (const category of categoryOrder) {
      const items = grouped[category];
      if (!items || items.length === 0) continue;

      const icon = this.categoryIcons[category] || '';
      const categoryClass = this.getCategoryClass(category);

      html += `
        <div class="glyph-autocomplete-category ${categoryClass}">
          <span class="glyph-autocomplete-category-icon">${icon}</span>
          <span class="glyph-autocomplete-category-text">${this.escapeHtml(category)}</span>
        </div>
      `;

      for (const suggestion of items) {
        const isSelected = globalIndex === this.selectedIndex;
        const suggestionIcon = this.suggestionIcons[suggestion.icon] || this.suggestionIcons['field'];
        const typeClass = `glyph-autocomplete-item--${suggestion.type}`;

        html += `
          <div class="glyph-autocomplete-item ${typeClass} ${isSelected ? 'selected' : ''}"
               role="option"
               aria-selected="${isSelected}"
               data-index="${globalIndex}">
            <div class="glyph-autocomplete-item-main">
              <span class="glyph-autocomplete-item-icon">${suggestionIcon}</span>
              <div class="glyph-autocomplete-item-content">
                <span class="glyph-autocomplete-item-name">${this.escapeHtml(suggestion.label)}</span>
                <span class="glyph-autocomplete-item-description">${this.escapeHtml(suggestion.description)}</span>
              </div>
            </div>
            ${suggestion.example ? `<span class="glyph-autocomplete-item-example">${this.escapeHtml(suggestion.example)}</span>` : ''}
          </div>
        `;
        globalIndex++;
      }
    }

    // Handle any remaining categories not in the order
    for (const [category, items] of Object.entries(grouped)) {
      if (categoryOrder.includes(category)) continue;

      const icon = this.categoryIcons[category] || '';

      html += `
        <div class="glyph-autocomplete-category">
          <span class="glyph-autocomplete-category-icon">${icon}</span>
          <span class="glyph-autocomplete-category-text">${this.escapeHtml(category)}</span>
        </div>
      `;

      for (const suggestion of items) {
        const isSelected = globalIndex === this.selectedIndex;
        const suggestionIcon = this.suggestionIcons[suggestion.icon] || this.suggestionIcons['field'];

        html += `
          <div class="glyph-autocomplete-item ${isSelected ? 'selected' : ''}"
               role="option"
               aria-selected="${isSelected}"
               data-index="${globalIndex}">
            <div class="glyph-autocomplete-item-main">
              <span class="glyph-autocomplete-item-icon">${suggestionIcon}</span>
              <div class="glyph-autocomplete-item-content">
                <span class="glyph-autocomplete-item-name">${this.escapeHtml(suggestion.label)}</span>
                <span class="glyph-autocomplete-item-description">${this.escapeHtml(suggestion.description)}</span>
              </div>
            </div>
            ${suggestion.example ? `<span class="glyph-autocomplete-item-example">${this.escapeHtml(suggestion.example)}</span>` : ''}
          </div>
        `;
        globalIndex++;
      }
    }

    // Keyboard hint
    html += `
      <div class="glyph-autocomplete-hint">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    `;

    this.dropdown.innerHTML = html;

    // Add click handlers
    const items = this.dropdown.querySelectorAll('.glyph-autocomplete-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index') || '0', 10);
        const suggestion = this.suggestions[index];
        if (suggestion) {
          this.selectSuggestion(suggestion);
        }
      });

      item.addEventListener('mouseenter', () => {
        const index = parseInt(item.getAttribute('data-index') || '0', 10);
        this.selectedIndex = index;
        this.updateSelectionUI();
      });
    });
  }

  private getCategoryClass(category: string): string {
    switch (category) {
      case 'Recent': return 'glyph-autocomplete-category--recent';
      case 'Suggestions': return 'glyph-autocomplete-category--suggestions';
      case 'Quick Actions': return 'glyph-autocomplete-category--quick';
      case 'Data Fields': return 'glyph-autocomplete-category--fields';
      default: return '';
    }
  }

  private groupByCategory(suggestions: AutocompleteSuggestion[]): Record<string, AutocompleteSuggestion[]> {
    return suggestions.reduce((acc, s) => {
      if (!acc[s.category]) {
        acc[s.category] = [];
      }
      acc[s.category].push(s);
      return acc;
    }, {} as Record<string, AutocompleteSuggestion[]>);
  }

  private selectSuggestion(suggestion: AutocompleteSuggestion) {
    // Save to recent actions
    saveRecentAction(suggestion.label, suggestion.value);

    // Compose the prompt based on suggestion type
    let composedPrompt = suggestion.value;

    // For field types, create a smart prompt
    if (suggestion.type === 'field' && suggestion.path) {
      const currentValue = this.input.value;

      if (currentValue.endsWith('{{')) {
        // Complete the mustache syntax
        composedPrompt = currentValue.slice(0, -2) + `{{${suggestion.path}}}`;
      } else if (currentValue.toLowerCase().startsWith('add ')) {
        // Replace "add " prefix with smart field prompt
        const contextMap: Record<string, string> = {
          'client.email': 'Add {{client.email}} below the client name',
          'client.phone': 'Add {{client.phone}} next to the client contact info',
          'client.address': 'Add {{client.address}} in the client section',
          'meta.notes': 'Add {{meta.notes}} at the bottom of the document',
          'meta.terms': 'Add {{meta.terms}} in the footer section',
          'branding.logoUrl': 'Add the company logo {{branding.logoUrl}} in the header',
          'totals.discount': 'Add a discount row showing {{totals.discount}} in the totals section',
          'totals.tax': 'Add the tax amount {{totals.tax}} to the totals',
        };
        composedPrompt = contextMap[suggestion.path] || `Add {{${suggestion.path}}} to the document`;
      } else {
        composedPrompt = `Add {{${suggestion.path}}} to the document`;
      }
    }

    this.hide();
    this.onSelect(suggestion, composedPrompt);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update the list of available fields
   */
  public setFields(fields: FieldDefinition[]) {
    this.fields = fields;
  }

  /**
   * Set the function to get current document HTML
   */
  public setDocumentHtmlGetter(getter: () => string) {
    this.getDocumentHtml = getter;
  }

  /**
   * Parse fields from a JSON schema
   */
  public static parseSchemaFields(schema: Record<string, unknown>): FieldDefinition[] {
    const fields: FieldDefinition[] = [];

    function extractFields(obj: Record<string, unknown>, prefix: string = '', category: string = 'Fields') {
      if (!obj || typeof obj !== 'object') return;

      const properties = obj.properties as Record<string, unknown> | undefined;
      if (!properties) return;

      for (const [key, value] of Object.entries(properties)) {
        const propValue = value as Record<string, unknown>;
        const path = prefix ? `${prefix}.${key}` : key;
        const type = propValue.type as string;
        const description = (propValue.description as string) || '';
        const examples = propValue.examples as unknown[];

        if (type === 'object') {
          const nestedCategory = key.charAt(0).toUpperCase() + key.slice(1);
          extractFields(propValue, path, nestedCategory);
        } else if (type === 'array' && propValue.items) {
          const items = propValue.items as Record<string, unknown>;
          if (items.properties) {
            const itemCategory = key.charAt(0).toUpperCase() + key.slice(1);
            for (const [itemKey, itemValue] of Object.entries(items.properties as Record<string, unknown>)) {
              const itemProp = itemValue as Record<string, unknown>;
              fields.push({
                category: itemCategory,
                name: itemKey.charAt(0).toUpperCase() + itemKey.slice(1).replace(/([A-Z])/g, ' $1'),
                path: `${path}[].${itemKey}`,
                description: (itemProp.description as string) || '',
                example: (itemProp.examples as unknown[])?.[0]?.toString() || undefined,
                type: (itemProp.type as 'string' | 'number') || 'string',
              });
            }
          }
        } else {
          fields.push({
            category,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            path,
            description,
            example: examples?.[0]?.toString() || undefined,
            type: type as 'string' | 'number' | 'date' | 'boolean',
          });
        }
      }
    }

    extractFields(schema);
    return fields;
  }

  /**
   * Clean up event listeners
   */
  public destroy() {
    if (this.dropdown) {
      this.dropdown.remove();
    }
  }
}

/**
 * CSS styles for the enhanced autocomplete dropdown
 * These should be injected into the Shadow DOM
 */
export const autocompleteStyles = `
  .glyph-autocomplete-dropdown {
    position: absolute;
    background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 12px 40px -8px rgba(0, 0, 0, 0.15),
                0 4px 12px -4px rgba(0, 0, 0, 0.1);
    max-height: 420px;
    overflow-y: auto;
    overflow-x: hidden;
    animation: glyph-autocomplete-appear 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    scrollbar-width: thin;
    scrollbar-color: #d1d5db transparent;
  }

  .glyph-autocomplete-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .glyph-autocomplete-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .glyph-autocomplete-dropdown::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  @keyframes glyph-autocomplete-appear {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .glyph-autocomplete-category {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  /* Category color variants */
  .glyph-autocomplete-category--recent .glyph-autocomplete-category-icon {
    color: #8b5cf6;
  }

  .glyph-autocomplete-category--suggestions .glyph-autocomplete-category-icon {
    color: #f59e0b;
  }

  .glyph-autocomplete-category--quick .glyph-autocomplete-category-icon {
    color: #14B8A6;
  }

  .glyph-autocomplete-category--fields .glyph-autocomplete-category-icon {
    color: #3b82f6;
  }

  .glyph-autocomplete-category-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #14B8A6;
    opacity: 0.9;
  }

  .glyph-autocomplete-category-text {
    flex: 1;
  }

  .glyph-autocomplete-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    cursor: pointer;
    transition: background-color 0.1s ease, transform 0.1s ease;
    border-bottom: 1px solid #f3f4f6;
  }

  .glyph-autocomplete-item:last-of-type {
    border-bottom: none;
  }

  .glyph-autocomplete-item:hover,
  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.04) 100%);
  }

  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.12) 0%, rgba(20, 184, 166, 0.06) 100%);
  }

  /* Type-specific styling */
  .glyph-autocomplete-item--recent .glyph-autocomplete-item-icon {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }

  .glyph-autocomplete-item--recent.selected .glyph-autocomplete-item-icon {
    background: #8b5cf6;
    color: white;
  }

  .glyph-autocomplete-item--suggestion .glyph-autocomplete-item-icon {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .glyph-autocomplete-item--suggestion.selected .glyph-autocomplete-item-icon {
    background: #f59e0b;
    color: white;
  }

  .glyph-autocomplete-item--action .glyph-autocomplete-item-icon {
    background: rgba(20, 184, 166, 0.1);
    color: #14B8A6;
  }

  .glyph-autocomplete-item--action.selected .glyph-autocomplete-item-icon {
    background: #14B8A6;
    color: white;
  }

  .glyph-autocomplete-item--field .glyph-autocomplete-item-icon {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .glyph-autocomplete-item--field.selected .glyph-autocomplete-item-icon {
    background: #3b82f6;
    color: white;
  }

  .glyph-autocomplete-item-main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .glyph-autocomplete-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(20, 184, 166, 0.1);
    border-radius: 6px;
    color: #14B8A6;
    flex-shrink: 0;
  }

  .glyph-autocomplete-item.selected .glyph-autocomplete-item-icon {
    background: #14B8A6;
    color: white;
  }

  .glyph-autocomplete-item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .glyph-autocomplete-item-name {
    font-size: 13px;
    font-weight: 500;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glyph-autocomplete-item-description {
    font-size: 11px;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glyph-autocomplete-item--field .glyph-autocomplete-item-description {
    font-family: ui-monospace, 'SF Mono', 'Fira Code', monospace;
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    padding: 1px 4px;
    border-radius: 3px;
    display: inline-block;
    max-width: fit-content;
  }

  .glyph-autocomplete-item-example {
    font-size: 12px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    text-align: right;
    flex-shrink: 0;
    font-style: italic;
  }

  /* Keyboard hint at bottom */
  .glyph-autocomplete-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px 14px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    font-size: 11px;
    color: #9ca3af;
    border-radius: 0 0 12px 12px;
  }

  .glyph-autocomplete-hint kbd {
    background: #e5e7eb;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 500;
  }

  /* Dark theme support */
  @media (prefers-color-scheme: dark) {
    .glyph-autocomplete-dropdown {
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
      border-color: #374151;
    }

    .glyph-autocomplete-category {
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
      border-color: #374151;
      color: #9ca3af;
    }

    .glyph-autocomplete-item {
      border-color: #1f2937;
    }

    .glyph-autocomplete-item:hover,
    .glyph-autocomplete-item.selected {
      background: linear-gradient(90deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.08) 100%);
    }

    .glyph-autocomplete-item-name {
      color: #f3f4f6;
    }

    .glyph-autocomplete-item-description {
      color: #9ca3af;
    }

    .glyph-autocomplete-item--field .glyph-autocomplete-item-description {
      background: rgba(59, 130, 246, 0.2);
    }

    .glyph-autocomplete-item-example {
      color: #6b7280;
    }

    .glyph-autocomplete-hint {
      background: #111827;
      border-color: #374151;
    }

    .glyph-autocomplete-hint kbd {
      background: #374151;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .glyph-autocomplete-dropdown {
      animation: none;
    }
  }
`;
