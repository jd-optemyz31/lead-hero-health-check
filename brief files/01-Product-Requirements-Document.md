# Product Requirements Document

## Product

Lead Hero Health Check Tool

## Document Status

- Updated: July 31, 2026
- Basis: the original PRD, the maintained project documentation, and the current local implementation
- Runtime status: local testing at `http://localhost:3000`
- Change-control status: this document records the current product direction; it does not authorize a deployment or a live external write

## Product Summary

The Lead Hero Health Check Tool is a private internal operations application for reviewing Lead Hero client accounts. It reads evidence from HighLevel, analyzes routing, lead flow, calls, attribution, and blast replies, saves internal reports, and can post a reviewed monthly report comment to ClickUp.

The product is not a campaign sender, CRM editor, or workflow-management tool.

```text
HighLevel = strictly read-only evidence source
ClickUp = the only approved external business write destination
```

## Problem

Lead Hero maintenance checks are repetitive and difficult to verify consistently across clients. Team members must gather evidence from contacts, conversations, opportunities, workflows, and calls; determine whether lead flow is healthy; interpret blast replies; and prepare a consistent ClickUp update.

Manual processing creates four main risks:

- Important evidence can be missed or interpreted inconsistently.
- Large accounts and long message exports can exceed a normal browser request timeout.
- A result from one client can be mistaken for another client's result.
- Over-broad CRM access could accidentally modify HighLevel or contact customers.

## Product Goals

1. Give authorized internal users one safe place to manage client connections.
2. Make routing, lead-flow, monthly, and blast evidence easier to review.
3. Account for every reply-tagged contact in a Blast Analyzer run.
4. Classify customer intent toward the actual promoted service using the complete post-blast conversation.
5. Keep long Blast Analyzer jobs observable with real progress.
6. Preserve a human review step before posting a monthly report to ClickUp.
7. Enforce authentication, role boundaries, secret protection, and sanitized auditing.
8. Guarantee that the application cannot write to HighLevel.

## Non-Goals

The application must not:

- Send SMS or email through HighLevel.
- Place calls.
- Create, edit, or delete HighLevel contacts.
- Add or remove tags.
- Enroll contacts in or remove contacts from workflows.
- Create, move, or update opportunities.
- Edit workflows or trigger automations.
- Create ClickUp tasks, move tasks, edit task fields, or change assignees.
- Provide public signup.
- Provide email invitations, forgot-password email, or email recovery.
- Store or display raw passwords, secrets, or full raw conversation exports.
- Claim that MFA is implemented.

## Target Users

### Admin

An Admin can:

- View and manage every client.
- Configure client connections and routing setup.
- Run routing, monthly, and Blast Analyzer checks.
- Review and post monthly comments to ClickUp.
- View the user directory.
- Create users manually.
- Change another user's role or active status.
- Reset another active user's password.
- View sanitized security audit events.

### User

A User can:

- View and manage every client.
- Configure client connections and routing setup.
- Run routing, monthly, and Blast Analyzer checks.
- Review and post monthly comments to ClickUp.
- Change their own password.

A User cannot view or manage the user directory and cannot view security audit events.

### Capability Matrix

| Capability | Admin | User |
|---|---:|---:|
| View/manage all clients | Yes | Yes |
| Run checks and Blast Analyzer | Yes | Yes |
| Post reviewed ClickUp comments | Yes | Yes |
| View user directory | Yes | No |
| Create, deactivate, reactivate, or change users | Yes | No |
| Change own password | Yes | Yes |
| Reset another active account's password | Yes | No |
| View security audit events | Yes | No |

Client-assignment records are retained for history but do not restrict access. Both roles currently have global client access.

## Core Product Principles

### Read-only HighLevel

Every HighLevel integration path must use an allowlisted read endpoint. UI permissions and token scopes do not replace the server-side endpoint allowlist.

### Review before ClickUp

A monthly report is generated as a draft. The user reviews the comment before approving the ClickUp post.

### Evidence before status

Green, Yellow, and Red statuses must be supported by readable evidence. Missing data must be identified as missing or partial rather than silently treated as success.

### Client context is explicit

Every check, report, analysis, job, and visible result must remain associated with its selected client.

### Minimum necessary data

The application uses short evidence excerpts and sanitized summaries. It does not persist raw conversation exports.

## Product Scope

## 1. Authentication and Settings

### Login

- Supabase Auth email/password login is required when `AUTH_REQUIRED=true`.
- Public signup remains disabled.
- The application has no signup page, forgot-password page, email invitation, or recovery-link flow.
- A successful login creates an HTTP-only application cookie.
- An inactive or unprovisioned account cannot use the application.

### Manual user creation

The Settings screen retains the label **Invite user**, but the workflow creates a confirmed account immediately:

- Admin enters email.
- Admin selects Admin or User; User is the default.
- Admin sets and confirms a 12-to-128-character initial password.
- Admin reauthenticates with their own current password.
- No email is sent.
- The initial password is sent only to Supabase Auth and is never stored, logged, returned, or shown again.

Duplicate accounts must be rejected with a safe message.

### Password management

- Admin and User can change their own password after entering their current password.
- A successful self-change signs the user out and requires a fresh login.
- An Admin can reset the password of another active account after Admin reauthentication.
- An Admin cannot use the managed-reset action on themselves.
- Inactive users must be reactivated before a managed reset.
- A locked-out user contacts an Admin.
- Recovery of a locked-out sole Admin is an authorized Supabase operator procedure outside this application.

### Admin safeguards

- `ADMIN_EMAILS` identifies protected bootstrap Admins.
- A protected Admin cannot be deactivated or changed to User through the application.
- An Admin cannot deactivate themselves or change their own role.
- The application and database must preserve at least one active Admin.
- Permanent user deletion is not part of this release.

### Safe system status

Settings may display only safe connection state for:

- HighLevel
- ClickUp
- AI provider
- Storage
- Authentication

It must never display credentials, session tokens, Auth metadata, IP addresses, raw conversations, or password values.

## 2. Clients

Both roles can add and edit clients.

Required or supported fields:

- Client name
- HighLevel location ID
- Read-only HighLevel Private Integration Token
- ClickUp task ID
- IANA timezone
- Form-lead tag, default `form lead`
- Active pipeline name or ID
- First-reply stage name or ID
- Reply movement window

Client PIT behavior:

- A PIT is required for a new live client.
- The server encrypts the PIT before storage.
- The plaintext PIT is never returned to the browser.
- Editing a client with a blank PIT preserves the stored token.
- Entering a replacement PIT replaces the encrypted stored token.
- Disconnect removes only this tool's stored encrypted token and preview.
- Disconnect never calls HighLevel and does not revoke or change anything in the client's HighLevel account.

## 3. Routing Setup and Routing Check

Routing Setup records one or more staff notification contacts per client.

Fields:

- Staff contact ID, when available
- Staff phone number
- Expected phrase
- Expected delay window

The default expected phrase is:

```text
New form submission
```

The routing check reads conversation evidence for the selected range and determines whether the expected staff notification appeared within the configured delay. It does not send or resend the notification.

## 4. Lead-flow and Automation Outcome Check

The product does not assume that HighLevel exposes full workflow node-level inspection. It verifies visible outcomes:

1. Find contacts in the selected date range with the configured form-lead tag.
2. Check for an opportunity in the configured active pipeline.
3. Check for staff notification evidence containing `New form submission`.
4. Determine whether the contact sent a first reply.
5. Only when a reply exists, compare the opportunity with the configured first-reply stage.

The product reports missing or partial outcomes. It never repairs them.

### Workflow metadata

Where HighLevel exposes the fields reliably, the tool may read:

- Workflow name
- Workflow ID
- Workflow status
- Updated date

This confirms whether an expected workflow exists and appears active. It does not prove that every internal node ran.

### Outcome-testing framework

The original design also considered generic outcome evidence such as a tag, note, opportunity, SMS, or email. The implemented MVP currently concentrates on contacts, tags, opportunities, staff notification messages, and first replies. Note evidence and generic message-outcome templates are deferred until the relevant read endpoint and product rule are explicitly approved.

## 5. Blast Analyzer

The Blast Analyzer runs independently of the monthly check and can be used at any time.

### Required inputs

- Client
- Start date
- End date
- Reply tag
- Distinctive blast message phrase

Optional input:

- Workflow name or ID, used as supporting context only

The blast phrase is mandatory. It is an anchor used to find the actual outbound blast; it is not a substitute for the full offer.

### Candidate accounting

- Candidate contacts come from the reply tag.
- The date range applies to the message export, not the contact creation date.
- Every reply-tagged candidate must appear in the result table.
- A contact without an outbound phrase match is retained as `Not analyzed — No blast match`.
- A contact with a matching blast but no later inbound reply is retained as `Not analyzed — No post-blast reply`.
- Diagnostic rows are excluded from Positive, Negative, Neutral, Opt-out, and Needs review totals.
- Partial contact populations must never be saved or displayed as complete.

### HighLevel contact retrieval

The server first attempts a read-only tag-filtered contact search. If HighLevel does not return a usable tag-filtered population, the server may scan contacts read-only and apply the tag locally.

The fallback:

- Uses `GET /contacts/`.
- Uses `startAfter` and `startAfterId` cursors.
- Requests up to 500 pages of 100 contacts.
- Covers up to 50,000 contacts.
- Fails explicitly if the ceiling is reached, a required cursor is missing, or a cursor repeats.

