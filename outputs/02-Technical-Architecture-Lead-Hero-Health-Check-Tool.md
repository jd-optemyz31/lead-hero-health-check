# Technical Architecture Document

## Product Name

Lead Hero Health Check Tool

## Architecture Summary

The tool is a private internal web app that reads data from HighLevel through Private Integration Tokens, analyzes account health, stores reports in its own database, and posts reviewed comments to ClickUp.

HighLevel is treated as a read-only evidence source. The app must not send outbound communication or mutate CRM records.

```text
User
  |
Web App
  |
Backend API
  |
Database
  |
HighLevel API (read-only)
ClickUp API (write comments)
AI Classification Service (blast reply analysis)
```

## Recommended Tech Stack

### Frontend

Next.js with React and TypeScript.

Reason:

- Good for internal dashboards
- Supports server-side API routes if needed
- Strong ecosystem for forms, tables, and authenticated apps

### Backend

Next.js API routes or a separate Node.js/TypeScript backend.

For MVP, a single Next.js app is enough. If the tool grows into scheduled jobs and heavier processing, the backend can be split later.

### Database

Postgres.

Recommended hosted option: Supabase Postgres for the production MVP.

Reason:

- Structured client/report data
- Good relational model
- Easy querying for reports, blast analyses, and audit history
- Supabase Auth can share identity context with Supabase Row-Level Security

### ORM

Prisma.

Reason:

- Clear schema
- Type-safe database access
- Easy migrations

### Authentication

Supabase Auth is the recommended production MVP choice if Supabase Postgres is used.

Use Google login restricted to approved company domains or invite-only email/password. Public signup should stay disabled. Admin users should use MFA before real client data or HighLevel PIT tokens are stored.

Reason:

- Auth and Postgres live in the same platform.
- Supabase Auth integrates cleanly with Postgres Row-Level Security.
- User identity can be tied to client assignments, user roles, report access, and audit logs.

Auth alternatives such as Clerk or Auth.js are still viable, but they add more integration work if the database uses Supabase RLS.

### AI Reply Classification

OpenAI API or another approved LLM provider.

Used only for analyzing conversation replies, not for sending messages.

Current MVP implementation:

- The Node server calls the OpenAI Responses API from the backend only.
- `OPENAI_API_KEY` and `OPENAI_MODEL` are Railway/server variables and are never sent to the browser.
- The request uses a strict JSON schema for `classification`, `summary`, `evidence`, `confidence`, and `reviewStatus`.
- The only allowed labels are `Positive`, `Neutral`, `Negative`, `Opt-out`, and `Needs review`.
- Only the minimal reply text needed for classification and optional blast context should be sent to the AI service; HighLevel PITs, ClickUp tokens, Supabase keys, and full account exports must never be sent.
- If OpenAI is not configured, times out, or returns an invalid response, the app falls back to the local rule-based classifier and marks the method as `Rules` or `Rules fallback`.
- The default OpenAI model is `gpt-5.4-nano`, chosen for high-volume classification and extraction-style work. Use the OpenAI API model ID directly; do not include provider prefixes such as `openai/`.

### Hosting

Vercel for the web app.

Background jobs can use:

- Vercel Cron for simple scheduled checks
- Trigger.dev, Inngest, or a queue worker if checks become long-running

## HighLevel Integration

### Authentication

Use HighLevel Private Integration Token per client/location.

Required request headers:

```http
Authorization: Bearer <PRIVATE_INTEGRATION_TOKEN>
Version: 2021-07-28
Content-Type: application/json
```

Some endpoints may use newer versions, but the app should centralize the HighLevel API version in config.

Client-specific HighLevel Private Integration Tokens should be entered through an Admin-only Clients screen and stored encrypted in Postgres. They should not be stored in code, frontend files, Git, or Railway variables. Railway variables are for app-wide secrets, not per-client PITs.

### HighLevel Access Boundary

Allowed:

- Read contacts
- Read conversations/messages
- Read workflows
- Read opportunities
- Read calendar events
- Read tags/custom fields
- Read call records

Not allowed:

- Send SMS
- Send email
- Place calls
- Add contacts to workflows
- Create/update/delete contacts
- Add/remove tags
- Create/update opportunities
- Edit workflows
- Trigger automations

### Recommended Read-Only Scopes

HighLevel Private Integration Tokens should use the smallest possible read-only scope set. For the current Lead Hero Health Check Tool, request these scopes first:

```text
contacts.readonly
conversations.readonly
conversations/message.readonly
opportunities.readonly
locations/tags.readonly
locations/customFields.readonly
locations.readonly
```

Add these only if the related feature is actively used:

```text
calendars/events.readonly
forms.readonly
locations/tasks.readonly
users.readonly
conversations/reports.readonly
workflows.readonly
```

