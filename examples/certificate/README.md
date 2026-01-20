# Certificate Template

Completion certificates, awards, and professional recognition documents.

## Use Cases

- Course completion certificates
- Professional certifications
- Achievement awards
- Training completions
- Membership certificates
- License certificates
- Academic diplomas
- Volunteer recognition

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `certificate.title` | Yes | Certificate title |
| `certificate.issueDate` | Yes | Date issued |
| `issuer.name` | Yes | Issuing organization |
| `recipient.name` | Yes | Recipient's full name |
| `achievement.description` | Yes | What was achieved |
| `signatures` | Yes | At least one signature |

## Common Natural Language Modifications

### Certificate Details
- "Add certificate number CERT-12345"
- "Set expiration to December 31, 2026"
- "Change type to professional license"
- "Add credential abbreviation (PMP, CPA, etc.)"

### Recipient
- "Update name to 'Dr. Jennifer Martinez'"
- "Add organization 'TechCorp Inc.'"
- "Include recipient photo"

### Achievement
- "Add score of 95%"
- "Include 40 CEU credits"
- "List skills: Project Management, Leadership"
- "Add level: Advanced"

### Appearance
- "Add gold seal"
- "Include digital badge image"
- "Add organization logos"
- "Use ornate border style"

### Verification
- "Add QR code for verification"
- "Include verification URL"
- "Add blockchain hash"

## Certificate Types

### Training Completion
```json
{
  "certificate": {
    "title": "Certificate of Completion",
    "type": "completion"
  },
  "achievement": {
    "description": "Has successfully completed",
    "credential": "OSHA 30-Hour Construction Safety"
  },
  "program": {
    "name": "OSHA 30-Hour Construction",
    "duration": "30 hours"
  }
}
```

### Professional Certification
```json
{
  "certificate": {
    "title": "Professional Certification",
    "type": "license",
    "expirationDate": "2027-01-01"
  },
  "achievement": {
    "credential": "Project Management Professional (PMP)",
    "score": "Above Target"
  },
  "renewal": {
    "requirements": "60 PDUs every 3 years",
    "renewalUrl": "pmi.org/renew"
  }
}
```

### Achievement Award
```json
{
  "certificate": {
    "title": "Certificate of Achievement",
    "type": "achievement"
  },
  "achievement": {
    "description": "In recognition of outstanding performance",
    "details": "Awarded for exceeding sales targets by 150%"
  },
  "seal": {
    "type": "gold"
  }
}
```

### Academic Diploma
```json
{
  "certificate": {
    "title": "Diploma",
    "type": "completion"
  },
  "issuer": {
    "name": "State University",
    "accreditation": "Accredited by Western Association of Schools and Colleges"
  },
  "achievement": {
    "credential": "Bachelor of Science in Computer Science",
    "level": "Magna Cum Laude"
  },
  "program": {
    "endDate": "May 15, 2025"
  }
}
```

### Membership Certificate
```json
{
  "certificate": {
    "title": "Certificate of Membership",
    "type": "membership"
  },
  "achievement": {
    "description": "Is hereby recognized as a member in good standing",
    "credential": "Senior Member, IEEE"
  },
  "renewal": {
    "requirements": "Annual membership renewal required"
  }
}
```

### Volunteer Recognition
```json
{
  "certificate": {
    "title": "Certificate of Appreciation",
    "type": "achievement"
  },
  "achievement": {
    "description": "In grateful recognition of dedicated volunteer service",
    "details": "100+ hours of community service in 2024"
  },
  "issuer": {
    "name": "Local Food Bank"
  }
}
```

## Tips

1. **Use formal language** - Certificates are official documents
2. **Include verification** - QR codes or URLs add credibility
3. **Show expiration clearly** - Important for professional certs
4. **Use quality visuals** - Seals, badges enhance legitimacy
5. **List specific skills** - Adds value for employers/clients
6. **Include renewal info** - Helps recipients maintain credentials
7. **Proper signatures** - At least one authorized signatory