This avoids HighLevel's 10,000-result page-offset restriction.

### Conversation anchoring

For each candidate:

1. Export messages inside the selected date range.
2. Find the outbound message containing the required distinctive phrase.
3. Treat the actual matched outbound message as the promoted offer.
4. Keep every message from that matched outbound message onward.
5. Reshape those messages in memory into bounded structured objects containing direction, time, channel, and text.
6. Use that complete post-blast conversation as the primary classification context.

There is no unanchored date-window fallback. Messages before the matched blast and unrelated conversation history are excluded.

### Classification

Allowed results:

- Positive
- Negative
- Neutral
- Opt-out
- Needs review

Definitions:

- **Positive:** the customer shows interest in the promoted service, requests relevant pricing or details, asks a relevant service question, requests next steps, or indicates intent to visit, book, or continue.
- **Negative:** the customer clearly declines, rejects, or expresses no interest in the promoted offer.
- **Neutral:** the reply is understandable but neither accepts nor rejects the promoted offer. This includes acknowledgements, identity questions, temporary deferrals, and inquiries only about a different service.
- **Opt-out:** read-only HighLevel overall DND, active/permanent DND for the matched channel, a standalone `STOP`, or an unambiguous stop-contact instruction.
- **Needs review:** exceptional cases with no usable inbound text, call-only evidence without text intent, or a genuinely irreconcilable conversation.

Important interpretation rules:

- `I'll stop by tomorrow` is Positive when it expresses intent to visit; it is not an opt-out.
- Different-service-only interest is Neutral for the analyzed blast, not Negative.
- Needs review must not become a default for short, cautious, or ordinary replies.
- Deterministic DND and opt-out rules take precedence over AI.

### AI behavior

- AI runs on the server through OpenRouter or an approved OpenAI-compatible configuration.
- AI receives the matched outbound offer and the complete structured post-blast conversation.
- AI does not receive HighLevel tokens, ClickUp tokens, Supabase keys, encryption keys, DND metadata, or unrelated contact history.
- Invalid, unavailable, or timed-out AI responses fall back to local conversation rules.
- The result identifies AI, Rules, Rules fallback, or Sample as the method.
- Only sanitized summaries, evidence excerpts or IDs, confidence, service relevance, and review state are persisted.

### Background jobs and progress

Live analysis is asynchronous:

1. The run endpoint returns a job ID with HTTP 202.
2. The server performs the read-only analysis in the background.
3. The browser polls job status every three seconds.
4. The UI updates progress without re-rendering the entire page.
5. Completion saves and displays the client-scoped analysis.

Visible phases:

- Preparing
- Contact scan
- Conversation export
- Blast matching
- Reply classification
- Saving
- Complete

The panel shows a percentage, contextual Lead Hero action verb, safe detail, and aggregate count. It must not show contact names, message text, raw conversations, or secrets. Polling continues while the server reports a readable running job; three consecutive status failures stop the browser with a connection-specific error.

### Client-scoped results

- The selected client remains selected throughout a run.
- The selector is locked while that run is active.
- Saved analyses are filtered by `clientId`.
- An in-memory result is ignored when it belongs to another client.
- Changing clients shows that client's newest analysis or a client-specific empty state.
- **Clear loaded result** hides the current UI result only; it does not delete saved data.

## 6. Monthly Check

The monthly check supports a month or custom date range and may include a saved Blast Analyzer result.

Expected sections:

- System Health
- Usage and Activity
- Calls
- Blasts
- Issues
- Next Month Focus

Traffic-light meanings:

- **Green:** expected evidence is present and no material issue is detected.
- **Yellow:** the system is partially healthy, incomplete, or requires attention.
- **Red:** a material expected outcome is absent or failed.

No leads in a selected period must not automatically make routing Red. Missing setup or unavailable evidence should be stated explicitly.

## 7. Reports and ClickUp

- Monthly reports are stored as drafts until posted.
- The generated comment is visible for review.
- Posting requires explicit confirmation.
- The only supported external write is a comment to the client's configured ClickUp task.
- The tool stores the ClickUp comment ID and posting state.
- A failed post must not discard the generated report.

Required report structure:

```text
Lead Hero (Software) - [Green / Yellow / Red] - [Month] [Client Name]

System Health:
Routing Working: Yes / No / Partial
Automations Firing: Yes / No / Partial
Tracking / Attribution Intact: Yes / No / Partial

Usage & Activity:
Leads Received:
Answered vs Missed:

Blasts (if applicable):
Blast(s) Sent: Yes / No
Type: SMS / Email
Sends:
Delivery Rate:
Replies / Engagement:

Issues:
(Required if Yellow or Red)

Next Month Focus:
(Fixes, optimizations, or recommendations)
```

## Primary App Flows

### First-time setup

