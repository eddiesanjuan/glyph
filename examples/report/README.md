# Report Template

Business, project, or analytical reports with structured content and data visualization.

## Use Cases

- Quarterly business reviews
- Project status reports
- Financial summaries
- Technical analysis documents
- Board presentations
- Audit reports

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `report.title` | Yes | Report title |
| `report.date` | Yes | Report date |
| `author.name` | Yes | Author/team name |
| `sections` | Yes | Main content sections |

## Common Natural Language Modifications

### Metadata
- "Change the period to Q1 2025"
- "Mark this as confidential"
- "Add version 2.0"
- "Update the date to today"

### Content
- "Add a section about budget utilization"
- "Expand the executive summary to include risk factors"
- "Remove the appendices"
- "Add a chart placeholder for revenue trends"

### Metrics
- "Update system availability to 99.95%"
- "Add a new metric for customer satisfaction"
- "Mark the cost metric as exceeding target"
- "Add quarter-over-quarter comparison"

### Recommendations
- "Add a high-priority recommendation for hiring"
- "Assign the capacity planning recommendation to John"
- "Change the due date to March 15"

### Formatting
- "Add page numbers"
- "Include table of contents"
- "Add confidentiality footer"

## Report Types

### Project Status Report
```json
{
  "report": {
    "title": "Project Alpha - Weekly Status",
    "period": "Week of January 15, 2025"
  },
  "metrics": [
    {"name": "Sprint Progress", "value": "75%", "target": "80%"},
    {"name": "Blockers", "value": 2, "trend": "up", "trendDirection": "negative"}
  ],
  "risks": [
    {"description": "API integration delayed", "impact": "high"}
  ]
}
```

### Financial Report
```json
{
  "report": {
    "title": "FY2024 Annual Financial Report"
  },
  "metrics": [
    {"name": "Revenue", "value": "$12.4M", "previousValue": "$9.8M"},
    {"name": "Gross Margin", "value": "68%", "target": "65%"},
    {"name": "Operating Expenses", "value": "$8.2M"}
  ],
  "tables": [
    {
      "title": "Revenue by Product Line",
      "headers": ["Product", "Q1", "Q2", "Q3", "Q4", "Total"],
      "rows": [...]
    }
  ]
}
```

### Technical Analysis
```json
{
  "report": {
    "title": "API Performance Analysis"
  },
  "sections": [
    {
      "title": "Methodology",
      "content": "Load testing performed using k6..."
    },
    {
      "title": "Findings",
      "content": "Under 10K concurrent users..."
    }
  ],
  "charts": [
    {"id": "latency-chart", "title": "Response Time Distribution", "type": "line"}
  ]
}
```

### Audit Report
```json
{
  "report": {
    "title": "SOC 2 Compliance Audit Report",
    "status": "confidential"
  },
  "findings": [
    {"type": "positive", "content": "Access controls meet requirements"},
    {"type": "negative", "content": "Encryption at rest not enabled for backup storage"},
    {"type": "action", "content": "Enable encryption by March 1"}
  ],
  "footer": {
    "confidentiality": "Confidential - Authorized Recipients Only"
  }
}
```

## Tips

1. **Start with executive summary** - Busy stakeholders read this first and maybe only
2. **Use metrics strategically** - Highlight 5-7 key metrics, not 50
3. **Include trend context** - Is the number good or bad? Getting better?
4. **Be specific in recommendations** - Who, what, when
5. **Track risks proactively** - Show you're thinking ahead
6. **Keep appendices separate** - Detail belongs in appendices, not the main body
