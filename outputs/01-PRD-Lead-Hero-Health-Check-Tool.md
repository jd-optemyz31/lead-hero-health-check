# Product Requirements Document

## Product Name

Lead Hero Health Check Tool

## Problem Statement

Lead Hero account maintenance checks are currently manual. CAMs or operators review each client account to confirm that Lead Hero is functioning correctly, leads are being routed, automations appear healthy, attribution is intact, calls are being handled, and blasts are performing.

This process is repetitive, time-consuming, and easy to make inconsistent across clients. It also depends on manually checking several areas inside HighLevel and then writing a structured monthly comment in ClickUp.

The tool solves this by reading HighLevel data, analyzing account health for a selected date range, generating a traffic light status, and preparing or posting the required ClickUp check-in comment.

## Target Users

### Primary Users

Client Account Managers and operations team members responsible for monthly account maintenance.

They are comfortable using HighLevel and ClickUp, but they should not need to inspect raw API data or technical logs. They want a simple way to select a client, choose a date range, run checks, review evidence, and post the report.

### Secondary Users

Leadership and managers who need a clear software-level signal across clients.

They want to know which accounts are healthy, which need attention, and which have immediate system-level issues.

## Product Vision

Create a safe, read-only HighLevel audit tool that turns manual Lead Hero maintenance checks into consistent, evidence-based monthly reports.

The long-term version becomes a central health dashboard for all Lead Hero clients, with scheduled check-ins, blast analysis, trend tracking, and ClickUp reporting.

## Core Principles

- HighLevel access is read-only.
- The tool must not send SMS, email, calls, workflow enrollments, or any outbound communication to account contacts.
- ClickUp is the only write destination in version one.
- Blast Analyzer must be runnable anytime, independent of monthly reporting.
- Monthly reports must be reviewable before posting to ClickUp.
- The tool should use evidence from HighLevel instead of relying on manual judgment.
- Public signup is disabled. Admin-created accounts through the in-tool Invite user form are the only new-account path.
- Authorization uses two application roles, Admin and User, and every protected API enforces its role independently of frontend visibility.

## Core Features

### Clients

**Priority:** Must-have

Store each client setup:

- Client name
- HighLevel location/sub-account ID
- HighLevel Private Integration Token
- ClickUp task ID
- Timezone
- Default reporting preferences
- Form lead tag, defaulting to `form lead`
- Active pipeline name or ID
- Expected first-reply stage name or ID

Admins and Users can disconnect a client's HighLevel account from the tool. Disconnecting removes the saved HighLevel Private Integration Token from the Health Check Tool only. It does not change, revoke, or delete anything inside HighLevel.

Admins and Users can edit all client connection details after setup, including timezone, location ID, ClickUp task ID, form lead tag, active pipeline, and first-reply stage. When editing an existing client, the Private Integration Token field is optional; leaving it blank keeps the saved encrypted token, and entering a new token replaces it.

### Authentication And Settings

**Priority:** Must-have

The app uses Admin-provisioned Supabase Auth email/password login. Supported application roles:

| Capability | Admin | User |
|---|---:|---:|
| View and manage all clients | Yes | Yes |
| Run checks and Blast Analyzer | Yes | Yes |
| Post reviewed ClickUp comments | Yes | Yes |
| View user directory | Yes | No |
| Invite/create, deactivate, reactivate, or change users | Yes | No |
| Change or reset passwords | Any active account | Own account |
| View security audit events | Yes | No |

Both roles have global client access. Existing client-assignment records remain preserved but do not authorize access.

Admin Settings includes a searchable user directory, role/status actions, manual account creation, password-reset actions, and paginated sanitized security events. User Settings includes current email/role, a self-service password-change form, and safe integration status. No settings response may expose secrets, sessions, IP addresses, password data, Auth metadata, tokens, or raw conversations.

`ADMIN_EMAILS` identifies protected bootstrap Admins. Those accounts cannot be deactivated or changed to User in the app. An Admin cannot change their own role or active status, and at least one active Admin must always remain. Permanent deletion is not included.

