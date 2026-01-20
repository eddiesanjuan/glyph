# Proposal Template

Business proposals for pitching services, projects, or partnerships.

## Use Cases

- Consulting proposals
- Project bids
- RFP responses
- Partnership proposals
- Grant applications
- Service proposals

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `proposal.title` | Yes | Proposal title |
| `proposal.date` | Yes | Proposal date |
| `proposal.validUntil` | Yes | Expiration date |
| `company.name` | Yes | Your company name |
| `client.name` | Yes | Client name |
| `executiveSummary` | Yes | High-level overview |
| `solution.overview` | Yes | Proposed solution |
| `scope` | Yes | Work breakdown |
| `timeline.milestones` | Yes | Key milestones |
| `pricing.items` | Yes | Cost breakdown |
| `pricing.total` | Yes | Total price |
| `pricing.paymentTerms` | Yes | Payment terms |
| `terms` | Yes | Terms and conditions |

## Common Natural Language Modifications

### Pricing
- "Add a 10% discount for annual commitment"
- "Include monthly retainer option of $15K/month"
- "Add optional SEO services for $5,000"
- "Change payment terms to 50% upfront, 50% on completion"

### Scope
- "Add a phase for content migration"
- "Remove the B2B portal from scope"
- "Extend the support period to 6 months"
- "Add user training to each phase"

### Timeline
- "Compress timeline to 12 weeks"
- "Add buffer week between design and development"
- "Move start date to March 1"

### Team
- "Add a dedicated project manager"
- "Include team member bios"
- "Remove photos for privacy"

### Content
- "Add more case studies"
- "Expand the problem statement"
- "Include ROI projections"
- "Add competitor analysis section"

## Proposal Types

### Consulting Proposal
```json
{
  "proposal": {
    "title": "Strategic Planning Engagement",
    "type": "consulting"
  },
  "pricing": {
    "model": "retainer",
    "items": [
      {"description": "Monthly strategic advisory", "price": 12000}
    ],
    "paymentTerms": "Monthly retainer, billed in advance"
  }
}
```

### Grant Application
```json
{
  "proposal": {
    "title": "Community Health Initiative",
    "type": "grant"
  },
  "scope": [
    {
      "phase": "Program Development",
      "deliverables": ["Curriculum design", "Staff training", "Materials"]
    }
  ],
  "pricing": {
    "items": [
      {"description": "Personnel", "price": 85000},
      {"description": "Materials & Supplies", "price": 15000},
      {"description": "Overhead (15%)", "price": 15000}
    ]
  }
}
```

### RFP Response
```json
{
  "proposal": {
    "title": "Response to RFP #2025-042",
    "type": "rfp_response"
  },
  "sections": [
    {"title": "Technical Approach", "content": "..."},
    {"title": "Management Approach", "content": "..."},
    {"title": "Past Performance", "content": "..."}
  ]
}
```

### Partnership Proposal
```json
{
  "proposal": {
    "title": "Strategic Partnership Proposal",
    "type": "partnership"
  },
  "solution": {
    "overview": "A mutually beneficial partnership...",
    "features": [
      {"title": "Revenue Share", "description": "50/50 split on joint deals"},
      {"title": "Co-Marketing", "description": "Joint content and events"}
    ]
  }
}
```

## Tips

1. **Lead with value** - Executive summary should focus on client outcomes
2. **Quantify impact** - Include projected ROI, metrics improvements
3. **Show, don't tell** - Use case studies to demonstrate capability
4. **Be specific on scope** - Prevents scope creep and misunderstandings
5. **Make it easy to say yes** - Clear next steps, simple acceptance
6. **Create urgency** - Validity period, early commitment discounts
7. **Address objections** - Assumptions and exclusions prevent surprises
