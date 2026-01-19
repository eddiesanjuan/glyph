/**
 * FieldAutocomplete - World-class field suggestion UI for the Glyph SDK
 *
 * Provides IDE-like autocomplete for template data fields with:
 * - Smart trigger detection ("add ", "{{", field-related keywords)
 * - Keyboard navigation (up/down arrows, Enter to select, Escape to close)
 * - Click to select
 * - Organized categories with field names and example values
 * - Smooth animations
 */

export interface FieldDefinition {
  category: string;
  name: string;
  path: string;
  description: string;
  example?: string;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

export interface FieldAutocompleteOptions {
  inputElement: HTMLInputElement | HTMLTextAreaElement;
  container: HTMLElement;
  onSelect: (field: FieldDefinition, composedPrompt: string) => void;
  fields?: FieldDefinition[];
  accentColor?: string;
}

// Default fields from quote-modern schema
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

// Trigger patterns for showing autocomplete
const TRIGGER_PATTERNS = {
  ADD_PREFIX: /^add\s+/i,
  MUSTACHE_OPEN: /\{\{$/,
  FIELD_KEYWORDS: /\b(field|value|phone|email|address|company|client|name|date|quote|total|price|subtotal|tax|discount|notes|terms|logo)\b/i,
};

export class FieldAutocomplete {
  private input: HTMLInputElement | HTMLTextAreaElement;
  private container: HTMLElement;
  private dropdown: HTMLElement | null = null;
  private fields: FieldDefinition[];
  private filteredFields: FieldDefinition[] = [];
  private selectedIndex: number = -1;
  private isVisible: boolean = false;
  private onSelect: (field: FieldDefinition, composedPrompt: string) => void;

  // Category icons for visual polish
  private categoryIcons: Record<string, string> = {
    'Client': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    'Quote Info': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'Company': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    'Totals': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'Line Items': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    'Styles': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  constructor(options: FieldAutocompleteOptions) {
    this.input = options.inputElement;
    this.container = options.container;
    this.onSelect = options.onSelect;
    this.fields = options.fields || DEFAULT_FIELDS;
    // accentColor available for future customization via options.accentColor

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
    this.dropdown.setAttribute('aria-label', 'Available data fields');
    this.dropdown.style.display = 'none';
    this.container.appendChild(this.dropdown);
  }

  private attachEventListeners() {
    // Input events
    this.input.addEventListener('input', this.handleInput.bind(this));
    this.input.addEventListener('keydown', this.handleKeydown.bind(this) as EventListener);
    this.input.addEventListener('blur', this.handleBlur.bind(this));
    this.input.addEventListener('focus', this.handleFocus.bind(this));

    // Prevent dropdown click from blurring input
    this.dropdown?.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
  }

  private handleFocus() {
    // Check if we should show autocomplete based on current value
    this.checkTrigger(this.input.value);
  }

  private handleBlur() {
    // Delay hiding to allow click events on dropdown
    setTimeout(() => {
      this.hide();
    }, 150);
  }

  private handleInput() {
    const value = this.input.value;
    this.checkTrigger(value);
  }

  private checkTrigger(value: string) {
    const cursorPosition = (this.input as HTMLInputElement).selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPosition);

    // Check for mustache trigger {{ at cursor position
    if (textBeforeCursor.endsWith('{{')) {
      this.show('');
      return;
    }

    // Check for "add " prefix
    if (TRIGGER_PATTERNS.ADD_PREFIX.test(textBeforeCursor)) {
      const searchTerm = textBeforeCursor.replace(TRIGGER_PATTERNS.ADD_PREFIX, '').trim();
      this.show(searchTerm);
      return;
    }

    // Check for field-related keywords
    if (TRIGGER_PATTERNS.FIELD_KEYWORDS.test(textBeforeCursor)) {
      const match = textBeforeCursor.match(TRIGGER_PATTERNS.FIELD_KEYWORDS);
      if (match) {
        this.show(match[1]);
        return;
      }
    }

    // Hide if no trigger matches
    this.hide();
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
        if (this.selectedIndex >= 0 && this.filteredFields[this.selectedIndex]) {
          e.preventDefault();
          this.selectField(this.filteredFields[this.selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
      case 'Tab':
        if (this.selectedIndex >= 0 && this.filteredFields[this.selectedIndex]) {
          e.preventDefault();
          this.selectField(this.filteredFields[this.selectedIndex]);
        } else {
          this.hide();
        }
        break;
    }
  }

  private moveSelection(direction: number) {
    const maxIndex = this.filteredFields.length - 1;
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

  private show(searchTerm: string) {
    this.filteredFields = this.filterFields(searchTerm);

    if (this.filteredFields.length === 0) {
      this.hide();
      return;
    }

    this.selectedIndex = 0;
    this.renderDropdown();

    if (this.dropdown) {
      this.dropdown.style.display = 'block';
      this.isVisible = true;

      // Position the dropdown
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

    // Position below the input
    const top = inputRect.bottom - containerRect.top + 4;
    const left = inputRect.left - containerRect.left;

    this.dropdown.style.position = 'absolute';
    this.dropdown.style.top = `${top}px`;
    this.dropdown.style.left = `${left}px`;
    this.dropdown.style.width = `${Math.min(inputRect.width, 420)}px`;
    this.dropdown.style.maxWidth = '420px';
    this.dropdown.style.zIndex = '1000';
  }

  private filterFields(searchTerm: string): FieldDefinition[] {
    if (!searchTerm) {
      return this.fields;
    }

    const term = searchTerm.toLowerCase();
    return this.fields.filter(field =>
      field.name.toLowerCase().includes(term) ||
      field.path.toLowerCase().includes(term) ||
      field.category.toLowerCase().includes(term) ||
      field.description.toLowerCase().includes(term)
    );
  }

  private renderDropdown() {
    if (!this.dropdown) return;

    // Group fields by category
    const grouped = this.groupByCategory(this.filteredFields);

    let html = '';
    let globalIndex = 0;

    for (const [category, fields] of Object.entries(grouped)) {
      const icon = this.categoryIcons[category] || '';

      html += `
        <div class="glyph-autocomplete-category">
          <span class="glyph-autocomplete-category-icon">${icon}</span>
          <span class="glyph-autocomplete-category-text">${this.escapeHtml(category)}</span>
        </div>
      `;

      for (const field of fields) {
        const isSelected = globalIndex === this.selectedIndex;
        const typeIcon = this.getTypeIcon(field.type);

        html += `
          <div class="glyph-autocomplete-item ${isSelected ? 'selected' : ''}"
               role="option"
               aria-selected="${isSelected}"
               data-index="${globalIndex}"
               data-path="${this.escapeHtml(field.path)}">
            <div class="glyph-autocomplete-item-main">
              <span class="glyph-autocomplete-item-icon">${typeIcon}</span>
              <div class="glyph-autocomplete-item-content">
                <span class="glyph-autocomplete-item-name">${this.escapeHtml(field.name)}</span>
                <span class="glyph-autocomplete-item-path">{{${this.escapeHtml(field.path)}}}</span>
              </div>
            </div>
            ${field.example ? `<span class="glyph-autocomplete-item-example">${this.escapeHtml(field.example)}</span>` : ''}
          </div>
        `;
        globalIndex++;
      }
    }

    this.dropdown.innerHTML = html;

    // Add click handlers to items
    const items = this.dropdown.querySelectorAll('.glyph-autocomplete-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index') || '0', 10);
        const field = this.filteredFields[index];
        if (field) {
          this.selectField(field);
        }
      });

      item.addEventListener('mouseenter', () => {
        const index = parseInt(item.getAttribute('data-index') || '0', 10);
        this.selectedIndex = index;
        this.updateSelectionUI();
      });
    });
  }

  private getTypeIcon(type?: string): string {
    switch (type) {
      case 'number':
        return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>';
      case 'date':
        return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
      case 'boolean':
        return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      default:
        return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    }
  }

  private groupByCategory(fields: FieldDefinition[]): Record<string, FieldDefinition[]> {
    return fields.reduce((acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, FieldDefinition[]>);
  }

  private selectField(field: FieldDefinition) {
    // Compose a smart prompt based on context
    const currentValue = this.input.value;
    let composedPrompt = '';

    // Check if we're in the middle of typing "add ..."
    if (TRIGGER_PATTERNS.ADD_PREFIX.test(currentValue)) {
      // Replace the search term with a composed prompt
      composedPrompt = `Add {{${field.path}}} to the document`;
    } else if (currentValue.endsWith('{{')) {
      // Complete the mustache syntax
      composedPrompt = currentValue.slice(0, -2) + `{{${field.path}}}`;
    } else {
      // Default: create a sensible prompt
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

      composedPrompt = contextMap[field.path] || `Add {{${field.path}}} to the document`;
    }

    this.hide();
    this.onSelect(field, composedPrompt);
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
          // Recursively extract nested fields
          const nestedCategory = key.charAt(0).toUpperCase() + key.slice(1);
          extractFields(propValue, path, nestedCategory);
        } else if (type === 'array' && propValue.items) {
          // Handle array items
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
          // Regular field
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
 * CSS styles for the autocomplete dropdown
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
    max-height: 380px;
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

  .glyph-autocomplete-item:last-child {
    border-bottom: none;
    border-radius: 0 0 12px 12px;
  }

  .glyph-autocomplete-item:hover,
  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0.04) 100%);
  }

  .glyph-autocomplete-item.selected {
    background: linear-gradient(90deg, rgba(20, 184, 166, 0.12) 0%, rgba(20, 184, 166, 0.06) 100%);
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
    width: 24px;
    height: 24px;
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

  .glyph-autocomplete-item-path {
    font-size: 11px;
    font-family: ui-monospace, 'SF Mono', 'Fira Code', monospace;
    color: #14B8A6;
    background: rgba(20, 184, 166, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    max-width: fit-content;
  }

  .glyph-autocomplete-item.selected .glyph-autocomplete-item-path {
    background: rgba(20, 184, 166, 0.15);
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

    .glyph-autocomplete-item-path {
      background: rgba(20, 184, 166, 0.2);
    }

    .glyph-autocomplete-item-example {
      color: #6b7280;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .glyph-autocomplete-dropdown {
      animation: none;
    }
  }
`;