The Invite user form requires email, role, an Admin-set initial password with confirmation, and the signed-in Admin's current password. The account is created as confirmed and no email is sent. Self-service changes require the current password; Admin-managed resets require the acting Admin's current password. New passwords require 12 to 128 characters and confirmation. Password values are accepted only for these operations, sent directly to Supabase Auth, and never stored in application tables, returned by an API, displayed after submission, or written to audit events.

### Routing Setup

**Priority:** Must-have

Store routing audit settings for each client:

- Staff notification contact ID or phone number
- Expected routing phrase: `New form submission`
- Expected delay window

The tool checks whether internal notification messages were sent to staff contacts during the selected date range.

### Monthly Health Check

**Priority:** Must-have

Run a structured check for a selected client and date range.

The report includes:

- Routing Working
- Automations Firing
- Tracking / Attribution Intact
- Leads Received
- Answered vs Missed Calls
- Blasts, if applicable
- Issues
- Next Month Focus
- Overall traffic light: Green, Yellow, or Red

### Blast Analyzer

**Priority:** Must-have

Run anytime, separate from the monthly check.

Inputs:

- Client
- Date range
- Reply tag, such as `Replied to Blast`
- Optional blast workflow name or ID
- Blast message phrase, required to anchor the conversation to the outbound blast

Outputs:

- All reply-tagged candidate contacts
- Analyzed replies with both a matching outbound blast and later inbound message
- Positive replies
- Negative replies
- Neutral replies
- Opt-outs
- Needs review
- Conversation summaries
- Confidence score
- Offer relevance: Promoted service, Different service, or Unclear
- Read-only HighLevel DND indicator when applicable
- Analysis method: AI, HighLevel DND, rules fallback, or sample
- Review status
- Saved timestamp

AI classification is used only to summarize and categorize reply intent. It must not send messages, update HighLevel records, add tags, move opportunities, or trigger workflows.

