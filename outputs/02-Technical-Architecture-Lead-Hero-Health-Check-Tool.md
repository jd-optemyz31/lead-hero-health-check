# Technical Architecture Document

## Product Name

Lead Hero Health Check Tool

## Architecture Summary

The tool is a private internal web app that reads data from HighLevel through Private Integration Tokens, analyzes account health, stores reports in its own database, and posts reviewed comments to ClickUp.

HighLevel is treated as a read-only evidence source. The app must not send outbound communication or mutate CRM records.

Current implementation: a plain Node.js server in `server.mjs`, a static frontend in `public/app.js`, server-only Supabase access, and OpenRouter as the configured AI provider.

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

The current implementation uses Supabase Auth email/password with public signup disabled. The Admin-only Invite user form creates confirmed Auth users manually with an Admin-set initial password; no invitation email is sent.

The server resolves `admin` or `user` from `app_users` on every authenticated request. User-editable Auth metadata is not an authorization source. `ADMIN_EMAILS` remains a protected bootstrap Admin allowlist.

Reason:

- Auth and Postgres live in the same platform.
- Supabase Auth integrates cleanly with Postgres Row-Level Security.
- User identity is tied to server-enforced roles and audit logs.

Both roles have global client access. Existing `client_assignments` rows are preserved for history but are not used for authorization. MFA is not implemented in this release.

### AI Reply Classification

OpenAI API directly or through OpenRouter.

Used only for analyzing conversation replies, not for sending messages.

Current MVP implementation:

- The Node server calls the AI provider from the backend only.
- OpenAI direct uses the Responses API.
- OpenRouter uses the OpenAI-compatible Chat Completions API at `https://openrouter.ai/api/v1/chat/completions`.
- `AI_PROVIDER`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` are Railway/server variables and are never sent to the browser.
- API key values are trimmed on read to guard against whitespace that Railway or other secret managers may append.
- The request uses a strict JSON schema for `classification`, `serviceRelevance`, `relevanceReason`, `summary`, `evidence`, `confidence`, and `reviewStatus` where the provider can route those parameters.
- In OpenRouter mode, the server makes up to three attempts before falling back to local rules: (1) strict JSON schema request with `require_parameters: true`; (2) relaxed `json_object` request if the strict attempt fails due to provider routing; (3) plain-text request with no `response_format` if the relaxed attempt returns an unrecognizable response.
- `max_tokens` is set to `1500` to accommodate reasoning models that output chain-of-thought before the final JSON answer. Models that use a `reasoning` or `reasoning_details` field and return `content: null` are handled by extracting classification from the reasoning text as a last resort.
- The server handles response payloads where `message.content` is already a parsed object rather than a JSON string, and unwraps one level of nesting if the model wraps its response in a container key such as `{ "result": { "classification": ... } }`.
- The only allowed labels are `Positive`, `Neutral`, `Negative`, `Opt-out`, and `Needs review`.
- The server normalizes common AI label variants, such as lowercase labels, `opt_out`, and `needs_review`, into the approved labels before saving or displaying results.
- If the AI provider returns a partial response with no valid classification label, the server must reject that AI result and mark the row as rules fallback instead of displaying a mixed AI/fallback row.
- AI classification uses semantic and emotional intent toward the specific promoted service across the complete post-blast conversation rather than a hardcoded phrase list or only the latest inbound reply. The local phrase-based conversation classifier is only a fallback when AI is not configured or an AI request fails.
- The required short phrase is only the matching anchor. Once an outbound message matches, the server automatically passes the actual matched outbound message separately as `promotedOffer`; users do not paste the full blast twice.
- `Positive` applies when inbound customer intent concerns the promoted service. `Negative` requires a clear decline, rejection, or explicit lack of interest in the promoted offer. Different-service-only inquiries are `Neutral` because they neither accept nor reject that offer. Temporary deferrals, acknowledgements, and identity questions are also `Neutral` unless the wider conversation supports another label.
- Before calling AI, the server applies read-only HighLevel DND state from the contact search result. Overall DND or `active`/`permanent` DND for the matched blast channel is deterministically `Opt-out`. A standalone `STOP` or an unambiguous stop-contact request is also `Opt-out`; the bare word `stop` inside normal language such as `stop by tomorrow` is not.
- The server validates AI output so `Different service` resolves to Neutral for the promoted blast and deterministic opt-out signals retain precedence.
- Contact accounting and reply classification are separate. The server returns one result row for every reply-tagged contact. Rows without a matched outbound blast or without a later inbound message are retained as `Not analyzed` diagnostics and are excluded from the five classification totals.
- Blast contact retrieval first attempts the read-only advanced search with the tag filter. Because HighLevel rejects page-number result windows beyond 10,000 contacts, the local-tag fallback uses `GET /contacts/` with `startAfter` and `startAfterId` cursor pagination instead of increasing the page offset. It requests up to 500 pages of 100 contacts, covering up to 50,000 contacts. A full final page, missing next cursor, or repeated cursor triggers an explicit incomplete-scan error rather than allowing the server to save or display a silently truncated population.
- `Needs review` is exceptional and is reserved for no usable inbound customer text, call-only evidence without text intent, or a genuinely irreconcilable conversation. Clear rule signals prevent AI from overusing `Needs review`.
- Only blast-relevant conversation context should be sent to the AI service. The blast phrase is required, and the server must match it to an outbound message before serializing the actual matched outbound offer plus every exported message from that blast onward within the selected date range as an in-memory JSON request payload. The tool does not send HighLevel DND metadata to AI because DND is handled deterministically by the server first. There is no raw-conversation file, persisted full thread, or unanchored selected-window fallback. Messages before the matched blast, HighLevel PITs, ClickUp tokens, Supabase keys, full account exports, and unrelated contact history must never be sent.
- If the AI provider is not configured, times out, or returns an invalid response, the app falls back to the local rule-based classifier, marks the method as `Rules` or `Rules fallback`, and shows a safe fallback reason without exposing keys or raw secrets.
- For OpenRouter, set `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, and `OPENAI_MODEL=openai/gpt-5.6-luna`.
- For OpenAI direct, set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and an approved model ID supported by the direct OpenAI account.

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

