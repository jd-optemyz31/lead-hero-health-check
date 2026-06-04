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
- Disconnect client HighLevel tokens from this tool
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

### Automations Firing Safety Model

Automations Firing is an outcome check. The app reads evidence that HighLevel automations appear to have produced the expected results, but it must not trigger or repair those automations.

Allowed read-only checks:

- Read form-lead contacts by selected date range and configured tag, usually `form lead`.
- Read opportunities for those contacts.
- Check whether an opportunity exists in the configured active pipeline.
- Read staff notification messages containing `New form submission`.
- Read conversation messages to identify whether a contact has sent a first reply.
- If a first reply exists, read the opportunity's current stage and compare it with the configured first-reply stage.

Blocked automation-related actions:

- Do not create the missing opportunity.
- Do not move the opportunity to the reply stage.
- Do not add or remove the form lead tag.
- Do not send or resend the staff notification.
- Do not enroll or re-enroll the contact in a workflow.
- Do not modify the workflow.

If evidence is missing, the tool should report `No` or `Partial` and include the issue in the ClickUp-ready report for human review.

### Scope Policy

HighLevel Private Integration Tokens should be created with read-only scopes only.

Recommended MVP scopes:

```text
contacts.readonly
conversations.readonly
conversations/message.readonly
opportunities.readonly
locations/tags.readonly
locations/customFields.readonly
locations.readonly
```

Optional read-only scopes, only when the related feature is active:

```text
calendars/events.readonly
forms.readonly
locations/tasks.readonly
users.readonly
conversations/reports.readonly
workflows.readonly
```

Do not request write or action scopes for this app. Blocked scope patterns include:

- Any scope ending in `.write`
- Any scope that sends links, messages, documents, or contracts
- Any scope that collects payments
- Any scope that can update live chat state, automations, contacts, tags, workflows, opportunities, or account setup

If a write scope is accidentally included in a token, the app still must not expose or call any write endpoint. The backend HighLevel client should keep a read-only endpoint allowlist so token permissions cannot expand app behavior.

### HighLevel API 2.0 Scope Reference

The following scope list was provided for HighLevel API 2.0 planning. It is a reference list, not an approval list. For this tool, only the recommended read-only scopes above should be requested unless a specific feature justifies another read-only scope.

```text
businesses.readonly
businesses.write
calendars.readonly
calendars.write
calendars/events.readonly
calendars/events.write
calendars/groups.readonly
calendars/groups.write
calendars/resources.readonly
calendars/resources.write
campaigns.readonly
conversations.readonly
conversations.write
conversations/message.readonly
conversations/message.write
conversations/reports.readonly
conversations/livechat.write
contacts.readonly
contacts.write
objects/schema.readonly
objects/schema.write
objects/record.readonly
objects/record.write
associations.write
associations.readonly
associations/relation.readonly
associations/relation.write
courses.write
courses.readonly
forms.readonly
forms.write
invoices.readonly
invoices.write
invoices/schedule.readonly
invoices/schedule.write
invoices/template.readonly
invoices/template.write
invoices/estimate.readonly
invoices/estimate.write
links.readonly
lc-email.readonly
links.write
locations.readonly
locations/customValues.readonly
locations/customValues.write
locations/customFields.readonly
locations/customFields.write
locations/tasks.readonly
locations/tasks.write
recurring-tasks.readonly
recurring-tasks.write
locations/tags.readonly
locations/tags.write
locations/templates.readonly
medias.readonly
medias.write
funnels/redirect.readonly
funnels/page.readonly
funnels/funnel.readonly
funnels/pagecount.readonly
funnels/redirect.write
opportunities.readonly
opportunities.write
payments/orders.readonly
payments/orders.write
payments/orders.collectPayment
payments/integration.readonly
payments/integration.write
payments/transactions.readonly
payments/subscriptions.readonly
payments/coupons.readonly
payments/coupons.write
payments/custom-provider.readonly
payments/custom-provider.write
products.readonly
products.write
products/prices.readonly
products/prices.write
products/collection.readonly
products/collection.write
saas/location.read
saas/location.write
socialplanner/oauth.readonly
socialplanner/oauth.write
socialplanner/post.readonly
socialplanner/post.write
socialplanner/account.readonly
socialplanner/account.write
socialplanner/csv.readonly
socialplanner/csv.write
socialplanner/category.readonly
socialplanner/tag.readonly
socialplanner/statistics.readonly
store/shipping.readonly
store/shipping.write
store/setting.readonly
store/setting.write
surveys.readonly
users.readonly
users.write
workflows.readonly
emails/builder.write
emails/builder.readonly
emails/schedule.readonly
emails/schedule.write
wordpress.site.readonly
blogs/post.write
blogs/post-update.write
blogs/check-slug.readonly
blogs/category.readonly
blogs/author.readonly
socialplanner/category.write
socialplanner/tag.write
blogs/posts.readonly
blogs/list.readonly
brand-boards/design-kit.readonly
brand-boards/design-kit.write
brand-boards/voices.readonly
brand-boards/voices.write
chat-widget.readonly
chat-widget.write
charges.readonly
charges.write
marketplace-installer-details.readonly
twilioaccount.read
phonenumbers.read
phonenumbers.write
numberpools.read
documents_contracts/list.readonly
documents_contracts/sendLink.write
documents_contracts_template/sendLink.write
documents_contracts_template/list.readonly
voice-ai-dashboard.readonly
voice-ai-agents.readonly
voice-ai-agents.write
voice-ai-agent-goals.readonly
voice-ai-agent-goals.write
knowledge-bases.write
knowledge-bases.readonly
conversation-ai.readonly
conversation-ai.write
agent-studio.readonly
agent-studio.write
adPublishing.readonly
adPublishing.write
```

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