1. An Admin creates the user's account if needed.
2. The user signs in.
3. The user opens Clients.
4. The user adds the client, location ID, encrypted read-only PIT, ClickUp task ID, timezone, and lead-flow settings.
5. The user adds routing staff-contact evidence and confirms `New form submission`.
6. The user tests only the read-only HighLevel connection.

### Monthly check

1. Open Monthly Check.
2. Select client.
3. Select month or custom range.
4. Choose a saved Blast analysis when applicable.
5. Run the read-only check.
6. Review evidence and traffic-light status.
7. Review the generated comment.
8. Confirm the ClickUp post.

### Blast Analyzer

1. Open Blast Analyzer.
2. Select client and message date range.
3. Enter reply tag.
4. Enter the mandatory distinctive blast phrase.
5. Start the background analysis.
6. Follow contact, conversation, anchor, classification, and saving progress.
7. Review every tagged-contact row and diagnostic.
8. The completed analysis saves automatically and can be selected in a monthly report.

There is no separate Save Analysis button in the current workflow.

## Scheduling

Scheduled monthly checks remain a future option. The product must first establish trust in the manual monthly workflow. A future scheduler may prepare a draft, but it must not automatically post to ClickUp without an explicit change in product approval.

## Audit Requirements

Sanitized audit events cover:

- Login success and failure
- Client creation and update
- Client HighLevel disconnect
- Routing setup changes
- Monthly report generation
- Blast analysis generation or failure
- ClickUp post success or failure
- User creation
- Role and active-status changes
- Self-password changes
- Admin-managed password resets
- Blocked protected-Admin, self-modification, and last-Admin actions

Audit messages must not contain secrets, password data, IP addresses, Auth tokens, or raw conversation text.

## Current Implementation and Verification Boundary

Implemented locally:

- Plain Node server and static browser application
- Supabase Auth and server-side application storage
- Admin/User authorization and user management
- Encrypted client HighLevel PIT storage
- Read-only HighLevel endpoint allowlist
- Blast phrase anchoring and complete post-blast classification
- DND/STOP and service-relevance safeguards
- 50,000-contact cursor fallback
- Background Blast jobs and visible progress
- Client-scoped Blast results
- Monthly report generation and reviewed ClickUp posting path

Current testing priority:

- Blast Analyzer has received the most recent functional testing and fixes.
- HighLevel safety boundaries have been reviewed.
- Routing Setup, lead-flow checks, Monthly Check, and live ClickUp commenting remain scheduled for deeper product validation and may be revised after that review.

The presence of an implemented screen or route does not mean that its live workflow has completed final acceptance testing.

## MVP Acceptance Criteria

- Only active Admin and User accounts can enter the application.
- Public signup and email-recovery routes do not exist.
- Both roles can access all clients; only Admin can manage users and view security audit events.
- A new client PIT is encrypted and never returned to the browser.
- No HighLevel write endpoint, action, or UI control exists.
- A Blast run requires the outbound phrase and accounts for every tagged candidate.
- No contact is classified without a matching outbound blast and a later inbound reply.
- Full post-blast context, not only the latest reply, drives classification.
- HighLevel DND and unambiguous opt-out language take deterministic precedence.
- Large fallback scans use cursors, stop at the safety ceiling, and never present a partial population as complete.
- Long live Blast runs return a job ID and show observable progress.
- Blast results cannot leak from one client selection to another.
- ClickUp posting happens only after user review and confirmation.
- Passwords, tokens, secrets, and raw conversations do not appear in UI, API projections, audit events, or logs.

## Success Metrics

- Reduce hands-on monthly-check time by at least 70% after the monthly workflow is validated.
- Produce the required monthly comment structure consistently.
- Let users identify Green, Yellow, and Red conditions without manually opening every HighLevel section.
- Account for blast-tagged contacts without manually opening every conversation.
- Make long Blast runs understandable through real phase progress.
- Produce no HighLevel write or outbound communication.
- Produce no cross-client result confusion.
- Keep Needs review exceptional instead of using it as a default classification.

## Future Decisions

- Whether Routing Setup, lead-flow checks, and Monthly Check should remain in their current form after planned workflow validation.
- Whether job state should move from the ephemeral local filesystem to a durable queue before production deployment.
- Final production hosting and operational monitoring.
- Whether a paid Supabase plan and additional Auth controls are justified.
- Data-retention and deletion policies for saved summaries and reports.
- Whether HighLevel message export consistently exposes enough source metadata to distinguish workflow messages in every account.
- Whether HighLevel can reproduce any required saved Smart List or workflow-finished filter through public read endpoints.
- The final ClickUp hierarchy: persistent client task, monthly task, or another reviewed structure.
- Evidence thresholds for Green, Yellow, and Red across routing, attribution, missed calls, and blast performance.
