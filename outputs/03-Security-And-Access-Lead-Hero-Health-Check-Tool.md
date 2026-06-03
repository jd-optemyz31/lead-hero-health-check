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

- Supabase Auth with Google login restricted to approved company domains, or
- Supabase Auth email/password with enforced invite-only access

Public signup should not be enabled.

Supabase Auth is the preferred MVP option if the app also uses Supabase Postgres. It keeps authentication, database identity, and Row-Level Security in one stack. Use Supabase Auth for login and session management, then enforce app roles in the database and backend.

Required authentication settings:

- Disable public signup unless explicitly approved.
- Require invite-only users or approved company-domain Google login.
- Require MFA for Admin users before production client data is added.
- Keep Admin, Operator / CAM, and Viewer roles server-enforced; do not rely on frontend-only role checks.
- Set short session lifetimes or enforced re-authentication for sensitive actions such as adding/replacing HighLevel PIT tokens.
- Never expose Supabase service role keys to the browser.

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

Client-specific HighLevel PITs should be entered through an authenticated Admin-only Clients screen. They should not be hardcoded, committed to Git, stored in frontend files, or placed in Railway environment variables per client. Railway variables are for app-wide secrets only.

Recommended production storage:

- Store the client record in Postgres.
- Store `ghl_private_integration_token_encrypted` only, never plaintext.
- Encrypt before writing to the database using `APP_ENCRYPTION_KEY`.
- Decrypt only on the server at the moment a read-only HighLevel API request is made.
- Return only `hasToken` and a short token preview to the browser.
- Log token create/replace/remove events without logging the token value.

### ClickUp API Token

The ClickUp token should be stored as an environment variable or encrypted secret.

### Encryption

Use a server-side encryption key:

```text
APP_ENCRYPTION_KEY
```

`APP_ENCRYPTION_KEY` is the master secret the server uses to encrypt and decrypt stored client-level secrets, especially HighLevel Private Integration Tokens. It is not a HighLevel key, ClickUp key, or OpenAI key. It is an app-owned encryption secret.

Production requirements:

- Store `APP_ENCRYPTION_KEY` only in Railway environment variables or another approved secret manager.
- Do not commit it to code, `.env.example`, logs, screenshots, docs, or support tickets.
- Generate it as a long random secret, at least 32 bytes of entropy. A 64-character hex string from a cryptographic random generator is acceptable.
- Keep the same value across deploys. If it changes, existing encrypted HighLevel PITs cannot be decrypted.
- Rotate it only with a planned re-encryption process: decrypt existing tokens with the old key, encrypt with the new key, then remove the old key.
- Use separate encryption keys for development, staging, and production.

Example generation command:

```bash
openssl rand -hex 32
```

For the current Node implementation, the app hashes `APP_ENCRYPTION_KEY` into an AES-256-GCM key. AES-GCM provides authenticated encryption, so tampered ciphertext fails to decrypt.

## Railway Secret Policy

Railway variables should store app-wide secrets and configuration only:

- `APP_ENCRYPTION_KEY`
- `DATABASE_URL`
- `CLICKUP_API_TOKEN`
- `OPENAI_API_KEY`
- `HIGHLEVEL_API_VERSION`
- `AUTH_SECRET`
- `AUTH_REQUIRED`
- `ADMIN_EMAILS`
- Supabase project URL and anon key if Supabase Auth is used
- Supabase service role key only if needed by server-side code, never exposed to the browser

Do not store one Railway variable per client HighLevel PIT. Client PITs belong in the encrypted database field managed by the app.

For the current MVP, set `AUTH_REQUIRED=true` in Railway. `SUPABASE_SERVICE_ROLE_KEY` must be available only to server-side code and must never be exposed through frontend JavaScript or any `NEXT_PUBLIC_` variable. `ADMIN_EMAILS` should contain only trusted internal admin email addresses and is used for initial admin access before app users are fully managed in the database.

## Row-Level Access Rules

If using Supabase or another database with row-level security, apply these rules:

- Users can only read clients assigned to them unless they are admins.
- Only admins can create or edit clients.
- Only admins can manage HighLevel tokens.
- Operators can create monthly checks and blast analyses for assigned clients.
- Viewers can read reports for assigned clients only.
- Audit logs are read-only for non-admins.

Supabase Row-Level Security should be enabled on all production tables containing client data, tokens, reports, evidence, audit logs, or user-role mappings. The backend should still enforce authorization checks even when RLS is enabled.

Minimum table policy expectations:

- `clients`: Admins can create/update; assigned users can read limited client metadata; encrypted token fields should not be selected by browser-facing queries.
- `routing_setups`: Admins can create/update; assigned Operators can read.
- `monthly_checks` and `blast_analyses`: assigned Operators can create/read; Viewers can read; only allowed roles can post reviewed reports.
- `api_audit_logs`: insert from server only; read by Admin only.
- Token fields: server-side access only. Do not expose encrypted tokens to frontend queries just because they are encrypted.

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
- Supabase schema in `supabase/schema.sql` has been applied.
- `AUTH_REQUIRED=true` is set in Railway.
- `ADMIN_EMAILS` contains the initial trusted admin account only.
- Supabase service role key is server-only and never sent to the browser.
- HighLevel tokens are encrypted.
- No HighLevel write endpoints exist in code.
- ClickUp posting requires user review.
- Audit logs are active.
- Error messages do not expose secrets.
- Test token with write scopes cannot send anything because no write route exists.