Edit behavior:

- Admins may edit client connection details such as timezone, location ID, ClickUp task ID, and automation-flow settings.
- When editing an existing client, leaving the PIT field blank must preserve the existing encrypted token.
- Entering a new PIT replaces the saved encrypted token.
- The frontend must never pre-fill, reveal, or return the existing plaintext PIT.
- Editing client metadata must not call HighLevel or modify the client's HighLevel account.

Disconnect behavior:

- Admins may disconnect a client from HighLevel inside this tool.
- Disconnecting must only clear the encrypted PIT and token preview from the app database.
- Disconnecting must not call HighLevel, revoke tokens through HighLevel, delete contacts, update account settings, or change any client CRM data.
- Existing reports, routing setup, ClickUp task IDs, and client metadata should remain available.
- After disconnecting, live HighLevel checks should be disabled until a new read-only PIT is saved.

### ClickUp API Token

The ClickUp token should be stored as an environment variable or encrypted secret.

### OpenAI / OpenRouter API Key And AI Data Boundary

The OpenAI or OpenRouter API key is an app-wide server secret. Store it only in Railway variables or another approved secret manager:

```text
AI_PROVIDER
OPENROUTER_API_KEY
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

AI classification is allowed only for Blast Analyzer reply analysis. The browser must never receive `OPENROUTER_API_KEY` or `OPENAI_API_KEY`, and users must not paste or store either key in client records.

AI requests may include:

- The selected blast message phrase or short blast context.
- The single reply text excerpt needed for classification.

AI requests must not include:

- HighLevel Private Integration Tokens.
- ClickUp API tokens.
- Supabase service role keys.
- `APP_ENCRYPTION_KEY`.
- `OPENROUTER_API_KEY` or `OPENAI_API_KEY`.
- Full client exports when a single reply excerpt is enough.
- Any instruction to send a message, update a contact, add/remove tags, move an opportunity, or trigger a workflow.

AI provider failures, timeouts, invalid JSON, and missing API keys should fall back to local rules. Ambiguous or low-confidence AI results should be marked `Needs review` and reviewed by a human before being included in a monthly ClickUp comment.

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
- `AI_PROVIDER`
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
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
- Client HighLevel connection disconnected
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
- OpenAI or OpenRouter classification, if enabled, receives only minimal reply excerpts and never receives PITs, app secrets, or ClickUp tokens.
- Test token with write scopes cannot send anything because no write route exists.