Do not request `.write`, `collectPayment`, `sendLink`, or outbound-communication scopes for this app. The backend must also keep its HighLevel API client allowlisted to read-only endpoints so an over-scoped PIT still cannot mutate HighLevel data.

## ClickUp Integration

### Authentication

Use ClickUp API token or OAuth depending on the account setup.

### Required Action

Post a comment to a configured ClickUp task.

### Stored Per Client

- ClickUp task ID
- Optional ClickUp workspace/list/folder metadata

## Database Schema

### users

Stores app users.

Fields:

- id
- name
- email
- role
- created_at
- updated_at

### clients

Stores each Lead Hero client/account.

Fields:

- id
- name
- ghl_location_id
- ghl_private_integration_token_encrypted
- ghl_private_integration_token_preview
- clickup_task_id
- timezone
- form_lead_tag
- active_pipeline_name
- active_pipeline_id
- reply_stage_name
- reply_stage_id
- reply_stage_window_hours
- status
- created_at
- updated_at

Notes:

- `ghl_private_integration_token_encrypted` is server-only and must never be sent to the browser.
- The browser may receive `hasToken` and a short non-sensitive preview only.
- Token replacement should be logged in `api_audit_logs` without logging the token value.
- Disconnecting a client clears `ghl_private_integration_token_encrypted` and `ghl_private_integration_token_preview` in the app database. It does not call HighLevel and does not revoke the token inside HighLevel.

### Client Connection API

Admin-only routes:

```text
POST /api/clients
POST /api/clients/disconnect
POST /api/highlevel/test
```

`POST /api/clients/disconnect` removes the stored HighLevel token from this tool so future live HighLevel reads are disabled for that client until a new token is saved. It must not call a HighLevel revoke, delete, or account-management endpoint.

`POST /api/clients` also handles edits when an existing client ID is provided. Editable fields include client name, timezone, HighLevel location ID, ClickUp task ID, form lead tag, active pipeline name/ID, first-reply stage name/ID, and reply movement window. The PIT token is required only when creating a new client or replacing a disconnected token. On edit, a blank PIT preserves the existing encrypted token.

The frontend should use a timezone selector backed by IANA timezone IDs. Browsers that support `Intl.supportedValuesOf("timeZone")` can provide the full list without hardcoding it.

### routing_setups

Stores routing audit settings per client.

Fields:

- id
- client_id
- staff_contact_id
- staff_phone_number
- expected_phrase
- expected_delay_minutes
- active
- created_at
- updated_at

Notes:

- One client can have multiple staff notification contacts.
- Default expected phrase is `New form submission`.

### monthly_checks

Stores monthly or custom date-range health reports.

Fields:

- id
- client_id
- date_start
- date_end
- status
- routing_working
- automations_firing
- attribution_intact
- leads_received
- calls_answered
- calls_missed
- blast_summary_id
- issues
- next_month_focus
- generated_comment
- posted_to_clickup
- clickup_comment_id
- created_by_user_id
- created_at
- updated_at

### monthly_check_evidence

Stores supporting evidence for a monthly check.

Fields:

- id
- monthly_check_id
- evidence_type
- source
- summary
- raw_reference
- created_at

Example evidence types:

- routing_message_count
- attribution_coverage
- call_summary
- workflow_status
- blast_summary

### blast_analyses

Stores standalone blast analysis runs.

Fields:

- id
- client_id
- date_start
- date_end
- reply_tag
- workflow_name_or_id
- message_phrase
- total_replied_contacts
- positive_count
- negative_count
- neutral_count
- opt_out_count
- needs_review_count
- summary
- created_by_user_id
- created_at
- updated_at

### blast_reply_classifications

Stores per-contact blast reply analysis.

Fields:

- id
- blast_analysis_id
- contact_id
- contact_name
- conversation_id
- classification
- summary
- evidence_message_ids
- confidence
- analysis_method
- review_status
- created_at

Classifications:

- positive
- negative
- neutral
- opt_out
- needs_review

### api_audit_logs

Stores internal app audit events.

Fields:

- id
- user_id
- client_id
- action
- target_type
- target_id
- status
- message
- created_at

Examples:

- monthly_check_generated
- blast_analysis_generated
- clickup_comment_posted
- highlevel_api_error

## Folder Structure

```text
src/
  app/
    clients/
    routing-setup/
    blast-analyzer/
    monthly-check/
    reports/
    settings/
  components/
    layout/
    forms/
    tables/
    status/
    charts/
  lib/
    highlevel/
      client.ts
      contacts.ts
      conversations.ts
      workflows.ts
      calls.ts
    clickup/
      client.ts
      comments.ts
    ai/
      classifyBlastReply.ts
    db/
      prisma.ts
    security/
      encryption.ts
      permissions.ts
  server/
    services/
      routingCheckService.ts
      monthlyCheckService.ts
      blastAnalysisService.ts
      clickupPostingService.ts
    jobs/
      monthlyCheckJob.ts
  prisma/
    schema.prisma
  styles/
```

