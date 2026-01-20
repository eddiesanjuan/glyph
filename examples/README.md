# Glyph Document Examples

This directory contains comprehensive examples for all supported document types in Glyph.

## Supported Document Types

| Type | Description | Common Uses |
|------|-------------|-------------|
| [Invoice](./invoice/) | Service invoices for billing | Freelance, consulting, product sales |
| [Quote](./quote/) | Pre-work proposals with pricing | Estimates, project proposals, bids |
| [Receipt](./receipt/) | Transaction confirmations | Retail, payments, donations |
| [Contract](./contract/) | Legal agreements | Contractor, NDA, service agreements |
| [Resume](./resume/) | Professional profiles | Job applications, portfolios |
| [Report](./report/) | Business/project reports | Quarterly reviews, status updates |
| [Letter](./letter/) | Formal correspondence | Offer letters, recommendations |
| [Proposal](./proposal/) | Business proposals | Consulting, project pitches, RFPs |
| [Work Order](./work-order/) | Service/repair documentation | Field service, maintenance |
| [Packing Slip](./packing-slip/) | Shipping documents | E-commerce, wholesale, warehouse |
| [Statement](./statement/) | Account statements | Customer accounts, billing |
| [Certificate](./certificate/) | Achievement documents | Completions, awards, licenses |

## Directory Structure

Each document type folder contains:

```
{document-type}/
├── schema.ts          # TypeScript interface definition
├── example-data.json  # Complete realistic example
├── README.md          # Usage docs and customization guide
└── sample-output.md   # Description of rendered output
```

## Usage

### Import Types

```typescript
import {
  InvoiceData,
  QuoteData,
  ResumeData,
  DOCUMENT_TYPES,
  getDocumentTypeInfo,
} from '@glyph/examples';

// Create typed document data
const invoice: InvoiceData = {
  invoice: {
    number: 'INV-001',
    date: 'January 1, 2025',
    dueDate: 'January 31, 2025',
  },
  // ...
};

// Get document type metadata
const info = getDocumentTypeInfo('invoice');
console.log(info.description); // "Service invoices for billing clients..."
```

### Load Example Data

```typescript
import invoiceExample from '@glyph/examples/invoice/example-data.json';
import quoteExample from '@glyph/examples/quote/example-data.json';
```

## Common Patterns

### Natural Language Modifications

Glyph supports natural language modifications to documents. Each README includes common modification examples:

```
"Add a 10% discount to the total"
"Change the due date to March 15"
"Include my company logo"
"Add a signature line for the client"
```

### Extending Schemas

Document schemas are designed to be extensible:

```typescript
import { InvoiceData } from '@glyph/examples';

// Extend with custom fields
interface MyInvoiceData extends InvoiceData {
  customFields: {
    projectCode: string;
    department: string;
  };
}
```

## Adding New Document Types

To add a new document type:

1. Create a new folder: `examples/{document-type}/`
2. Add the four required files:
   - `schema.ts` - TypeScript interface
   - `example-data.json` - Realistic example
   - `README.md` - Usage documentation
   - `sample-output.md` - Output description
3. Export from `index.ts`
4. Add to `DOCUMENT_TYPES` and `DOCUMENT_TYPE_INFO`

## Best Practices

1. **Use realistic data** - Examples should be indistinguishable from real documents
2. **Include all common fields** - Show the full capability of each type
3. **Document modifications** - List natural language commands users might try
4. **Show variations** - Include industry-specific examples in READMEs
5. **Keep types strict** - Required fields should be truly required

## License

Part of the Glyph project. See main repository for license.
