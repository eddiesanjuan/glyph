# Intelligent Template-Data System

**For:** Nick and E.F. San Juan team
**Last Updated:** January 30, 2026

---

## What Changed

Glyph now automatically links your data sources to templates. Instead of manually configuring which template to use with which data, Glyph detects your data structure and suggests the best match.

### The New Workflow

```
Connect Data Source → Auto-Match Template → See in Dashboard → Customize → Generate PDFs
```

---

## Step-by-Step Guide

### 1. Connect Your Data Source

Go to the Dashboard and connect your Airtable base (or REST API):

**Dashboard URL:** https://dashboard.glyph.you

When you create a data source, Glyph:
1. Reads your table/endpoint schema
2. Detects the document type (invoice, work order, quote, etc.)
3. Suggests the best matching templates with confidence scores

**API Response Example:**
```json
{
  "success": true,
  "source": { "id": "...", "name": "Cabinet Team Sheet" },
  "matchSuggestions": [
    {
      "templateId": "work-order",
      "templateName": "Work Order",
      "confidence": 0.85,
      "reasoning": "Document type 'work-order' matches. 70% field coverage.",
      "suggestedMappings": [
        { "templateField": "order_number", "sourceField": "Work Order #" },
        { "templateField": "customer", "sourceField": "Customer Name" }
      ]
    }
  ]
}
```

### 2. View Your Templates

Click **"My Templates"** tab in the Dashboard.

You'll see cards for each template-source pair:
- **Template name** and type
- **Linked data source** with record count
- **Last updated** timestamp
- **Edit** and **Generate** buttons

If you have no templates yet, you'll see a Quick Start guide.

### 3. Customize in Playground

Click **"Edit Template"** on any card. This opens the Playground with:
- Your saved template loaded
- Sample data from your actual data source
- An editing banner showing what you're editing

**URL Format:**
```
https://glyph.you?templateId=xxx&sourceId=yyy
```

Make changes using natural language:
- "Add our company logo to the header"
- "Change the accent color to navy blue"
- "Add a QR code with the work order number"

### 4. Save Your Changes

Click **"Save Template"** when done.

- If editing an existing template → Updates it (doesn't create a new one)
- If creating new → Prompts for a name

Your changes are immediately available for PDF generation.

### 5. Generate PDFs

**Option A: Dashboard**
Click "Generate PDF" on a template card (coming soon - select record, download PDF)

**Option B: API**
```bash
curl -X POST https://api.glyph.you/v1/generate/smart \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "your-source-id"}'
```

The API automatically uses the linked template - no `templateId` needed.

**Option C: With specific record**
```bash
curl -X POST https://api.glyph.you/v1/generate/smart \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "your-source-id",
    "recordId": "recXXXXXX"
  }'
```

---

## Example: E.F. San Juan Setup

### Cabinet Team Documents

1. **Connect Airtable:**
   - Name: "Cabinet Work Orders"
   - Base ID: `appXXX` (your Cabinet Production base)
   - Table: "Work Orders"

2. **Auto-Match:** Glyph suggests "Work Order" template (85% confidence)

3. **Customize:**
   - Add E.F. San Juan logo
   - Add wood species field
   - Add delivery instructions section

4. **Save:** Template linked to Cabinet Work Orders source

5. **Generate:** `POST /v1/generate/smart { "sourceId": "cabinet-source-id" }`

### Service Team Documents

Same process, different source:
1. Connect "Service Invoices" Airtable table
2. Auto-match to "Professional Invoice" template
3. Customize with service-specific fields
4. Generate invoices from service records

---

## API Reference

### Create Data Source (with auto-match)
```
POST /v1/sources
```

**Request:**
```json
{
  "name": "My Airtable Data",
  "source_type": "airtable",
  "config": {
    "personal_access_token": "patXXX",
    "base_id": "appXXX",
    "table_id": "tblXXX"
  }
}
```

**Response includes:**
```json
{
  "matchSuggestions": [...]
}
```

### Accept a Match
```
POST /v1/sources/:id/accept-match
```

**Request:**
```json
{
  "templateId": "work-order"
}
```

### List Your Templates (with linked sources)
```
GET /v1/templates/saved
```

**Response:**
```json
{
  "templates": [
    {
      "id": "tpl_xxx",
      "name": "Cabinet Work Order",
      "linkedSource": {
        "id": "src_xxx",
        "name": "Cabinet Work Orders",
        "source_type": "airtable",
        "last_sync_record_count": 47
      }
    }
  ]
}
```

### Smart Generate (source-based)
```
POST /v1/generate/smart
```

**Request:**
```json
{
  "sourceId": "src_xxx",
  "recordId": "recXXX",  // optional - specific record
  "format": "pdf"        // optional - pdf, png, html
}
```

---

## URLs

| Resource | URL |
|----------|-----|
| Dashboard | https://dashboard.glyph.you |
| Playground | https://glyph.you |
| API | https://api.glyph.you |
| Docs | https://docs.glyph.you |

---

## Feedback

Found an issue? Have a suggestion?

Send feedback directly to Eddie. Include:
- What you were trying to do
- What happened (or didn't happen)
- What you expected

Feedback gets processed in rapid cycles - fixes typically ship same day.

---

## Changelog

**January 30, 2026**
- Added auto-matcher service (suggests templates for new sources)
- Added "My Templates" view in Dashboard
- Added URL parameter loading in Playground (?templateId, ?sourceId)
- Save now updates existing templates instead of creating duplicates
- Preview API accepts savedTemplateId for loading saved templates
