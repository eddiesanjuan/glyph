# Contract Template

Service agreements and legally-binding contracts between two or more parties.

## Use Cases

- Independent contractor agreements
- Service contracts
- Non-disclosure agreements (NDAs)
- Consulting agreements
- Freelance contracts
- Partnership agreements

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `contract.title` | Yes | Agreement title |
| `contract.effectiveDate` | Yes | When contract takes effect |
| `parties.party1` | Yes | First party details |
| `parties.party2` | Yes | Second party details |
| `sections` | Yes | Main contract terms |
| `signatures.showLines` | Yes | Enable signature section |

## Common Natural Language Modifications

### Term and Dates
- "Change the term to 6 months"
- "Set the effective date to March 1, 2024"
- "Make this an at-will agreement with no end date"
- "Add automatic renewal for successive 1-year terms"

### Compensation
- "Change the hourly rate to $175"
- "Switch to a monthly retainer of $8,000"
- "Add a kill fee of 50% of remaining contract value"
- "Include a 3% annual rate increase"

### Termination
- "Reduce the notice period to 14 days"
- "Add termination for bankruptcy or insolvency"
- "Remove the termination for convenience clause"

### IP and Confidentiality
- "Contractor retains ownership of all IP, with license to Client"
- "Extend confidentiality obligations to 5 years"
- "Add exceptions for publicly available information"

### Legal Provisions
- "Change governing law to New York"
- "Add a non-compete clause for 12 months within 50 miles"
- "Include an arbitration clause"
- "Add a non-solicitation provision"

## Contract Types

### Non-Disclosure Agreement (NDA)
```json
{
  "contract": {
    "title": "Mutual Non-Disclosure Agreement",
    "type": "nda"
  },
  "sections": [
    {
      "title": "Definition of Confidential Information",
      "content": "..."
    },
    {
      "title": "Obligations of Receiving Party",
      "content": "..."
    },
    {
      "title": "Exclusions",
      "content": "..."
    },
    {
      "title": "Term",
      "content": "This Agreement shall remain in effect for three (3) years..."
    }
  ]
}
```

### Employment Agreement
```json
{
  "contract": {
    "title": "Employment Agreement",
    "type": "employment"
  },
  "sections": [
    {"title": "Position and Duties", "content": "..."},
    {"title": "Compensation and Benefits", "content": "..."},
    {"title": "Work Schedule", "content": "..."},
    {"title": "Intellectual Property", "content": "..."},
    {"title": "Non-Compete", "content": "..."},
    {"title": "At-Will Employment", "content": "..."}
  ]
}
```

### Rental/Lease Agreement
```json
{
  "contract": {
    "title": "Residential Lease Agreement",
    "type": "rental"
  },
  "parties": {
    "party1": {"name": "Property Owner (Landlord)"},
    "party2": {"name": "Tenant Name"}
  },
  "sections": [
    {"title": "Property Description", "content": "..."},
    {"title": "Rent and Security Deposit", "content": "..."},
    {"title": "Utilities and Maintenance", "content": "..."},
    {"title": "Rules and Regulations", "content": "..."}
  ]
}
```

## Important Notes

1. **This is not legal advice** - Contracts should be reviewed by an attorney
2. **Jurisdiction matters** - Laws vary by state/country
3. **Use numbered sections** - Makes reference and amendments clearer
4. **Include exhibits** - Keep technical details separate from main agreement
5. **Signature pages** - Some jurisdictions require specific formats

## Tips

1. **Be specific about Services** - Vague descriptions lead to disputes
2. **Define key terms** - "Confidential Information," "Work Product," etc.
3. **Address termination clearly** - What happens when it ends?
4. **Include a severability clause** - Invalid provisions don't void the whole contract
5. **Keep a signed copy** - Both parties should retain executed originals
