# Lead Hero Health Check Tool Docs

This folder contains the pre-build planning docs for the Lead Hero Health Check Tool.

## Documents

1. [Product Requirements Document](01-PRD-Lead-Hero-Health-Check-Tool.md)
2. [Technical Architecture Document](02-Technical-Architecture-Lead-Hero-Health-Check-Tool.md)
3. [Security And Access Document](03-Security-And-Access-Lead-Hero-Health-Check-Tool.md)
4. [Frontend Specification Document](04-Frontend-Specification-Lead-Hero-Health-Check-Tool.md)

## Core Decision

```text
HighLevel = read-only evidence source
ClickUp = write destination for final report comments
```

The tool must not send outbound communication or modify account contacts inside HighLevel.

## Automation Health Decision

`Automations Firing` is checked through visible read-only outcomes:

- Contact has the configured form lead tag, usually `form lead`.
- A matching opportunity exists in the configured active pipeline.
- Staff notification evidence exists with `New form submission`.
- If the contact replied, the opportunity is checked against the configured first-reply stage.

The tool must not create or update opportunities, tags, contacts, workflows, or messages.

## Client Disconnect Decision

Admins and Users can disconnect a client from live HighLevel checks by removing the saved HighLevel Private Integration Token from this tool. This does not call HighLevel and does not change the client's HighLevel account.

## Client Edit Decision

Admins and Users can edit client connection details, including timezone and automation-flow fields. Timezone should be selected from IANA timezone IDs. On edit, leaving the PIT field blank keeps the saved encrypted token; entering a new PIT replaces it.

## Authentication And Settings Decision

The application has two roles: Admin and User. Both can manage all clients, run health checks and Blast Analyzer, and post reviewed ClickUp comments. Only Admin can view/manage the user directory and view security audit events. Both roles can change their own password; an Admin can set a new password for any other active account.

Public signup is disabled and the Admin-only Invite user form is the only new-account path. It creates a confirmed Supabase Auth member with an Admin-set initial password and sends no email. Legacy Operator and Viewer records migrate to User, while existing client assignments remain stored but no longer authorize access. `ADMIN_EMAILS` accounts remain protected bootstrap Admins, self-role/status changes are blocked, and the server preserves at least one active Admin.

Account creation, self-service password changes, and Admin-managed resets require the acting user's current password. New passwords require 12 to 128 characters with confirmation and go only to Supabase Auth; the application never stores, returns, redisplays, or audits them. There is no forgot-password or email-recovery flow. A locked-out user needs an Admin; a locked-out sole Admin requires authorized Supabase recovery outside the tool. MFA is not implemented.

## AI Blast Analysis Decision

Blast Analyzer can use OpenAI directly or through OpenRouter from the server only when an approved AI key is configured. OpenRouter mode uses `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, and `OPENAI_MODEL=openai/gpt-5.6-luna`. Results are presented as summary cards plus an All tagged contacts table with classification, confidence, summary, evidence, offer relevance or DND, method, and review status. Every reply-tagged contact is listed; only contacts with a matched outbound blast and a later inbound reply are classified. Missing matches remain visible as sanitized `Not analyzed` diagnostics. AI classifies the customer's overall semantic and emotional intent toward the specific promoted service across the complete post-blast conversation rather than only the latest inbound reply. For live analysis, the blast message phrase remains the required distinctive matching anchor; the server automatically extracts the actual matched outbound blast as the promoted-offer context and serializes every exported message from that blast onward within the selected date range as a structured in-memory JSON request, not a saved raw-conversation file. Promoted-service interest is Positive, different-service-only inquiries are Neutral for that blast, and clear rejection is Negative. Read-only HighLevel overall/channel DND, standalone `STOP`, and unambiguous stop-contact requests take Opt-out precedence, while normal language such as `stop by tomorrow` does not. Needs review is exceptional and is limited to missing usable inbound text, call-only evidence without text intent, or genuinely irreconcilable conversations. Contacts without a matching outbound blast do not use an unanchored fallback. If AI is unavailable, the tool uses the conversation-level rules fallback.

If HighLevel does not honor the direct tag filter, the server paginates `GET /contacts/` read-only with `startAfter` and `startAfterId`, then applies the tag locally. This avoids HighLevel's 10,000-result page-offset limit. The cursor scan is bounded at 50,000 contacts and fails explicitly for the ceiling or an invalid cursor so a partial contact population is never presented as complete.

The server makes up to three classification attempts per contact: (1) strict JSON schema, (2) relaxed json_object, (3) plain text. Reasoning models that return `content: null` are handled by extracting classification from the `reasoning` field. `max_tokens` is set to 1500 to give reasoning models enough budget to output their answer after thinking.

## Async Blast Analysis Decision

Live blast analysis runs as a background job. `POST /api/blasts/run` returns `{ jobId }` immediately. The frontend polls `GET /api/blasts/job/:jobId` every 3 seconds and shows a native accessible progress bar backed by actual server phases: contact scan, conversation export, blast matching, reply classification, and saving. It includes an overall percentage, aggregate count, and rotating Lead Hero-specific verbs; it does not use explosives terminology. Polling continues while the job is readable and running, with no fixed 15-minute browser cutoff. This eliminates HTTP timeout failures for large contact sets. Sample analyses remain synchronous.

## Blast Client Context Decision

The Blast Analyzer result area is scoped to the client selected in the Blast form. The frontend filters saved analyses by `clientId`, ignores an active result belonging to a different client, and shows the selected client's newest saved analysis or a client-specific empty state. The submitted client remains selected through background-job polling and completion, so adding or selecting a new client cannot leave a previous client's result on screen.

## Brand Direction

The frontend specification uses the Lead Hero logo theme: gold accents, white/light working surfaces, soft silver-gray borders, and dark charcoal structure.