## Core Services

### routingCheckService

Responsibilities:

- Pull new leads for the selected date range
- Pull outbound workflow messages to staff notification contacts
- Match messages containing `New form submission`
- Calculate routing status

### monthlyCheckService

Responsibilities:

- Pull leads received
- Check routing evidence
- Check automation outcomes from form-lead contacts, active-pipeline opportunities, staff notifications, and first-reply stage movement
- Check workflow metadata where the scope is available
- Check attribution coverage
- Pull call records
- Attach selected blast analysis
- Generate Green/Yellow/Red status
- Generate ClickUp comment text

### automationsFiring outcome check

The app does not inspect HighLevel workflow nodes. It infers whether the lead-flow automations are firing by reading visible outcomes:

- Contact search finds new contacts in the selected date range with the configured form lead tag, usually `form lead`.
- Opportunity search checks whether each form-lead contact has an opportunity in the configured active pipeline.
- Conversation/message export checks whether staff notification messages were sent to configured staff contact(s) with the `New form submission` phrase.
- Conversation/message export checks whether the contact sent a first reply.
- If a first reply exists, opportunity search checks whether the contact's opportunity is now in the configured first-reply stage.

Read-only HighLevel endpoints used for this outcome check:

```text
POST /contacts/search
GET /conversations/messages/export
POST /opportunities/search
GET /opportunities/search
```

The first-reply stage check is conditional. If a form lead has not replied, the tool should not mark the reply-stage movement as failed.

### blastAnalysisService

Responsibilities:

- Search contacts by reply tag and date range where supported
- Pull conversations for matching contacts
- Identify relevant replies
- Classify replies with AI when configured, with a local rules fallback
- Store classification, confidence, evidence, method, and review status
- Save analysis results

For live blast analysis, do not use contact creation date as the primary date filter. Search candidate contacts by the configured reply tag, then apply `dateStart` and `dateEnd` to inbound conversation messages so older contacts who replied during the blast window are included.

### clickupPostingService

Responsibilities:

- Post final comment to ClickUp task
- Store ClickUp comment ID
- Prevent duplicate posting unless user confirms

## Environment Variables

```text
DATABASE_URL=
APP_ENCRYPTION_KEY=
CLICKUP_API_TOKEN=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-nano
HIGHLEVEL_API_VERSION=2021-07-28
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_REQUIRED=true
ADMIN_EMAILS=
NEXT_PUBLIC_APP_URL=
AUTH_SECRET=
```

`APP_ENCRYPTION_KEY` is the app-owned master encryption secret used by the server to encrypt and decrypt stored client-level secrets, especially HighLevel Private Integration Tokens. It must be generated as a long random value, stored only in Railway variables or another approved secret manager, and kept stable across deploys so existing encrypted tokens remain decryptable.

Client-specific HighLevel PITs should be encrypted in the database, not stored as plain text environment variables and not stored as one Railway variable per client.

Railway variable guidance:

- Store app-wide secrets in Railway: `APP_ENCRYPTION_KEY`, `DATABASE_URL`, `CLICKUP_API_TOKEN`, `OPENAI_API_KEY`, `AUTH_SECRET`, and Supabase server-side credentials.
- Do not store client HighLevel PITs in Railway variables.
- Do not expose server-only secrets through any `NEXT_PUBLIC_` variable.
- Use separate Railway environments and separate secrets for development, staging, and production.

Current MVP implementation note:

- The plain Node server validates users through Supabase Auth and stores the login token in an HTTP-only cookie.
- The server uses `SUPABASE_SERVICE_ROLE_KEY` only on the backend to read/write the app tables.
- Frontend code never receives the Supabase service role key or encrypted HighLevel PIT values.
- Run `supabase/schema.sql` in Supabase before enabling production storage.

## API Reliability Notes

- HighLevel Smart Lists may not be directly accessible as saved list IDs through the public API.
- Contact search should be used to recreate filters where possible.
- Workflow metadata is available, but full node-level workflow inspection should not be assumed.
- Message export may identify source as workflow, but workflow ID may not be reliably exposed in documented response fields.
- Blast workflow recipient counts may require inference from reply tags, message timing, or future instrumentation.

## Version One Build Order

1. Set up app shell, auth, and database.
2. Build Clients module.
3. Build HighLevel read-only API client.
4. Build Routing Setup.
5. Build Routing Check.
6. Build Monthly Check base report.
7. Build call and attribution summaries.
8. Build Blast Analyzer.
9. Build ClickUp posting.
10. Add saved reports and audit logs.
