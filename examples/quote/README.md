# Quote/Estimate Template

Pre-work proposals outlining scope, pricing, and terms before a project begins.

## Use Cases

- Service estimates (contractors, freelancers)
- Project proposals
- Price quotes for products
- Repair estimates
- Consulting engagement letters

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `quote.number` | Yes | Unique identifier |
| `quote.date` | Yes | Quote creation date |
| `quote.validUntil` | Yes | Expiration date |
| `company.name` | Yes | Your business name |
| `client.name` | Yes | Client name |
| `lineItems` OR `sections` | Yes | Quoted items |
| `totals.subtotal` | Yes | Sum before adjustments |
| `totals.total` | Yes | Final quoted amount |

## Sections vs Line Items

Use **lineItems** for simple quotes:
```json
{
  "lineItems": [
    {"description": "Service A", "quantity": 1, "unitPrice": 500, "total": 500}
  ]
}
```

Use **sections** for complex, phased projects:
```json
{
  "sections": [
    {
      "title": "Phase 1: Discovery",
      "items": [...],
      "subtotal": 5000
    }
  ]
}
```

## Common Natural Language Modifications

### Pricing Adjustments
- "Add a 10% discount for signing within 7 days"
- "Increase all labor rates by $15/hour"
- "Make the appliances section optional"
- "Add a contingency line item for 10% of the total"

### Timeline Changes
- "Push the start date to April 1"
- "Extend the project duration to 8 weeks"
- "Add a milestone for 'Design Approval' on March 1"

### Scope Modifications
- "Add 'Painting of kitchen walls' to the scope"
- "Add an exclusion for 'Asbestos remediation'"
- "Include a note that client is providing their own fixtures"

### Terms
- "Change the deposit to 50%"
- "Add a clause about material price increases"
- "Extend the quote validity to 45 days"

### Acceptance
- "Add signature lines for both spouses"
- "Include a space for initials on each page"
- "Add 'Subject to site verification' disclaimer"

## Industry-Specific Variations

### Home Services (HVAC, Plumbing, Electrical)
```json
{
  "quote": {
    "projectName": "HVAC System Replacement"
  },
  "jobSite": {
    "address": "123 Main St",
    "notes": "Equipment access through garage"
  },
  "terms": [
    "Permits included in price",
    "10-year parts warranty, 1-year labor"
  ]
}
```

### Software Development
```json
{
  "sections": [
    {
      "title": "Discovery & Planning",
      "items": [{"description": "Requirements gathering", "quantity": 40, "unit": "hours"}]
    },
    {
      "title": "Development",
      "items": [{"description": "Sprint 1-4 development", "quantity": 320, "unit": "hours"}]
    }
  ],
  "assumptions": [
    "API documentation provided by client",
    "Two rounds of revisions per feature"
  ]
}
```

### Event Services
```json
{
  "quote": {
    "projectName": "Wilson Wedding - June 15, 2024"
  },
  "sections": [
    {"title": "Photography Coverage", "subtotal": 4500},
    {"title": "Add-On Services", "subtotal": 1200}
  ],
  "terms": [
    "50% deposit to reserve date",
    "Balance due 2 weeks before event"
  ]
}
```

## Tips

1. **Be specific about exclusions** - Prevents scope creep and disputes
2. **Include assumptions** - Documents what you're basing the quote on
3. **Use optional items** - Let clients customize without multiple quote versions
4. **Set clear validity dates** - Material and labor costs change
5. **Include acceptance section** - Makes the quote legally actionable when signed
