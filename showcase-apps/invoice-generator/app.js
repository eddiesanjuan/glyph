/**
 * Invoice Generator - Glyph Showcase App
 * Demonstrates Glyph's PDF customization capabilities
 */

// ============================================
// Configuration
// ============================================
const GLYPH_CONFIG = {
  apiUrl: 'https://api.glyph.you',
  apiKey: 'gk_demo_playground_2024',
  template: 'quote-modern'
};

// ============================================
// State Management
// ============================================
let state = {
  sessionId: null,
  currentHtml: '',
  isLoading: false,
  invoice: {
    number: 'INV-2026-0042',
    date: formatDate(new Date()),
    dueDate: formatDate(addDays(new Date(), 30))
  },
  company: {
    name: 'Acme Web Studio',
    address: '123 Main Street\nSan Francisco, CA 94102',
    email: 'billing@acmewebstudio.com',
    phone: '(415) 555-0123'
  },
  client: {
    name: '',
    company: '',
    email: '',
    address: ''
  },
  lineItems: [
    { id: 1, description: '', quantity: 1, unitPrice: 0 }
  ],
  taxRate: 9,
  notes: 'Thank you for your business!'
};

let nextLineItemId = 2;

// ============================================
// DOM Elements
// ============================================
const elements = {
  // Form fields
  invoiceNumber: document.getElementById('invoice-number'),
  invoiceDate: document.getElementById('invoice-date'),
  invoiceDueDate: document.getElementById('invoice-due-date'),
  companyName: document.getElementById('company-name'),
  companyAddress: document.getElementById('company-address'),
  companyEmail: document.getElementById('company-email'),
  companyPhone: document.getElementById('company-phone'),
  clientName: document.getElementById('client-name'),
  clientCompany: document.getElementById('client-company'),
  clientEmail: document.getElementById('client-email'),
  clientAddress: document.getElementById('client-address'),
  lineItemsBody: document.getElementById('line-items-body'),
  addLineItemBtn: document.getElementById('add-line-item'),
  taxRateInput: document.getElementById('tax-rate'),
  notesInput: document.getElementById('notes'),

  // Totals
  subtotalDisplay: document.getElementById('subtotal'),
  taxDisplay: document.getElementById('tax-amount'),
  totalDisplay: document.getElementById('total'),

  // Preview
  previewFrame: document.getElementById('preview-frame'),
  previewLoading: document.getElementById('preview-loading'),
  previewEmpty: document.getElementById('preview-empty'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),

  // Controls
  generateBtn: document.getElementById('generate-btn'),
  downloadBtn: document.getElementById('download-btn'),
  undoBtn: document.getElementById('undo-btn'),
  promptInput: document.getElementById('prompt-input'),
  applyBtn: document.getElementById('apply-btn'),
  quickActions: document.querySelectorAll('.quick-action'),

  // Toast container
  toastContainer: document.getElementById('toast-container')
};

