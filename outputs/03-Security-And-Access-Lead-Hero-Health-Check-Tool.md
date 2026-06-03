# Security And Access Document

## Security Goal

The Lead Hero Health Check Tool must safely analyze HighLevel account data without risking accidental outbound communication or CRM changes.

The most important security rule:

```text
HighLevel is read-only. ClickUp is the only write destination.
```

## Authentication

Users should log in before accessing the app.

Recommended MVP authentication:

- Google login restricted to approved company domains, or
- Email/password with enforced invite-only access

Public signup should not be enabled.

## User Roles

### Admin

Can:

- Manage users
- Add/edit clients
- Add/edit HighLevel PIT tokens
- Add/edit ClickUp task IDs
- Configure routing setup
- Run monthly checks
- Run Blast Analyzer
- Post approved comments to ClickUp
- View audit logs

Cannot:

- Send outbound communication through HighLevel
- Modify contacts, workflows, opportunities, tags, or conversations in HighLevel

### Operator / CAM

Can:

- View assigned clients
- Run monthly checks
- Run Blast Analyzer
- Review generated reports
- Post comments to ClickUp if allowed

Cannot:

- Edit HighLevel tokens unless granted
- Manage users
- Change global settings
- Send outbound communication through HighLevel

### Viewer / Leadership

Can:

- View client health summaries
- View monthly reports
- View blast analysis summaries

Cannot:

- Edit clients
- Run API checks
- Post to ClickUp
- Manage tokens
- Send outbound communication

## HighLevel Access Rules

### Allowed HighLevel Operations

The app may only perform read operations:

- Read contacts
- Read messages/conversations
- Read call records
- Read workflows
- Read opportunities
- Read calendar events
- Read tags
- Read custom fields

### Blocked HighLevel Operations

The app must not include UI, backend routes, API clients, or permissions for:

- Sending SMS
- Sending email
- Placing calls
- Adding contacts to workflows
- Removing contacts from workflows
- Creating contacts
- Updating contacts
- Deleting contacts
- Adding/removing tags
- Creating/updating opportunities
- Creating notes
- Updating workflows
- Triggering automations

### Scope Policy

HighLevel Private Integration Tokens should be created with read-only scopes only.

Recommended read-only categories:

```text
contacts.readonly
conversations.readonly
conversations/message.readonly
workflows.readonly
opportunities.readonly
calendars/events.readonly
locations/tags.readonly
custom-fields.readonly
```

If a write scope is accidentally included in a token, the app still must not expose or call any write endpoint.

## ClickUp Access Rules

ClickUp is the only approved write destination.

Allowed ClickUp operation in MVP:

- Post a comment to the configured client task after user review

Blocked in MVP:

- Creating tasks
- Deleting comments
- Editing task fields
- Moving tasks
- Changing task assignees or status

These can be added later only after explicit approval.

## Secret Handling

### HighLevel PIT Tokens

Private Integration Tokens must:

- Be encrypted before storage
- Never be shown again in plain text after saving
- Never appear in logs
- Never be sent to the browser after initial entry
- Be removable or replaceable by admins

### ClickUp API Token

The ClickUp token should be stored as an environment variable or encrypted secret.

### Encryption

Use a server-side encryption key:

```text
APP_ENCRYPTION_KEY
```

This key must not be committed to code.

## Row-Level Access Rules

If using Supabase or another database with row-level security, apply these rules:

- Users can only read clients assigned to them unless they are admins.
- Only admins can create or edit clients.
- Only admins can manage HighLevel tokens.
- Operators can create monthly checks and blast analyses for assigned clients.
- Viewers can read reports for assigned clients only.
- Audit logs are read-only for non-admins.

## Error Handling

### Invalid HighLevel Token

Show:

```text
HighLevel connection failed. Please check the Private Integration Token and location ID.
```

Do not expose raw token or full API response to the user.

### Missing Read Scope

Show:

```text
This HighLevel token does not have permission to read the required data. Please update the token scopes.
```

Log the missing data category internally.

### ClickUp Posting Failed

Show:

```text
The report was generated but could not be posted to ClickUp. Please check the ClickUp task ID or API connection.
```

Keep the generated comment saved so the user does not lose work.

### No Data Found

Show:

```text
No matching records were found for this client and date range.
```

This should not automatically mean Red. The report should explain what was missing.

### AI Classification Failed

Show:

```text
Blast replies were found, but some could not be classified automatically.
```

Mark those replies as `Needs review`.

## Edge Cases

### No Leads In Selected Date Range

The tool should show zero leads and avoid marking routing as failed purely because no leads came in.

### Staff Notification Contact Missing

Routing check should return incomplete setup, not Red automatically.

### Multiple Staff Contacts

The tool should check all configured staff contacts and show per-contact notification counts.

### Message Phrase Changed

If `New form submission` is missing but workflow messages exist, the tool should warn that the expected phrase may have changed.

### Blast Tag Reused Across Months

The Blast Analyzer must use the selected date range to avoid mixing older replies with the current blast.

### Duplicate ClickUp Posting

If a report was already posted, the app should require confirmation before posting again.

### Slow HighLevel API Response

The app should show progress states and allow retry.

### Partial API Failure

If calls load but contacts fail, the report should clearly show partial results instead of failing silently.

## Audit Logging

The app should log:

- User login
- Client created/updated
- Routing setup changed
- Monthly check generated
- Blast analysis generated
- ClickUp comment posted
- API errors

Logs should never include HighLevel PIT tokens, ClickUp tokens, full message bodies unless needed for evidence, or sensitive contact details beyond IDs/references.

## Data Retention

Recommended MVP policy:

- Keep monthly check reports indefinitely unless deleted by admin.
- Keep blast analysis summaries indefinitely.
- Avoid storing full raw conversations unless necessary.
- Store message IDs and short evidence excerpts instead of entire conversation histories where possible.

## Launch Checklist

- App has authentication enabled.
- Public signup is disabled.
- HighLevel tokens are encrypted.
- No HighLevel write endpoints exist in code.
- ClickUp posting requires user review.
- Audit logs are active.
- Error messages do not expose secrets.
- Test token with write scopes cannot send anything because no write route exists.
