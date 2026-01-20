# Letter Template

Formal business letters for professional correspondence and official communications.

## Use Cases

- Job offer letters
- Cover letters
- Recommendation letters
- Termination letters
- Official notices
- Thank you letters
- Complaint letters
- Authorization letters

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `letter.date` | Yes | Letter date |
| `sender.name` | Yes | Sender's name |
| `recipient.name` | Yes | Recipient's name |
| `content.salutation` | Yes | Opening greeting |
| `content.opening` | Yes | First paragraph |
| `content.body` | Yes | Main content paragraphs |
| `content.closing` | Yes | Final paragraph |
| `content.signoff` | Yes | Complimentary close |

## Common Natural Language Modifications

### Header
- "Add our company logo"
- "Include reference number HR-2025-001"
- "Add a subject line about the termination"

### Content
- "Make the tone more formal"
- "Add a paragraph about the probation period"
- "Change the start date to March 1"
- "Include information about relocation assistance"

### Compensation (for offer letters)
- "Increase the base salary to $195,000"
- "Add a 90-day performance review"
- "Include RSU grant of 5,000 shares"

### Closing
- "Change signoff to 'Best regards,'"
- "Add a deadline for response"
- "Include my direct phone number in closing"

### Enclosures
- "Add the NDA to enclosures"
- "Remove the background check form"
- "CC the legal department"

## Letter Types

### Cover Letter
```json
{
  "letter": {
    "subject": "Application for Senior Developer Position"
  },
  "sender": {
    "name": "John Smith",
    "email": "john.smith@email.com",
    "phone": "(555) 123-4567"
  },
  "recipient": {
    "name": "Hiring Manager",
    "organization": "TechCorp Inc.",
    "department": "Engineering"
  },
  "content": {
    "salutation": "Dear Hiring Manager:",
    "opening": "I am writing to express my interest in...",
    "body": ["My experience includes...", "I am particularly excited about..."],
    "closing": "I look forward to discussing...",
    "signoff": "Best regards,"
  }
}
```

### Recommendation Letter
```json
{
  "letter": {
    "subject": "Letter of Recommendation for Sarah Johnson"
  },
  "content": {
    "salutation": "To Whom It May Concern:",
    "opening": "I am writing to recommend Sarah Johnson for...",
    "body": [
      "I have worked with Sarah for three years...",
      "Her key accomplishments include...",
      "Sarah demonstrates exceptional..."
    ],
    "closing": "I recommend Sarah without reservation.",
    "signoff": "Sincerely,"
  }
}
```

### Termination Letter
```json
{
  "letter": {
    "reference": "HR-TERM-2025-042",
    "subject": "Notice of Employment Termination",
    "delivery": "hand-delivered"
  },
  "content": {
    "salutation": "Dear [Employee Name]:",
    "opening": "This letter serves as official notice that your employment with [Company] is terminated effective [Date].",
    "body": [
      "Final paycheck details...",
      "Benefits continuation information...",
      "Return of company property requirements..."
    ],
    "closing": "Please contact HR with any questions.",
    "signoff": "Sincerely,"
  }
}
```

### Thank You Letter
```json
{
  "letter": {
    "type": "semi-formal"
  },
  "content": {
    "salutation": "Dear Ms. Rodriguez:",
    "opening": "Thank you for taking the time to meet with me yesterday regarding the Project Manager position.",
    "body": [
      "I particularly enjoyed learning about...",
      "Our discussion reinforced my enthusiasm for..."
    ],
    "closing": "I look forward to hearing from you.",
    "signoff": "Warm regards,"
  }
}
```

### Authorization Letter
```json
{
  "letter": {
    "subject": "Authorization to Act on Behalf of [Name]"
  },
  "content": {
    "salutation": "To Whom It May Concern:",
    "opening": "I, [Name], hereby authorize [Authorized Person] to act on my behalf in matters relating to [Specific Purpose].",
    "body": [
      "This authorization is valid from [Date] to [Date].",
      "The authorized person may: [List of permissions]",
      "This authorization does not extend to: [Limitations]"
    ],
    "closing": "Please contact me if verification is required.",
    "signoff": "Sincerely,"
  },
  "signature": {
    "showLine": true
  }
}
```

## Tips

1. **Use proper formatting** - Block style is standard for business letters
2. **Be specific in subject lines** - Helps with filing and reference
3. **Include reference numbers** - Essential for legal/HR correspondence
4. **List enclosures clearly** - Recipients know what to expect
5. **Use CC appropriately** - Keep relevant parties informed
6. **Match formality to relationship** - "Dear Dr. Smith" vs "Dear Sarah"