// ============================================
// Utility Functions
// ============================================
function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `
    <div class="toast__icon">${icons[type] || icons.info}</div>
    <span class="toast__message">${message}</span>
    <button class="toast__close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  toast.querySelector('.toast__close').addEventListener('click', () => {
    toast.remove();
  });

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// Status Management
// ============================================
function setStatus(status, type = 'normal') {
  elements.statusText.textContent = status;
  elements.statusDot.className = 'preview-controls__status-dot';

  if (type === 'loading') {
    elements.statusDot.classList.add('preview-controls__status-dot--loading');
  } else if (type === 'error') {
    elements.statusDot.classList.add('preview-controls__status-dot--error');
  }
}

function setLoading(loading) {
  state.isLoading = loading;

  if (loading) {
    elements.previewLoading.classList.add('visible');
    elements.generateBtn.disabled = true;
    elements.applyBtn.disabled = true;
    elements.downloadBtn.disabled = true;
    elements.quickActions.forEach(btn => btn.disabled = true);
  } else {
    elements.previewLoading.classList.remove('visible');
    elements.generateBtn.disabled = false;
    elements.applyBtn.disabled = false;
    elements.downloadBtn.disabled = !state.sessionId;
    elements.quickActions.forEach(btn => btn.disabled = false);
  }
}

// ============================================
// Form Data Management
// ============================================
function collectFormData() {
  const totals = calculateTotals();

  return {
    branding: {
      companyName: elements.companyName.value || state.company.name,
      companyAddress: elements.companyAddress.value || state.company.address,
      logoUrl: ''
    },
    meta: {
      quoteNumber: elements.invoiceNumber.value || state.invoice.number,
      date: elements.invoiceDate.value || state.invoice.date,
      validUntil: elements.invoiceDueDate.value || state.invoice.dueDate,
      notes: elements.notesInput.value || state.notes,
      terms: 'Terms: Net 30 days. All prices in USD.'
    },
    client: {
      name: elements.clientName.value || elements.clientCompany.value || 'Client',
      company: elements.clientCompany.value || undefined,
      email: elements.clientEmail.value || undefined,
      address: elements.clientAddress.value || undefined
    },
    lineItems: state.lineItems.map(item => ({
      description: item.description || 'Service Item',
      details: '',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      total: (item.quantity || 1) * (item.unitPrice || 0)
    })),
    totals: {
      subtotal: parseFloat(totals.subtotal),
      tax: parseFloat(totals.tax),
      total: parseFloat(totals.total)
    }
  };
}

function calculateTotals() {
  const subtotal = state.lineItems.reduce((sum, item) => {
    return sum + ((item.quantity || 0) * (item.unitPrice || 0));
  }, 0);

  const taxRate = parseFloat(elements.taxRateInput.value) || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  return {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    taxRate: taxRate,
    total: total.toFixed(2)
  };
}

function updateTotalsDisplay() {
  const totals = calculateTotals();
  elements.subtotalDisplay.textContent = formatCurrency(parseFloat(totals.subtotal));
  elements.taxDisplay.textContent = formatCurrency(parseFloat(totals.tax));
  elements.totalDisplay.textContent = formatCurrency(parseFloat(totals.total));
}

// ============================================
// Line Items Management
// ============================================
function renderLineItems() {
  elements.lineItemsBody.innerHTML = '';

  state.lineItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'line-item';
    row.dataset.id = item.id;

    const total = (item.quantity || 0) * (item.unitPrice || 0);

    row.innerHTML = `
      <input type="text" placeholder="Description" value="${item.description || ''}" data-field="description">
      <input type="number" placeholder="Qty" value="${item.quantity || 1}" min="1" data-field="quantity">
      <input type="number" placeholder="Price" value="${item.unitPrice || ''}" min="0" step="0.01" data-field="unitPrice">
      <span class="line-item__total">${formatCurrency(total)}</span>
      <button class="line-item__remove" title="Remove item" ${state.lineItems.length === 1 ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    // Add event listeners
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        const value = field === 'description' ? input.value : parseFloat(input.value) || 0;
        updateLineItem(item.id, field, value);
      });
    });

    row.querySelector('.line-item__remove').addEventListener('click', () => {
      removeLineItem(item.id);
    });

    elements.lineItemsBody.appendChild(row);
  });
}

function addLineItem() {
  state.lineItems.push({
    id: nextLineItemId++,
    description: '',
    quantity: 1,
    unitPrice: 0
  });
  renderLineItems();
  updateTotalsDisplay();
}

function removeLineItem(id) {
  if (state.lineItems.length <= 1) return;
  state.lineItems = state.lineItems.filter(item => item.id !== id);
  renderLineItems();
  updateTotalsDisplay();
}

function updateLineItem(id, field, value) {
  const item = state.lineItems.find(item => item.id === id);
  if (item) {
    item[field] = value;

    // Update the total display for this row
    const row = elements.lineItemsBody.querySelector(`[data-id="${id}"]`);
    if (row) {
      const total = (item.quantity || 0) * (item.unitPrice || 0);
      row.querySelector('.line-item__total').textContent = formatCurrency(total);
    }

    updateTotalsDisplay();
  }
}

// ============================================
// Glyph API Integration
// ============================================
async function initializePreview() {
  setLoading(true);
  setStatus('Connecting...', 'loading');

  try {
    const formData = collectFormData();

    const response = await fetch(`${GLYPH_CONFIG.apiUrl}/v1/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLYPH_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        template: GLYPH_CONFIG.template,
        data: formData
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to generate preview (${response.status})`);
    }

    const data = await response.json();
    state.sessionId = data.sessionId;
    state.currentHtml = data.html;

    renderPreview(state.currentHtml);
    elements.previewEmpty.style.display = 'none';

    setStatus('Ready');
    showToast('Invoice preview ready!', 'success');

  } catch (error) {
    console.error('Preview initialization failed:', error);
    setStatus('Connection failed', 'error');
    showToast('Failed to connect to Glyph API. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
}

function renderPreview(html) {
  try {
    const doc = elements.previewFrame.contentDocument || elements.previewFrame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  } catch (error) {
    console.error('Failed to render preview:', error);
  }
}

async function modifyInvoice(prompt) {
  if (!prompt.trim()) {
    showToast('Please enter a description of the changes you want.', 'warning');
    return;
  }

  if (!state.sessionId) {
    showToast('Please generate a preview first.', 'warning');
    return;
  }

  setLoading(true);
  setStatus('Applying changes...', 'loading');
  const startTime = Date.now();

  try {
    const response = await fetch(`${GLYPH_CONFIG.apiUrl}/v1/modify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLYPH_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        sessionId: state.sessionId,
        prompt: prompt,
        html: state.currentHtml
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Server error (${response.status})`);
    }

    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    state.currentHtml = data.html;
    renderPreview(state.currentHtml);

    setStatus(`Done in ${elapsed}s`);
    showToast('Changes applied successfully!', 'success');

    // Clear the prompt input
    elements.promptInput.value = '';

    setTimeout(() => setStatus('Ready'), 2000);

  } catch (error) {
    console.error('Modification failed:', error);
    setStatus('Error', 'error');
    showToast(error.message || 'Failed to apply changes. Please try again.', 'error');
    setTimeout(() => setStatus('Ready'), 3000);
  } finally {
    setLoading(false);
  }
}