Client-specific HighLevel Private Integration Tokens should be entered through the authenticated Clients screen by an Admin or User and stored encrypted in Postgres. They should not be stored in code, frontend files, Git, or Railway variables. Railway variables are for app-wide secrets, not per-client PITs.

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

### app_users

Stores app users.

Fields:

- id
- auth_user_id
- email
- role: `admin` or `user`
- active
- created_at
- updated_at

Legacy `operator` and `viewer` values are migrated to `user`. The server continues to resolve the role from this table on every request.

The server checks last-active-Admin mutations before writing. A database trigger serializes Admin demotion/deactivation with a transaction-scoped advisory lock and rejects any concurrent change that would leave no active Admin.

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

Admin and User routes:

```text
POST /api/clients
POST /api/clients/disconnect
POST /api/highlevel/test
```

`POST /api/clients/disconnect` removes the stored HighLevel token from this tool so future live HighLevel reads are disabled for that client until a new token is saved. It must not call a HighLevel revoke, delete, or account-management endpoint.

`POST /api/clients` also handles edits when an existing client ID is provided. Editable fields include client name, timezone, HighLevel location ID, ClickUp task ID, form lead tag, active pipeline name/ID, first-reply stage name/ID, and reply movement window. The PIT token is required only when creating a new client or replacing a disconnected token. On edit, a blank PIT preserves the existing encrypted token.

The frontend should use a timezone selector backed by IANA timezone IDs. Browsers that support `Intl.supportedValuesOf("timeZone")` can provide the full list without hardcoding it.

### Authentication And Settings APIs

Public authentication routes:

```text
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/password-change
GET  /api/auth/me
```

Admin-only routes:

```text
GET   /api/settings/users
POST  /api/settings/users/invite
PATCH /api/settings/users/:id
POST  /api/settings/users/:id/password-reset
GET   /api/settings/audit-logs
```

User-directory responses expose only safe account fields. Account creation and password updates call Supabase Auth Admin APIs only from the server with the service-role key. `POST /api/settings/users/invite` retains the product route name but creates a confirmed user with email, role, and initial password; it does not send email.

The acting user must reauthenticate with their current password before a self-service change, Admin-created account, or Admin-managed reset. Passwords require confirmation and 12 to 128 characters. Password values are transient request data sent to Supabase Auth and are never stored in `app_users`, returned, displayed after submission, or audited. A self-service change revokes the current session, clears the application cookie, and requires a fresh login. An Admin reset does not guarantee immediate invalidation of the target's already-issued access token; the current application token lifetime bounds that exposure to approximately one hour.

No public forgot-password, email invitation, email recovery, signup API, or signup form exists. A locked-out user must contact an Admin. If the only Admin is locked out, an authorized Supabase operator must recover the account outside this application.

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
- user.create
- user.update
- auth.password_change
- auth.password_reset

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
- Classify replies with AI when configured using the complete exported thread from the required matched blast onward inside the selected date range, with a local rules fallback
- Store classification, confidence, evidence, method, and review status
- Save analysis results

For live blast analysis, do not use contact creation date as the primary date filter. Search candidate contacts by the configured reply tag, then apply `dateStart` and `dateEnd` to inbound conversation messages so older contacts who replied during the blast window are included.

