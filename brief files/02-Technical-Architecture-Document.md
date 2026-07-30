# Technical Architecture Document

## Product

Lead Hero Health Check Tool

## Document Status

- Updated: July 31, 2026
- Describes the implemented local architecture
- Replaces the original proposed Next.js, React, TypeScript, Prisma, and Vercel design
- The application is not built with Flask or Python

## Architecture Summary

The application is a small, server-rendered-by-API internal web tool:

```text
Browser
  |
  | Static HTML, CSS, and JavaScript
  | JSON over same-origin HTTP
  v
Native Node.js HTTP server (server.mjs)
  |
  +-- Supabase Auth
  +-- Supabase Postgres REST (server service role)
  +-- HighLevel API v2 (strictly read-only)
  +-- OpenRouter / approved OpenAI-compatible AI API
  +-- ClickUp API (reviewed comment only)
  +-- Local ephemeral background-job files
```

## Implemented Technology Stack

### Runtime

- Node.js 18 or newer
- ECMAScript modules
- Native `node:http`
- Native `fetch`
- Native Node filesystem and cryptography APIs

There is no Express, Flask, Next.js, React, TypeScript, Tailwind CSS, shadcn, Radix UI, Prisma, or frontend build step in the current project.

### Frontend

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- Vanilla DOM rendering and event handlers
- Inline SVG icon definitions in JavaScript
- Static assets in `public/assets/`

### Backend

- `server.mjs` owns the HTTP server, static-file serving, application routes, external API adapters, encryption, persistence mapping, and long-running job orchestration.
- Focused pure modules in `src/` contain access-control, authentication validation, audit redaction, blast-thread selection/classification guards, progress calculation, and HighLevel pagination.

### Database and Authentication

- Supabase Auth for email/password identity
- Supabase Postgres for application data
- Supabase REST endpoints called by the Node server
- `SUPABASE_SERVICE_ROLE_KEY` used only by the server
- RLS and browser-role revocations retained as defense in depth
- No browser-side Supabase client

### AI

- OpenRouter is the configured provider for local use.
- The server uses the OpenAI-compatible Chat Completions API.
- The model is selected through `OPENAI_MODEL`; `.env.example` currently shows `openai/gpt-5.6-luna`.
- The code retains an OpenAI-compatible direct-provider path.

### Tests

- Native Node test runner through `npm test`
- No separate test framework dependency

## Repository Structure

```text
server.mjs                         Native HTTP server and integrations
package.json                       Node scripts and runtime requirement
.env.example                       Non-secret configuration names
public/
  index.html                       Application document
  app.js                           Frontend state, rendering, and API calls
  styles.css                       Responsive design system and components
  assets/lead-hero-logo.png        Bundled brand asset
src/
  access-control.mjs               Admin/User and job access rules
  auth-management.mjs              Role, password, and user-action validation
  audit.mjs                        Audit-message redaction
  blast-thread.mjs                 Anchor selection and classification guards
  blast-progress.mjs               Progress phases, percentages, and safe verbs
  highlevel-pagination.mjs         Page, cursor, and date-window pagination
test/
  *.test.mjs                       Node unit and security-contract tests
supabase/
  schema.sql                       Review mirror of the current schema
  migrations/                      Forward migrations
  reversals/                       Explicit reversal migrations
data/
  store.json                       Local fallback store when Supabase is absent
  jobs/*.json                      Ephemeral background-job status
outputs/                            Maintained project documentation
brief files/                        Standalone updated product briefs
```

`data/jobs/` is runtime state and must remain untracked.

## Startup and Local Runtime

Default local command:

```powershell
npm run start:local
```

Default URL:

```text
http://localhost:3000
```

The port can be changed for the process:

```powershell
$env:PORT=3001
npm run start:local
```

`.env` is gitignored. Environment changes are loaded only when the Node process starts, so the server must be restarted after an `.env` change.

