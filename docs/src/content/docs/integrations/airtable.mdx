---
title: Airtable Integration
description: Generate PDFs directly from your Airtable data with no code required
---

import { Aside, Steps, Tabs, TabItem } from '@astrojs/starlight/components';

Connect your Airtable bases to Glyph and generate professional PDFs from your data in minutes. No coding required.

## What You Can Build

With Glyph + Airtable, you can automatically generate:

- **Invoices** from your billing table
- **Quotes & Proposals** from your sales pipeline
- **Reports** from project tracking data
- **Contracts** from your client database
- **Certificates** from your records
- **Packing slips** from inventory data

<Aside type="tip">
Perfect for teams already using Airtable as their database. Turn any table into professional PDF documents.
</Aside>

## Prerequisites

Before you begin, you'll need:

1. An **Airtable account** with at least one base
2. An **Airtable Personal Access Token** (PAT)
3. A **Glyph API key** (get one at [dashboard.glyph.you](https://dashboard.glyph.you))

## Getting Your Airtable Token

<Steps>

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)

2. Click **Create new token**

3. Give it a name like "Glyph Integration"

4. Add these scopes:
   - `data.records:read` - Read records from tables
   - `schema.bases:read` - Read base and table schemas

5. Under **Access**, select the specific bases you want to connect, or choose "All current and future bases"

6. Click **Create token** and copy it immediately (starts with `pat`)

</Steps>

<Aside type="caution">
Keep your token secure. Never share it publicly or commit it to version control.
</Aside>

## Connecting via the Landing Page

The easiest way to get started is through the Glyph landing page:

<Steps>

1. Visit [glyph.you](https://glyph.you)

2. Click **Connect Airtable** in the navigation or hero section

3. Paste your Personal Access Token

4. Select your **Base** from the dropdown

5. Select the **Table** containing your data

6. Choose a **Template Style** that fits your document type

7. Preview your generated PDF with sample data

8. Download or refine with AI modifications

</Steps>

## Connecting via API

For programmatic access, use the Airtable API endpoints directly.

### Step 1: Validate Your Token

Test your Airtable token and get a list of accessible bases:

```bash
curl -X POST https://api.glyph.you/v1/airtable/connect \
  -H "Authorization: Bearer gk_your_glyph_api_key" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "pat_your_airtable_token"}'
```

**Response:**

```json
{
  "success": true,
  "bases": [
    {
      "id": "appXXXXXXXXXXXXXX",
      "name": "Sales Pipeline",
      "permissionLevel": "create"
    },
    {
      "id": "appYYYYYYYYYYYYYY",
      "name": "Invoices",
      "permissionLevel": "create"
    }
  ],
  "message": "Connected successfully. Found 2 accessible base(s)."
}
```

### Step 2: List Tables in a Base

Get all tables and their field counts:

```bash
curl https://api.glyph.you/v1/airtable/bases/appXXXXXXXXXXXXXX/tables \
  -H "Authorization: Bearer gk_your_glyph_api_key" \
  -H "X-Airtable-Key: pat_your_airtable_token"
```

**Response:**

```json
{
  "baseId": "appXXXXXXXXXXXXXX",
  "tables": [
    {
      "id": "tblXXXXXXXXXXXXXX",
      "name": "Invoices",
      "description": "Customer invoices",
      "primaryFieldId": "fldXXXXXXXXXXXXXX",
      "fieldCount": 12,
      "viewCount": 3
    },
    {
      "id": "tblYYYYYYYYYYYYYY",
      "name": "Clients",
      "description": null,
      "primaryFieldId": "fldYYYYYYYYYYYYYY",
      "fieldCount": 8,
      "viewCount": 2
    }
  ]
}
```

### Step 3: Get Table Schema

Retrieve detailed field information for template mapping:

```bash
curl https://api.glyph.you/v1/airtable/bases/appXXXXXXXXXXXXXX/tables/tblXXXXXXXXXXXXXX/schema \
  -H "Authorization: Bearer gk_your_glyph_api_key" \
  -H "X-Airtable-Key: pat_your_airtable_token"
```

**Response:**

```json
{
  "baseId": "appXXXXXXXXXXXXXX",
  "table": {
    "id": "tblXXXXXXXXXXXXXX",
    "name": "Invoices",
    "description": "Customer invoices",
    "primaryFieldId": "fldXXXXXXXXXXXXXX"
  },
  "fields": [
    {
      "id": "fldXXXXXXXXXXXXXX",
      "name": "Invoice Number",
      "type": "autoNumber",
      "description": null
    },
    {
      "id": "fldYYYYYYYYYYYYYY",
      "name": "Client Name",
      "type": "singleLineText",
      "description": null
    },
    {
      "id": "fldZZZZZZZZZZZZZZ",
      "name": "Amount",
      "type": "currency",
      "options": {
        "precision": 2,
        "symbol": "$"
      }
    },
    {
      "id": "fldAAAAAAAAAAAAA",
      "name": "Due Date",
      "type": "date",
      "description": null
    }
  ],
  "views": [
    {
      "id": "viwXXXXXXXXXXXXXX",
      "name": "All Invoices",
      "type": "grid"
    }
  ],
  "aiSchema": {
    "tableName": "Invoices",
    "tableDescription": "Customer invoices",
    "fields": [...]
  }
}
```

### Step 4: Fetch Records

Get sample records for preview or all records for batch generation:

```bash
curl "https://api.glyph.you/v1/airtable/bases/appXXXXXXXXXXXXXX/tables/tblXXXXXXXXXXXXXX/records?maxRecords=5" \
  -H "Authorization: Bearer gk_your_glyph_api_key" \
  -H "X-Airtable-Key: pat_your_airtable_token"
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxRecords` | number | 5 | Maximum records to return (1-100) |
| `view` | string | - | Filter by Airtable view name |

**Response:**

```json
{
  "baseId": "appXXXXXXXXXXXXXX",
  "tableId": "tblXXXXXXXXXXXXXX",
  "tableName": "Invoices",
  "recordCount": 5,
  "records": [
    {
      "_id": "recXXXXXXXXXXXXXX",
      "_createdTime": "2024-01-15T10:30:00.000Z",
      "fields": {
        "Invoice Number": "1001",
        "Client Name": "Acme Corp",
        "Amount": "$2,500.00",
        "Due Date": "2/15/2024"
      }
    }
  ],
  "rawRecords": [...]
}
```

### Step 5: Get a Single Record

Fetch a specific record by ID:

```bash
curl https://api.glyph.you/v1/airtable/bases/appXXXXXXXXXXXXXX/tables/tblXXXXXXXXXXXXXX/records/recXXXXXXXXXXXXXX \
  -H "Authorization: Bearer gk_your_glyph_api_key" \
  -H "X-Airtable-Key: pat_your_airtable_token"
```

## Field Type Mapping

Glyph automatically converts Airtable field types for optimal PDF rendering:

| Airtable Type | Glyph Type | Notes |
|---------------|------------|-------|
| `singleLineText`, `multilineText` | text | Plain text |
| `richText` | html | Preserves formatting |
| `email` | email | Clickable in PDF |
| `url` | url | Clickable in PDF |
| `number`, `autoNumber`, `count` | number | Formatted with locale |
| `currency` | currency | Includes symbol, 2 decimals |
| `percent` | percent | Displayed as percentage |
| `date` | date | Formatted as locale date |
| `dateTime` | datetime | Formatted as locale datetime |
| `checkbox` | boolean | True/false for conditionals |
| `singleSelect` | select | Single value |
| `multipleSelects` | multiselect | Array of values |
| `attachment` | attachment | First image URL available |
| `multipleRecordLinks` | links | Array of record IDs |

## Example Use Cases

### Invoice Generation

Connect your invoices table to generate professional PDFs:

```javascript
// 1. Fetch invoice record from Airtable
const invoiceResponse = await fetch(
  `https://api.glyph.you/v1/airtable/bases/${baseId}/tables/${tableId}/records/${recordId}`,
  {
    headers: {
      'Authorization': 'Bearer gk_your_api_key',
      'X-Airtable-Key': 'pat_your_airtable_token'
    }
  }
);
const { record } = await invoiceResponse.json();

// 2. Create PDF preview with Glyph
const previewResponse = await fetch('https://api.glyph.you/v1/preview', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template: 'quote-modern',
    data: {
      client: {
        name: record.fields['Client Name'],
        email: record.fields['Email'],
        company: record.fields['Company']
      },
      lineItems: record.fields['Line Items'] || [],
      totals: {
        subtotal: record.fields['Subtotal'],
        tax: record.fields['Tax'],
        total: record.fields['Total']
      },
      meta: {
        quoteNumber: record.fields['Invoice Number'],
        date: record.fields['Date'],
        validUntil: record.fields['Due Date']
      }
    }
  })
});

