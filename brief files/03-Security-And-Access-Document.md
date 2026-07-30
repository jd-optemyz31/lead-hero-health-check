# Security and Access Document

## Product

Lead Hero Health Check Tool

## Document Status

- Updated: July 31, 2026
- Applies to the current plain Node.js and Supabase implementation
- HighLevel safety is a non-negotiable product boundary

## Security Goal

The tool must analyze client account evidence without creating a path for accidental customer communication, CRM mutation, credential exposure, or cross-client result confusion.

```text
HighLevel is strictly read-only.
ClickUp reviewed comments are the only approved external business write.
```

## Threat Model

Primary risks:

- An over-scoped HighLevel token being used to mutate the CRM.
- A PIT, service key, password, session, or raw conversation being logged or returned.
- A frontend-only permission check being bypassed.
- An inactive, unprovisioned, or incorrectly mapped user gaining access.
- The last active Admin being removed.
- A long-running Blast job exposing another user's or client's data.
- A partial large-account scan being presented as complete.
- AI receiving more contact data than required.
- One client's saved Blast result remaining visible after another client is selected.
- A report being posted to ClickUp without review.

## Authentication

### Identity provider

Supabase Auth provides email/password identity. Public signup is disabled.

The application exposes:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/password-change
```

The application does not expose:

- Signup
- Email invitation
- Forgot-password request
- Recovery-link completion
- Temporary-password generation

### Session

- The server stores the Supabase access token in an HTTP-only `lh_session` cookie.
- The cookie uses `SameSite=Lax`.
- Production must enable `Secure` cookies and HTTPS.
- Each protected request validates the Auth token.
- The server resolves role and active status from `app_users` on every request.
- Auth metadata is not an authorization source.

### Reauthentication

The acting user's current password is required for:

- Self-service password change
- Manual user creation
- Admin-managed password reset

This limits sensitive account actions when an unattended session is available.

### Password rules

- Minimum 12 characters
- Maximum 128 characters
- Confirmation must match
- A self-service new password must differ from the current password
- Passwords go directly from the request to Supabase Auth administration
- Passwords are never stored in application tables
- Passwords are never returned, redisplayed, audited, or logged

After a self-service change, the server signs out the current Auth token, clears the cookie, and requires a fresh login.

An Admin-managed reset updates the target Auth account. It does not guarantee immediate invalidation of every already-issued target access token; the configured Auth token lifetime bounds that exposure.

### Recovery boundary

- A locked-out User contacts an Admin.
- An Admin cannot reset themselves through the managed-reset control; they use self-service while signed in.
- A locked-out sole Admin requires an authorized Supabase operator to recover the account outside the tool.
- MFA is not implemented.
- Leaked-password protection remains unavailable under the current Supabase Free-plan limitation and must not be represented as enabled.

## Authorization

## Roles

### Admin

Can:

- Access and manage every client.
- Run routing, monthly, and blast operations.
- Post a reviewed monthly comment to ClickUp.
- Read the safe user directory.
- Create users manually.
- Change another user's role or active state.
- Reset another active user's password.
- Read sanitized security audit events.

### User

Can:

- Access and manage every client.
- Run routing, monthly, and blast operations.
- Post a reviewed monthly comment to ClickUp.
- Change their own password.

Cannot:

- Read the user directory.
- Create, reactivate, deactivate, or change users.
- Reset another user's password.
- Read security audit events.

Both roles remain prohibited from all HighLevel writes.

Legacy `operator` and `viewer` application roles are migrated to `user`. They are not active authorization roles in the current product.

## Server enforcement

- The frontend hides controls the user cannot use.
- Every API route repeats the relevant role check.
- Client access is global for active Admin and User accounts.
- Existing `client_assignments` rows do not grant or restrict access.
- Admin can read any background job.
- User can read only a job they started and only for an accessible client.

## Admin-management guards

- Emails listed in `ADMIN_EMAILS` are environment-managed/bootstrap Admins.
- An environment-managed Admin cannot be demoted or deactivated in the application.
- An Admin cannot change their own role or active state.
- Another Admin must perform those actions.
- The server blocks any mutation that would remove the last active Admin.
- A database trigger uses a transaction-scoped advisory lock and repeats the last-Admin guard for concurrent changes.
- Permanent account deletion is not provided.

## Safe user projections

The directory may return:

- Auth user ID
- Email
- Application role
- Active/provisioned/status flags
- Protected-Admin flag
- Created timestamp
- Last sign-in timestamp

It must not return:

- Password data or hashes
- Access or refresh tokens
- Sessions
- IP addresses
- Auth metadata
- Service-role data

## Supabase Access Controls

### Current hardening

- RLS is enabled on application tables.
- Browser `anon` and `authenticated` roles have no direct application-table privileges.
- `service_role` is used only by the Node server.
- Application authorization is still enforced before server-side data access.
- Private helper functions resolve the current app role and client access.
- Public signup is disabled.

### Table policy intent

- `app_users`: self/Admin read semantics in RLS; Admin write semantics; application server remains the active data path.
- `clients`, `routing_setups`, `blast_analyses`, and `monthly_reports`: active Admin/User global client access.
- `client_assignments`: retained for history and Admin maintenance, not authorization.
- `api_audit_logs`: Admin read only; server writes.
- Encrypted token fields: server only and removed from browser projections.

### Migration discipline

- Apply ordered files in `supabase/migrations/` through an approved workflow.
- Treat `supabase/schema.sql` as a review mirror, not the production apply command.
- Keep reversal migrations for reviewed rollback planning.
- Do not apply migrations or change live Auth settings without explicit approval.

## HighLevel Security Boundary

### Allowed reads

- Contacts
- Conversations and messages
- Opportunities
- Workflow metadata where exposed
- Tags and custom fields through supported reads
- Call evidence through message export
- Calendar or form evidence only if a future approved feature and read scope require it

### Prohibited actions

The application must not have a UI control, route, or API client that can:

- Send SMS
- Send email
- Place calls
- Create, update, or delete contacts
- Add or remove tags
- Add contacts to or remove contacts from workflows
- Trigger or edit workflows
- Create or update opportunities
- Create notes
- Modify account settings
- Initiate payment or document actions

### Defense in depth

1. Request the smallest read-only PIT scopes.
2. Encrypt the PIT in application storage.
3. Decrypt only in the server process.
4. Route every HighLevel call through the central adapter.
5. Reject methods and paths outside the explicit read allowlist.
6. Never expose a generic proxy endpoint.
7. Never infer permission to write from an over-scoped token.

### Approved server allowlist

```text
GET  /contacts/
POST /contacts/search
GET  /conversations/search
GET  /conversations/messages/export
GET  /opportunities/search
POST /opportunities/search
GET  /workflows
GET  /workflows/
```

HighLevel POST methods are allowed only where the documented API uses POST for a search operation. They remain read-only searches.

## Client Secret Handling

### HighLevel PIT

- Required when a new live client is created.
- Encrypted with AES-256-GCM using a key derived from `APP_ENCRYPTION_KEY`.
- Stored only as authenticated ciphertext plus a short non-sensitive preview.
- Never returned in plaintext.
- Never prefilled in the edit form.
- Blank edit value preserves the ciphertext.
- Replacement creates new ciphertext.
- Disconnect deletes the application's ciphertext and preview only.
- Disconnect does not call or revoke anything in HighLevel.

### App-wide secrets

Server-only values include:

- `APP_ENCRYPTION_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLICKUP_API_TOKEN`
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`