async function downloadPdf() {
  if (!state.sessionId) {
    showToast('Please generate a preview first.', 'warning');
    return;
  }

  setLoading(true);
  setStatus('Generating PDF...', 'loading');

  try {
    const response = await fetch(`${GLYPH_CONFIG.apiUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLYPH_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        sessionId: state.sessionId,
        format: 'pdf',
        filename: `invoice-${elements.invoiceNumber.value || 'draft'}.pdf`
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    // Handle the PDF download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${elements.invoiceNumber.value || 'draft'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    setStatus('PDF Downloaded');
    showToast('Invoice PDF downloaded!', 'success');
    setTimeout(() => setStatus('Ready'), 2000);

  } catch (error) {
    console.error('PDF generation failed:', error);
    setStatus('Error', 'error');
    showToast('Failed to generate PDF. Please try again.', 'error');
    setTimeout(() => setStatus('Ready'), 3000);
  } finally {
    setLoading(false);
  }
}

// ============================================
// Quick Actions
// ============================================
const quickActionPrompts = {
  'paid-stamp': 'Add a large green PAID stamp diagonally across the document, with the current date',
  'discount': 'Add a 10% early payment discount row to the totals section',
  'stripe-style': 'Apply Stripe-style professional design with clean lines, modern typography, and subtle shadows',
  'payment-terms': 'Add payment terms at the bottom: Net 30 days with 2% discount for payment within 10 days'
};

function handleQuickAction(action) {
  const prompt = quickActionPrompts[action];
  if (prompt) {
    modifyInvoice(prompt);
  }
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
  // Form inputs - debounced auto-regenerate
  const debouncedRegenerate = debounce(() => {
    if (state.sessionId) {
      initializePreview();
    }
  }, 1000);

  // Company info
  elements.companyName.addEventListener('input', debouncedRegenerate);
  elements.companyAddress.addEventListener('input', debouncedRegenerate);
  elements.companyEmail.addEventListener('input', debouncedRegenerate);
  elements.companyPhone.addEventListener('input', debouncedRegenerate);

  // Client info
  elements.clientName.addEventListener('input', debouncedRegenerate);
  elements.clientCompany.addEventListener('input', debouncedRegenerate);
  elements.clientEmail.addEventListener('input', debouncedRegenerate);
  elements.clientAddress.addEventListener('input', debouncedRegenerate);

  // Invoice meta
  elements.invoiceNumber.addEventListener('input', debouncedRegenerate);
  elements.invoiceDate.addEventListener('input', debouncedRegenerate);
  elements.invoiceDueDate.addEventListener('input', debouncedRegenerate);
  elements.notesInput.addEventListener('input', debouncedRegenerate);

  // Tax rate
  elements.taxRateInput.addEventListener('input', () => {
    updateTotalsDisplay();
    debouncedRegenerate();
  });

  // Line items
  elements.addLineItemBtn.addEventListener('click', addLineItem);

  // Generate preview
  elements.generateBtn.addEventListener('click', () => {
    initializePreview();
  });

  // Download PDF
  elements.downloadBtn.addEventListener('click', downloadPdf);

  // AI prompt
  elements.applyBtn.addEventListener('click', () => {
    modifyInvoice(elements.promptInput.value);
  });

  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      modifyInvoice(elements.promptInput.value);
    }
  });

  // Quick actions
  elements.quickActions.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleQuickAction(action);
    });
  });
}

// ============================================
// Initialization
// ============================================
function loadSampleData() {
  // Set default values
  elements.invoiceNumber.value = state.invoice.number;
  elements.invoiceDate.value = state.invoice.date;
  elements.invoiceDueDate.value = state.invoice.dueDate;
  elements.companyName.value = state.company.name;
  elements.companyAddress.value = state.company.address;
  elements.companyEmail.value = state.company.email;
  elements.companyPhone.value = state.company.phone;
  elements.taxRateInput.value = state.taxRate;
  elements.notesInput.value = state.notes;

  // Add sample line items
  state.lineItems = [
    { id: 1, description: 'Website Redesign', quantity: 1, unitPrice: 8500 },
    { id: 2, description: 'Frontend Development (hours)', quantity: 40, unitPrice: 150 },
    { id: 3, description: 'Backend API Integration (hours)', quantity: 20, unitPrice: 175 }
  ];
  nextLineItemId = 4;

  renderLineItems();
  updateTotalsDisplay();
}

async function init() {
  loadSampleData();
  initEventListeners();

  // Auto-generate preview on load
  await initializePreview();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