AI should classify the customer's overall intent toward the specific service promoted in the matched outbound blast across the complete post-blast conversation, not only the latest inbound reply and not by a fixed phrase list. `Positive` means the contact shows genuine interest in the promoted service, asks a relevant buying or service question, requests pricing, details, or next steps, or indicates willingness to visit, book, or continue for that service. `Negative` means the overall customer conversation clearly declines or rejects the promoted offer or explicitly shows no interest in it. A different-service-only inquiry is `Neutral` for the blast because it neither accepts nor rejects the promoted offer. `Opt-out` takes precedence only when HighLevel reports the contact as DND for the blast channel or an inbound customer message contains a standalone `STOP` instruction or another unambiguous request not to be contacted. Normal language such as `Sounds good. I'll stop by tomorrow` is Positive rather than Opt-out. `Neutral` also includes temporary deferrals such as `not ready right now`, acknowledgements such as `okay, thanks`, and identity questions such as `who is this`. `Needs review` is exceptional and should only be used when there is no usable inbound customer text, the only evidence is a call record without text intent, or the complete conversation is genuinely irreconcilable. Short, cautious, or informal replies should not be marked `Needs review` by default.

When AI is used, the blast message phrase is required as a distinctive search anchor. The user does not need to paste the full blast into another field. The tool matches the anchor against an outbound message for each reply-tagged contact, automatically extracts the actual matched outbound blast as the promoted-offer context, and serializes every exported message from that blast onward within the selected date range as a structured in-memory JSON payload. The complete post-blast conversation is the primary classification evidence; outbound messages provide context while inbound customer messages provide intent. Before AI classification, the server reads the contact's overall and channel-specific HighLevel DND fields from the existing read-only contact result. The tool must not write a raw-conversation JSON file or persist the full thread, and it must not fall back to an unanchored selected-window conversation when the phrase is missing or no outbound match is found. Messages before the matched blast and conversation history outside the selected date range are not sent.

The results table must account for every contact returned with the reply tag. A candidate with no matching outbound phrase is listed as `Not analyzed — No blast match`; a candidate with a matched blast but no later inbound message is listed as `Not analyzed — No post-blast reply`. These diagnostic rows are excluded from Positive, Neutral, Negative, Opt-out, and Needs review counts and are never force-classified from an unanchored conversation.

When HighLevel's direct tag filter is unavailable or unreliable, the server may paginate the read-only contact list and apply the tag locally. HighLevel's page-number contact search is limited to a 10,000-result window, so the fallback must use the read-only Contacts endpoint with `startAfter` and `startAfterId` cursor values to continue beyond that boundary. The scan has a 50,000-contact safety ceiling and must fail the run if that ceiling is reached or a required next-page cursor is missing; it must never silently save a partial tagged-contact population as complete. The browser should keep polling a readable running job instead of abandoning it after a fixed 15-minute client-side timer.

Saved blast analyses should be shown newest first wherever they are selected for a monthly check. On the Blast Analyzer screen, the displayed analysis must always belong to the client currently selected in the Blast form. Changing clients loads only that client's newest saved analysis, or a client-specific empty state when none exists; it must never leave another client's result visible. Users can clear the currently loaded Blast Analyzer result from the screen so a fresh run can be reviewed without confusion. Clearing the loaded result must not delete the saved analysis from production storage and must not change anything in HighLevel.

### ClickUp Posting

**Priority:** Must-have

Generate the monthly comment in the required format and post it to the configured ClickUp task after user review.

### Workflow Metadata Check

**Priority:** Must-have

Read HighLevel workflow metadata where available:

- Workflow name
- Workflow ID
- Status
- Updated date

This confirms whether important workflows exist and are active. The tool should not claim to inspect every internal workflow node unless HighLevel exposes that data in the API.

### Outcome Testing Framework

**Priority:** Nice-to-have for MVP, important later

Define expected workflow outcomes, such as:

- Tag exists
- Note exists
- Opportunity exists
- SMS or email message exists

This is used to infer whether automations are firing correctly.

For the MVP, Automations Firing is checked through read-only outcome evidence:

1. A new contact was created in the selected date range with the configured form lead tag, usually `form lead`.
2. A matching opportunity exists for that contact in the configured active pipeline.
3. Staff notification evidence exists using the configured routing contact(s) and `New form submission` phrase.
4. If the contact sent a first reply, the matching opportunity is checked against the configured first-reply stage.

No first reply should not count as a reply-stage failure. The reply-stage check only applies after the contact has actually replied.

### Scheduled Monthly Checks

**Priority:** Nice-to-have

After manual reports are trusted, the tool can run monthly checks automatically and prepare draft reports.

## Traffic Light Definitions

### Green: Healthy

Lead Hero software is functioning as expected.

Typical signals:

- Routing notifications are being sent
- Required workflows are active
- Attribution is intact
- Calls are tracked
- Blasts are delivering and generating expected engagement, if used
- No major system or setup issues found

### Yellow: Needs Attention

Lead Hero is operational, but setup or usage needs adjustment.

Typical signals:

- Some routing evidence is missing
- Some workflows need review
- Attribution is incomplete
- Missed calls are high
- Blast replies or engagement are below expectations
- User behavior is limiting effectiveness

### Red: Immediate Issue

Lead Hero has a system-level issue impacting performance.

Typical signals:

- Required routing workflow missing or inactive
- Internal notifications not being sent
- Critical automation evidence missing
- Tracking or attribution appears broken
- Call reporting is missing or severely unhealthy
- Blast send/delivery appears failed

## Required Comment Format

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

## App Flow

### First-Time Setup

1. User opens the app.
2. User goes to Clients.
3. User adds a client with HighLevel location ID, read-only PIT token, ClickUp task ID, and timezone.
4. User goes to Routing Setup.
5. User adds staff notification contact details and confirms the expected phrase `New form submission`.

### Disconnecting A Client

1. Admin or User opens Clients.
2. Admin or User chooses Disconnect for the client.
3. Tool asks for confirmation.
4. Tool removes the encrypted HighLevel token and token preview from its own storage.
5. Client setup, routing setup, reports, and ClickUp task ID remain saved.
6. Live HighLevel checks are disabled until a new read-only PIT is saved.

### Editing Client Connection Details

1. Admin or User opens Clients.
2. Admin or User chooses Edit for the client.
3. Tool pre-fills all editable setup fields.
4. Admin or User updates timezone, location ID, ClickUp task ID, automation-flow fields, or other client metadata.
5. Admin or User leaves the PIT field blank to keep the saved token, or enters a new read-only PIT to replace it.
6. Tool saves the updated settings without calling or modifying HighLevel.

### Running A Monthly Check

1. User opens Monthly Check.
2. User selects client.
3. User selects month or custom date range.
4. User chooses whether to include saved blast analysis.
5. Tool pulls HighLevel data.
6. Tool generates health summary and traffic light.
7. User reviews the report.
8. User posts the final comment to ClickUp.

### Running Blast Analyzer Anytime

1. User opens Blast Analyzer.
2. User selects client.
3. User selects date range.
4. User enters reply tag, such as `Replied to Blast`.
5. User optionally selects a workflow name/ID and enters the required blast message phrase.
6. User clicks Run Analysis. For live HighLevel clients, the server starts a background job and returns a job ID immediately. The button changes to "Running..." and the results area shows an in-progress panel.
7. The frontend polls the job status every 3 seconds. The progress panel shows an overall percentage, current phase, contextual Lead Hero action verb, and phase-specific count from contact scanning through saving.
8. Tool finds matching contacts and conversations, automatically extracts each matched outbound blast as the promoted-offer context, and reads overall/channel-specific DND state from the HighLevel contact response.
9. Active HighLevel DND or an explicit opt-out is classified as Opt-out. Remaining replies are classified against the promoted service with AI when `OPENROUTER_API_KEY` or `OPENAI_API_KEY` is configured, otherwise the built-in rules fallback is used.
10. When the job completes, every reply-tagged candidate appears in the results. Safely anchored replies are classified; missing blast matches and missing post-blast replies remain visible as Not analyzed diagnostics.
11. The completed result stays associated with the submitted client. Selecting a different client displays only that client's newest saved result, or a client-specific empty state.
12. Saved blast analyses appear newest first with saved date and time.
13. User can clear the currently displayed analysis from the Blast Analyzer screen without deleting it from storage.
14. Saved blast analysis can later be attached to a monthly report.

For live HighLevel checks, the reply tag identifies the candidate contacts, but the selected date range should apply to inbound conversation messages. Older contacts who reply during the selected blast window should still be included.

The live progress panel must represent the actual pipeline rather than a decorative timer. Its phases cover contact scanning, conversation export, outbound-phrase anchoring, reply classification, and saving. Progress text must describe Lead Hero marketing-blast analysis; explosive-engineering terminology is out of scope and must not be used.

## MVP Scope

Version one includes:

- Client setup
- Routing setup
- Date selector
- Monthly check generation
- Blast Analyzer
- Read-only HighLevel data pull
- Reviewable report
- ClickUp comment posting
- Saved reports and blast analyses
- Invite-only authentication with Admin and User roles
- User Settings, Admin user management, in-tool password management, and sanitized audit history

## Not In Version One

- Sending SMS or email
- Calling contacts
- Adding contacts to workflows
- Updating contacts, tags, opportunities, or workflows in HighLevel
- Marketplace app or OAuth public install flow
- Full workflow node inspection
- Fully automatic posting without review
- Replacing HighLevel workflows
- Updating opportunities when a reply is found

## Success Metrics

- Time to complete a monthly check decreases by at least 70%.
- Monthly comments follow the required format consistently.
- CAMs can identify Green, Yellow, and Red accounts without manually checking every HighLevel section.
- Blast reply analysis can be completed without manually opening each conversation.
- No outbound communication is sent from the tool.

## Open Questions

- Does HighLevel message export reliably return enough message metadata to separate workflow messages from other outbound messages for every account?
- Does HighLevel contact search support the same workflow-finished filter available in Smart Lists?
- What exact ClickUp hierarchy will be used: one task per client, one task per month, or a parent client task with monthly comments?
- What thresholds should define Green, Yellow, and Red for routing, attribution, missed calls, and blast performance?