Requirements:

- Keep them in `.env` locally or an approved production secret manager.
- Keep `.env` out of Git.
- Never print them in command output, logs, screenshots, documentation, errors, or audit events.
- Restart Node after an environment change.
- Keep the encryption key stable or perform an approved re-encryption migration.

## Blast Analyzer Data Security

### Data minimization

The server may send the AI provider only:

- The distinctive matching phrase
- The actual matched outbound blast
- Structured messages from that blast onward inside the selected date range
- Direction, timestamp, channel, and bounded text

The complete post-blast conversation is required for correct intent analysis, but it remains an in-memory request payload. The application does not write a raw-conversation JSON file.

### Excluded AI data

Never send:

- HighLevel PITs
- Supabase keys
- ClickUp tokens
- Encryption keys
- AI API keys
- DND metadata
- Messages before the matched blast
- Conversation history outside the selected range
- Unrelated contacts or account exports
- Instructions to mutate HighLevel

### Deterministic pre-classification rules

Before AI:

- Overall HighLevel DND produces Opt-out.
- Active/permanent DND for the matched channel produces Opt-out.
- Standalone `STOP` or an unambiguous stop-contact instruction produces Opt-out.
- Normal language such as `stop by tomorrow` is not an opt-out.

DND is read only and is never changed by the application.

### Anchor requirement

The application must match the required phrase to an outbound message before classification. If no match exists:

- Do not call AI for an unanchored thread.
- Do not persist raw conversation text.
- Return a sanitized `Not analyzed — No blast match` diagnostic row.

### AI failure

An unavailable, timed-out, or invalid AI response uses local conversation rules. The UI identifies the fallback method. It must not expose provider response internals or keys.

## Large-account Integrity

The fallback contact scan may inspect at most 50,000 contacts with read-only cursor pagination.

The analysis fails rather than returns partial success when:

- The 500-page ceiling is reached.
- A full page lacks a next cursor.
- A cursor repeats.
- Required pagination state is malformed.

This is a data-integrity control, not only a performance setting.

## Background-job Security

Job records may contain:

- Job ID
- Owning user ID
- Client ID
- Running/done/error state
- Safe phase and detail
- Percentage
- Aggregate counts
- Completed sanitized analysis

Progress fields must not contain:

- Contact names
- Message text
- Raw conversation payloads
- Tokens, keys, passwords, or sessions