When the server uses HighLevel contact search with a reply-tag filter, it should trust the server-side tag match if HighLevel returns contact rows without tag details. If the tag-filtered search returns no rows or fails, the server may retry a read-only unfiltered contact search and apply local tag matching only when tag metadata is present in the returned contacts.

Message export pagination must be deep enough for the selected date window. The server should request larger read-only export pages where supported and continue through bounded cursors so replies are not missed just because newer account messages appear later in the selected range.

### Async Blast Analysis (Background Job Pattern)

Live blast analysis runs as a background job to avoid HTTP timeout issues with large contact sets.

Flow:

1. `POST /api/blasts/run` validates the request, generates a UUID job ID, writes an initial job file to `data/jobs/{jobId}.json` with `status: "running"`, fires `runBlastJob()` without awaiting it, and returns `{ jobId }` with HTTP 202 immediately.
2. `runBlastJob()` runs `generateLiveBlastAnalysis()` in the background with an `onProgress` callback. Progress objects contain `phase`, `phaseLabel`, `verb`, `detail`, `percent`, `done`, `total`, and `count`. The server writes updates during contact pages, exported date windows, blast-message matching, each classified contact, and final saving. Overall percentages use weighted real phases and are clamped monotonically so fallback pagination cannot make the bar move backward.
3. When all contacts are processed, `runBlastJob()` saves the completed analysis to the store and writes the final job file: `{ status: "done", progress: { done: M, total: M }, analysis: { ... } }`. On error, it writes `{ status: "error", error: "message", progress: ... }`.
4. `GET /api/blasts/job/:jobId` reads and returns the current job file contents.
5. The frontend polls this endpoint every 3 seconds. It updates the native HTML/CSS progress bar, percentage, action verb, detail, phase, and count directly in the DOM to avoid full page re-renders. The progressbar exposes `aria-valuenow` and `aria-valuetext`, and animation respects reduced-motion preferences. It continues while the server returns a readable `running` status rather than stopping after a fixed 15-minute browser timer. When `status === "done"`, it stops polling, saves the analysis and its `clientId` to state, and re-renders the blast view with results. When `status === "error"`, it stops polling and shows the error toast. Three consecutive status-request failures stop polling with a connection-specific message.
6. Blast result selection is client-scoped in the frontend. The selected Blast client ID is retained across re-renders, saved analyses are filtered by `clientId` before choosing the newest result, and an active in-memory result is ignored when its `clientId` differs from the selected client. A newly added client therefore shows its own latest result or an empty state, never another client's analysis.

Job files are stored in `data/jobs/` and are excluded from git. On Railway, the ephemeral filesystem means job files persist only for the current deployment. Sample analyses (no HighLevel token) remain synchronous and return `{ analysis, blastAnalyses }` directly.

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
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=Lead Hero Health Check Tool
OPENAI_API_KEY=
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-5.6-luna
HIGHLEVEL_API_VERSION=2021-07-28
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_REQUIRED=true
ADMIN_EMAILS=
AUTH_SECRET=
```

`APP_ENCRYPTION_KEY` is the app-owned master encryption secret used by the server to encrypt and decrypt stored client-level secrets, especially HighLevel Private Integration Tokens. It must be generated as a long random value, stored only in Railway variables or another approved secret manager, and kept stable across deploys so existing encrypted tokens remain decryptable.

Client-specific HighLevel PITs should be encrypted in the database, not stored as plain text environment variables and not stored as one Railway variable per client.

Railway variable guidance:

- Store app-wide secrets in Railway: `APP_ENCRYPTION_KEY`, `DATABASE_URL`, `CLICKUP_API_TOKEN`, `OPENROUTER_API_KEY` or `OPENAI_API_KEY`, `AUTH_SECRET`, and Supabase server-side credentials.
- Do not store client HighLevel PITs in Railway variables.
- Do not expose server-only secrets through any `NEXT_PUBLIC_` variable.
- Use separate Railway environments and separate secrets for development, staging, and production.

Current MVP implementation note:

- The plain Node server validates users through Supabase Auth and stores the login token in an HTTP-only cookie.
- The server uses `SUPABASE_SERVICE_ROLE_KEY` only on the backend to read/write the app tables.
- Frontend code never receives the Supabase service role key or encrypted HighLevel PIT values.
- Apply the committed files in `supabase/migrations/` through the approved migration workflow. `supabase/schema.sql` is a review mirror, not the production apply mechanism.
- The Admin/User role change is represented by `supabase/migrations/20260729075229_admin_user_roles.sql`; review and apply it only through the approved migration workflow.
- Public signup remains disabled. The tool does not use authentication email delivery; Admins create accounts and manage passwords through server-enforced in-tool workflows.

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