## HTTP API

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/password-change
```

There is no signup, forgot-password, email-reset-request, or recovery-completion endpoint.

### Bootstrap

```text
GET /api/bootstrap
```

Returns the authenticated user's safe profile, authorized client data, saved analyses/reports, routing setup, and safe provider/storage status. It does not return encrypted PIT ciphertext or service credentials.

### Admin settings

```text
GET   /api/settings/users
POST  /api/settings/users/invite
PATCH /api/settings/users/:id
POST  /api/settings/users/:id/password-reset
GET   /api/settings/audit-logs
```

The route named `invite` performs immediate manual account creation with an Admin-set password. It does not send an email.

### Client and connection management

```text
POST /api/clients
POST /api/clients/disconnect
POST /api/highlevel/test
```

`POST /api/clients` handles create and edit. A blank PIT on an existing client preserves the encrypted value.

### Product operations

```text
POST /api/routing
POST /api/blasts/run
GET  /api/blasts/job/:jobId
POST /api/monthly/run
POST /api/clickup/post
```

All state-changing application routes independently enforce authorization on the server.

## Authentication Architecture

1. The login route submits email/password to Supabase Auth.
2. The server receives the access token.
3. The server resolves the corresponding active `app_users` row.
4. The server stores the access token in an HTTP-only, SameSite=Lax cookie named `lh_session`.
5. Each authenticated request validates the token with Supabase Auth and reloads the application role from `app_users`.

The server does not authorize from user-editable Auth metadata.

Cookie security is controlled by `COOKIE_SECURE`; production must use secure cookies over HTTPS.

### Role model

```text
admin > user
```

Both roles have global client access. User-owned background-job access is narrower:

- Admin may read any application job.
- User may read only a job they started for an accessible client.

Admin directory, user mutations, managed password resets, and security audit reads require Admin.

## Supabase Data Model

The implemented schema intentionally uses a compact table set.

### `app_users`

- Auth-user mapping
- Email
- `admin` or `user`
- Active flag
- Created and updated timestamps

### `clients`

- Client and HighLevel identifiers
- Encrypted PIT and non-sensitive preview
- ClickUp task ID
- Timezone
- Lead-flow configuration
- Status and timestamps

### `client_assignments`

Retained for historical compatibility. It is not used to authorize client access in the current Admin/User model.

### `routing_setups`

- Client
- Staff contact ID and phone
- Expected phrase
- Expected delay
- Active flag

### `blast_analyses`

- Client and date range
- Reply tag
- Source
- Full sanitized analysis payload as `jsonb`
- Created timestamp

Per-contact results are currently embedded inside the sanitized `payload`; there is no separate `blast_reply_classifications` table in the implemented schema.

### `monthly_reports`

- Client and date range
- Green/Yellow/Red status
- Source
- ClickUp posting state and comment ID
- Full sanitized report payload as `jsonb`
- Created timestamp

The implemented table is named `monthly_reports`, not `monthly_checks`.

### `api_audit_logs`

- Acting Auth user
- Client where relevant
- Action
- Target type and ID
- Success/failure status
- Sanitized message
- Timestamp

## Persistence Modes

### Supabase mode

When Supabase is configured:

- The server reads and writes application tables through Supabase REST with the service role.
- Whole-store JSON writes are disabled.
- RLS remains enabled.
- `anon` and `authenticated` have no direct table privileges.

### Local fallback mode

When Supabase is not configured and authentication is not required:

- The application can use `data/store.json`.
- Sample clients and sample analyses allow UI development.
- This is not the production authorization or storage model.

## HighLevel Integration

### Authentication

Each client has a HighLevel Private Integration Token encrypted in the application database. The server decrypts it only for an allowed read request.

Headers:

```http
Authorization: Bearer <PRIVATE_INTEGRATION_TOKEN>
Version: 2021-07-28
Content-Type: application/json
```

The API version and base URL are configured centrally.

### Server endpoint allowlist

The current server allows only:

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

A request outside this allowlist is rejected even if a PIT is over-scoped.

### Required token scope policy

Use only the minimum read-only HighLevel scopes needed for enabled features, principally contacts, conversations/messages, opportunities, tags/custom fields, location data, and workflows where available.

No `.write`, sending, payment-collection, workflow-trigger, or CRM-mutation scope is approved.

The original planning document included HighLevel's full read/write scope catalog for reference. That provider catalog is intentionally not reproduced as an application allowlist: the presence of a provider scope does not approve it. Only feature-required read-only scopes and the server paths listed above are allowed.

## HighLevel Pagination

### Page-based reads

Bounded page collection is used where HighLevel supports reliable numbered pagination.

### Cursor-based contact fallback

HighLevel page offsets cannot reliably cover result windows beyond 10,000 contacts. The tag fallback therefore:

- Reads `GET /contacts/`.
- Follows `startAfter` plus `startAfterId`.
- Uses page size 100.
- Allows at most 500 pages and 50,000 contacts.
- Detects missing and repeated cursors.
- Throws an incomplete-scan error instead of returning partial success.

### Message export windows

The selected range is split into bounded UTC date windows. Progress is reported as windows finish, and message pagination continues within the safety bounds.

## Blast Analysis Pipeline

```text
Validate request
  -> obtain reply-tag candidates
  -> export messages for selected range
  -> match required phrase to outbound blast
  -> select actual outbound offer and later thread
  -> apply deterministic DND / STOP rules
  -> classify complete post-blast conversation
  -> validate service relevance and label
  -> retain diagnostic rows for unclassified candidates
  -> save client-scoped sanitized payload