Job IDs must be validated, and job-read authorization must be enforced.

The current job store is an ephemeral local filesystem directory. Production multi-instance hosting requires a durable shared job store with equivalent access controls.

## Client-result Isolation

Even though both roles can access every client, the UI must not confuse contexts:

- Filter saved Blast analyses by selected `clientId`.
- Ignore an active result from a different client.
- Lock the client selector while a submitted job runs.
- Restore the submitted client on completion.
- Display a client-specific empty state when no result exists.

This prevents accidental operational decisions based on another client's analysis.

## ClickUp Boundary

Allowed:

- Post the user-reviewed generated monthly comment to the configured task.

Blocked:

- Create or delete tasks.
- Edit task fields.
- Change status or assignee.
- Move tasks.
- Delete or edit comments.

The UI requires review and confirmation. Posting failures retain the saved report.

## Audit Logging

Audit events include:

- Authentication attempts
- User creation and mutation
- Password changes and resets
- Client create/update/disconnect
- Routing changes
- Monthly and Blast generation
- HighLevel read failures
- ClickUp post success/failure
- Blocked security-sensitive actions

Audit messages are sanitized and never include:

- Passwords
- PITs
- API or service keys
- Cookies or Auth tokens
- IP addresses
- Raw conversations
- Full provider error bodies

## User-facing Error Policy

Errors must be actionable but sanitized.

Examples:

```text
HighLevel connection failed. Please check the Private Integration Token and location ID.
```

```text
This HighLevel token does not have permission to read the required data.
```

```text
The report was generated but could not be posted to ClickUp.
```

```text
The contact scan could not be completed safely; no partial analysis was saved.
```

Do not return raw upstream responses when they might contain identifiers, request details, or secrets.

## Required Edge-case Behavior

### No leads in range

Show zero leads. Do not mark routing failed only because there was nothing to route.

### Missing staff notification contact

Return incomplete setup and a corrective prompt; do not manufacture a Red result from absent configuration.

### Multiple staff contacts

Check every configured contact and show separate aggregate evidence where practical.

### Expected routing phrase changed

If messages exist but `New form submission` is absent, warn that the expected phrase may have changed.

### Blast tag reused

Use the selected message date range and mandatory outbound anchor so older replies are not mixed into the current blast.

### Ambiguous stop language

`STOP` or an unambiguous stop-contact instruction is Opt-out. `Sounds good. I'll stop by tomorrow.` is not an opt-out.

### Different-service question

A customer asking only about another service is Neutral toward the analyzed promotion unless the wider anchored conversation clearly accepts or rejects that promotion.

### Duplicate ClickUp posting

Require confirmation before every post and clearly show existing Posted state. Do not silently repeat an external write.

### Slow HighLevel response

For Blast analysis, use the background-job progress experience. Other checks must show a loading state and return partial evidence safely when the product rule permits.

### Partial upstream failure

State which evidence category is unavailable. Never silently interpret missing calls, contacts, messages, or opportunities as healthy.

### AI classification failure

Use the bounded local conversation rules where possible and label the method. Use Needs review only for genuinely unusable or irreconcilable evidence.

### Blast result from another client

Reject it from the selected client's result area even though the signed-in role has global client permission.

## Data Retention

Current direction:

- Keep monthly report summaries and Blast analysis summaries until an approved deletion policy exists.
- Preserve audit events according to the approved internal retention policy.
- Do not persist raw conversation exports.
- Store bounded evidence excerpts, message references, counts, and summaries.
- Do not offer permanent user deletion in this release.
- Clearing a loaded Blast result changes frontend state only; it does not delete the saved analysis.

Before production, approve exact retention periods, deletion authority, and backup behavior.

## Operational Checklist

- `AUTH_REQUIRED=true` for the authenticated environment.
- Public signup disabled in Supabase.
- No application signup or email-recovery route.
- `ADMIN_EMAILS` contains only approved bootstrap Admins.
- Service-role and AI/ClickUp keys remain server-only.
- HighLevel PITs use read-only scopes and encrypted storage.
- HighLevel adapter allowlist contains no mutation endpoint.
- RLS enabled and browser table privileges revoked.
- Password actions require confirmation and reauthentication.
- At least one active Admin is protected at server and database layers.
- Job progress contains aggregate safe data only.
- Blast phrase is mandatory and unanchored threads are not classified.
- Partial large-account scans fail closed.
- ClickUp comments require review and confirmation.
- MFA and leaked-password protection are not falsely claimed.
- Live migrations, Auth changes, emails, pushes, and deployment require explicit approval.

## Current Validation Boundary

The security design and HighLevel read-only boundary are implemented locally. Blast-specific access, pagination, anchoring, and progress controls have received recent automated and local testing.

Routing, lead-flow, Monthly Check, and live ClickUp posting are implemented but remain scheduled for deeper end-to-end acceptance testing. Their existence must not be treated as proof of production readiness.