const { sessionId } = await previewResponse.json();

// 3. Generate the PDF
const pdfResponse = await fetch('https://api.glyph.you/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId,
    format: 'pdf'
  })
});

const pdfBlob = await pdfResponse.blob();
```

### Batch PDF Generation

Generate multiple PDFs from a table view:

```javascript
// Fetch all records from a specific view
const recordsResponse = await fetch(
  `https://api.glyph.you/v1/airtable/bases/${baseId}/tables/${tableId}/records?maxRecords=100&view=Ready%20to%20Send`,
  {
    headers: {
      'Authorization': 'Bearer gk_your_api_key',
      'X-Airtable-Key': 'pat_your_airtable_token'
    }
  }
);
const { records } = await recordsResponse.json();

// Generate PDF for each record
for (const record of records) {
  // ... create preview and generate PDF for each
}
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/airtable/connect` | Validate token, list bases |
| `GET` | `/v1/airtable/bases/:baseId/tables` | List tables in a base |
| `GET` | `/v1/airtable/bases/:baseId/tables/:tableId/schema` | Get table field schema |
| `GET` | `/v1/airtable/bases/:baseId/tables/:tableId/records` | List records |
| `GET` | `/v1/airtable/bases/:baseId/tables/:tableId/records/:recordId` | Get single record |

### Authentication

All Airtable endpoints require:

1. **Glyph API Key** in the `Authorization` header: `Bearer gk_your_api_key`
2. **Airtable Token** either:
   - In the request body for `POST /connect`: `{"apiKey": "pat_..."}`
   - In the `X-Airtable-Key` header for all other endpoints

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Missing or invalid request parameters |
| `INVALID_KEY_FORMAT` | Airtable key doesn't start with `pat` or `key` |
| `AIRTABLE_AUTH_ERROR` | Invalid Airtable token |
| `MISSING_AIRTABLE_KEY` | `X-Airtable-Key` header not provided |
| `TABLE_NOT_FOUND` | Table doesn't exist in the specified base |
| `RECORDS_ERROR` | Failed to fetch records |

## Troubleshooting

### "Invalid Airtable API key format"

Make sure your token starts with `pat` (Personal Access Token) or `key` (legacy API key). You can create a new token at [airtable.com/create/tokens](https://airtable.com/create/tokens).

### "Failed to connect to Airtable"

Check that:
- Your token has the required scopes (`data.records:read`, `schema.bases:read`)
- The token has access to the base you're trying to connect
- The token hasn't expired or been revoked

### "Table not found"

Verify the table ID or name is correct. Table IDs start with `tbl`. You can also use the table name (case-sensitive).

### Empty Records

If you're getting empty records:
- Check that the view you're filtering by exists
- Verify the fields have data
- Ensure your token has read access to the table

## Next Steps

- [POST /v1/preview](/api/preview/) - Generate document previews
- [POST /v1/modify](/api/modify/) - AI-powered modifications
- [POST /v1/generate](/api/generate/) - PDF generation
- [Templates Overview](/templates/overview/) - Available templates