```

### Anchor selection

The mandatory phrase is matched against original outbound message content before AI payload shaping. Once matched, the actual outbound text becomes `promotedOffer`, and the selected thread begins at that message.

### AI request shape

The in-memory request contains:

- Required matching phrase
- Actual promoted offer
- Structured messages from the blast onward
- Direction
- Timestamp
- Channel
- Bounded text

It does not contain DND metadata, credentials, earlier conversation history, or other contacts.

### AI resilience

For OpenRouter, the server can attempt:

1. Strict JSON-schema output.
2. Relaxed JSON-object output.
3. Plain-text structured output.

The server normalizes approved labels and rejects responses without a valid classification. If AI is unavailable or invalid, local conversation rules produce a Rules or Rules fallback result.

Deterministic DND and opt-out signals override AI. Different-service-only inquiries normalize to Neutral.

## Background Job Architecture

Live Blast Analyzer runs do not hold the initial HTTP request open.

### Start

`POST /api/blasts/run`:

- Validates role, client, date range, tag, and phrase.
- Creates a UUID job ID.
- Writes an initial job record.
- Starts `runBlastJob()` without awaiting completion.
- Returns HTTP 202 with the job ID.

### Progress

The analysis callback emits:

```text
phase
phaseLabel
verb
detail
percent
done
total
count
```

Percentages are weighted by real processing phases and clamped so they do not move backwards.

### Polling

`GET /api/blasts/job/:jobId` returns running, done, or error state. The browser polls every three seconds and stops on:

- `done`
- `error`
- Three consecutive unreadable status requests

There is no fixed 15-minute browser cutoff while the job remains readable and running.

### Storage limitation

Job files are stored in `data/jobs/*.json`. They are ephemeral and suitable for the current single-process local runtime. A production multi-instance deployment requires durable shared job state or a queue.

Job progress contains aggregate, sanitized fields only.

## ClickUp Integration

The only external business write is:

```http
POST https://api.clickup.com/api/v2/task/{taskId}/comment
```

The request body contains the reviewed generated report comment and `notify_all: false`.

No task creation, task mutation, assignee update, status update, or HighLevel write is implemented.

When no ClickUp token is configured in local/sample mode, the application can exercise a local preview path without an external ClickUp request.

## Secret Handling

### Client HighLevel PITs

- Entered over the authenticated app.
- Encrypted with AES-256-GCM before storage.
- Encryption key derived from `APP_ENCRYPTION_KEY`.
- Decrypted only on the server for allowlisted read requests.
- Browser receives only `hasToken` and a short non-sensitive preview.

### App-wide secrets

Server-only environment variables include:

```text
APP_ENCRYPTION_KEY
SUPABASE_SERVICE_ROLE_KEY
CLICKUP_API_TOKEN
OPENROUTER_API_KEY
OPENAI_API_KEY
```

No secret value belongs in source control, browser JavaScript, documentation, screenshots, progress records, or audit messages.

## Non-secret Configuration

Supported configuration names include:

```text
PORT
AUTH_REQUIRED
ADMIN_EMAILS
COOKIE_SECURE
SUPABASE_URL
SUPABASE_ANON_KEY
HIGHLEVEL_API_VERSION
HIGHLEVEL_API_BASE_URL
AI_PROVIDER
OPENROUTER_SITE_URL
OPENROUTER_APP_NAME
OPENAI_BASE_URL
OPENAI_MODEL
```

The Supabase anon key is used by the server for Auth calls in this implementation; it is not used to grant browser table access.

## Error and Data Boundaries

- External errors are converted to safe user-facing messages.
- HighLevel response bodies and secrets are not returned verbatim.
- Audit messages pass through redaction.
- Raw conversation exports are not persisted.
- An incomplete large-account contact scan fails the entire analysis.
- A Blast result is displayed only for the selected client.
- A failed ClickUp post leaves the report saved.

## API Reliability Notes

- HighLevel Smart Lists are not assumed to be directly readable as saved-list IDs.
- Contact search can reproduce supported filters, but parity with every HighLevel UI filter is not guaranteed.
- HighLevel exposes workflow metadata, not guaranteed node-level execution history.
- Message export may identify workflow-originated messages without reliably exposing a workflow ID in every account.
- Contact creation date is not the Blast reply date; Blast message windows must be applied to conversation messages.
- HighLevel may omit tag arrays from a server-side tag-filtered search response. A successful server-side filter remains authoritative; local tag matching is used only when returned tag data exists.
- External reads must be bounded and paginated; failures must report partial evidence rather than silently returning success.
- AI provider model capabilities differ. Structured-output failure is handled as a provider compatibility condition, not permission to weaken the data boundary.

## Implemented Service Responsibilities

The earlier architecture proposed separate service classes. The current MVP keeps orchestration in `server.mjs` and extracts pure reusable logic into `src/`.

### Routing and monthly orchestration

- Read configured staff notification evidence.
- Read form-lead contacts and opportunities.
- Conditionally evaluate reply-stage movement.
- Summarize calls and attribution where evidence is available.
- Generate the traffic-light report and ClickUp-ready comment.

### Blast orchestration

- Gather reply-tagged candidates.
- Export bounded message windows.
- Select the anchored thread.
- Apply DND/STOP precedence.
- Classify intent and service relevance.
- Account for diagnostic contacts.
- Save the sanitized payload.

### ClickUp posting

- Validate role, report, client, and task.
- Post only the generated reviewed comment.
- Save the comment ID and posting state.
- Audit success or failure without storing the ClickUp token or response body.

## Current Build/Delivery Status

The original version-one build order has effectively produced:

1. Static app shell and authentication.
2. Client management.
3. Central read-only HighLevel adapter.
4. Routing setup and check path.
5. Monthly report path.
6. Blast Analyzer with async jobs.
7. Reviewed ClickUp comment path.
8. Saved reports, analyses, and audit events.

Implementation does not equal final acceptance. Blast and security controls have received the most recent attention; routing, lead flow, monthly reports, and live ClickUp behavior remain scheduled for deeper validation.

## Deployment Status

The app is currently being tested locally. The earlier Vercel/Next.js proposal is not the implemented architecture, and Railway is not the active test environment for this work.

Before production deployment, decide:

- Single-instance versus shared durable jobs
- HTTPS and secure-cookie configuration
- Durable monitoring and backup strategy
- Final hosting platform
- Live validation of routing, monthly, and ClickUp workflows
- Approved secrets-management and migration process
