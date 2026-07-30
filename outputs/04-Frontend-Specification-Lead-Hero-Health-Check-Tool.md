# Frontend Specification Document

## Product Name

Lead Hero Health Check Tool

## UI Direction

The app should feel like an internal operations dashboard: clear, calm, efficient, and built for repeated monthly use.

Avoid marketing-style sections. The first screen after login should be useful immediately.

Use the Lead Hero logo as the brand anchor. The visual theme should come from the logo: gold accents, white/light surfaces, soft silver-gray separators, and dark charcoal text. Gold should be used for primary actions and brand highlights, not as a full-page background.

## Brand Assets

### Logo

Use the provided Lead Hero logo in the app shell and login screen.

Logo file:

```text
C:/Users/jawad/Downloads/LH-Desktop (1).png
```

Recommended usage:

- Sidebar/app header logo on a dark charcoal background
- Login screen logo on dark charcoal or white, depending on contrast
- Do not stretch or crop the logo
- Keep clear space around the logo equal to at least the height of the circular mark's inner bars
- Avoid placing the white logo text on pale backgrounds where it becomes unreadable

## Navigation

Primary navigation:

- Clients
- Routing Setup
- Blast Analyzer
- Monthly Check
- Reports
- Settings

## Key Screens

### Clients

Purpose:

Manage client account connections.

Main elements:

- Client table
- Add Client button
- Search input
- Status indicator for connected/missing setup
- Admin/User Edit action for client connection details
- Admin/User Disconnect action for saved HighLevel connection
- Client detail drawer or page

Fields:

- Client name
- HighLevel location ID
- HighLevel Private Integration Token
- ClickUp task ID
- Timezone
- Form lead tag, default `form lead`
- Active pipeline name or ID
- First reply stage name or ID
- Reply movement window

Timezone should be a dropdown selector using IANA timezone IDs, not a free-text field. Use the browser-supported timezone list where available.

Safety text near token field:

```text
Use a read-only HighLevel Private Integration Token.
```

Disconnect behavior:

- Show Disconnect to Admin and User accounts only when a token is saved.
- Require confirmation before disconnecting.
- Confirmation copy should explain that the action removes the saved token from the Health Check Tool only.
- Do not imply that the HighLevel account, contacts, opportunities, workflows, or token inside HighLevel will be changed.
- After disconnecting, show the client as missing a HighLevel token and disable live connection tests.

Edit behavior:

- Show Edit to Admin and User accounts.
- Pre-fill all editable fields except the plaintext PIT.
- On edit, the PIT field should be optional and should say that leaving it blank keeps the saved token.
- Saving client metadata should not call HighLevel.

### Routing Setup

Purpose:

Configure how the tool verifies internal new-lead notifications.

Main elements:

- Client selector
- Staff notification contacts table
- Add staff contact button
- Expected phrase input
- Expected delay selector
- Test check button

Default phrase:

```text
New form submission
```

Fields:

- Staff contact ID
- Staff phone number
- Expected phrase
- Expected delay window

### Blast Analyzer

Purpose:

Analyze blast replies anytime, independent of monthly reports.

Main elements:

- Client selector
- Date range selector
- Reply tag input
- Optional workflow name or ID input
- Required blast message phrase input
- Run Analysis button
- Results summary
- Reply classification table
- Save Analysis button
- Clear loaded result button when an analysis is displayed

Result cards:

- Total reply-tagged contacts
- Analyzed replies
- Positive
- Negative
- Neutral
- Opt-out
- Needs review

Table columns:

- Contact
- Last reply date
- Classification
- Confidence
- Summary
- Evidence
- Offer relevance / DND
- Method
- Review status

Saved blast analyses should be sorted newest first in selection controls. Option labels should include client, saved date/time, analysis date range, reply tag, and source where practical. The result area is scoped to the Blast form's selected client: changing the client immediately shows only that client's newest saved analysis, or an empty state naming the selected client when it has no analysis. A result from another client must never remain visible. The selected client and entered Blast form values should survive normal Blast-view re-renders. While a submitted analysis is running, its client selector is locked and the completed result restores the submitted client context. Clearing a loaded Blast Analyzer result should only hide the current on-screen result; it must not delete the saved analysis from storage.

### Monthly Check

Purpose:

Generate the required Lead Hero maintenance report.

Main elements:

- Client selector
- Month selector
- Custom date range option
- Include saved blast analysis toggle
- Saved blast analysis selector
- Run Monthly Check button
- Traffic light result
- Evidence sections
- Generated ClickUp comment preview

The saved blast analysis selector should show the latest saved analysis at the top and include the saved date/time so repeated runs can be distinguished.

Sections:

- System Health
- Usage & Activity
- Calls
- Blasts
- Issues
- Next Month Focus

Automations Firing evidence should show:

- Form-lead contacts found
- Active-pipeline opportunities found
- Staff notification matches
- First replies found
- Replied contacts confirmed in the expected reply stage

If no first reply exists for a contact, the UI should not show that contact as a reply-stage failure.

### Reports

Purpose:

View saved monthly reports and blast analyses.

Main elements:

- Report table
- Filters by client, month, status
- Open report details
- Re-post to ClickUp with confirmation if needed

### Settings

Purpose:

Provide safe account controls and connection status to both roles, plus user administration and security events to Admin.

User Settings elements:

- Current email and role
- Self-service password-change form requiring current password, new password, and confirmation
- Safe HighLevel, ClickUp, AI, storage, and authentication status
- No credential, token, password, IP address, session, Auth metadata, or raw-conversation values

Additional Admin Settings elements:

- Searchable, paginated user directory
- Email, role, active status, created date, and last sign-in
- Invite user form with email, role selector defaulting to User, initial password, confirmation, and the acting Admin's current password
- Role change, deactivate/reactivate, and password-reset actions
- Confirmation dialogs for role changes and deactivation
- Paginated sanitized security audit events

Environment-managed Admins and the signed-in Admin's own role/status controls are disabled. Permanent deletion is not offered.

Invite user creates a confirmed account immediately and sends no email. Admin password reset opens a password form for an active non-self account and requires the acting Admin's current password. Password fields are cleared after submission and password values are never displayed afterward.

### Login And Password Management

- The login screen has no signup form or signup link.
- The login screen has no forgot-password or email-recovery form; locked-out users contact an Admin.
- The self-service form requires the current password, a matching confirmation, and 12 to 128 characters.
- A successful self-service change clears the current session and requires a fresh login.
- The Admin reset form cannot target the signed-in Admin; that account uses self-service Change password.

## Design System

### Colors

Use a restrained Lead Hero operations-dashboard palette. The interface should not become a one-color gold UI; use gold for emphasis and actions, charcoal for structure, and white/gray for working surfaces.

```text
Brand Gold: #F5A800
Brand Gold Hover: #D98F00
Brand Gold Soft: #FFF4D6
Brand Gold Border: #F2C15B
Charcoal: #151515
Charcoal Soft: #242424
Background: #F7F6F2
Surface: #FFFFFF
Surface Subtle: #FBFAF7
Border: #DDD8CC
Divider: #E8E3D8
Text Primary: #171717
Text Secondary: #4F4A42
Muted Text: #777063
Success: #16A34A
Warning: #D98F00
Danger: #DC2626
Info: #2563EB
```

Traffic lights:

```text
Green: #16A34A
Yellow: #F59E0B
Red: #DC2626
```

### Typography

Recommended font:

```text
Inter
```

Type scale:

```text
Page title: 24px / 32px / 600
Section title: 18px / 28px / 600
Card title: 15px / 24px / 600
Body: 14px / 22px / 400
Small text: 12px / 18px / 400
Button: 14px / 20px / 500
```

Letter spacing should be 0.

### Layout

- Sidebar width: 240px desktop
- Main content max width: 1280px
- Page padding: 24px desktop, 16px mobile
- Section spacing: 24px
- Form row gap: 16px
- Card radius: 8px maximum
- Button height: 36px to 40px
- Table row height: 44px minimum

### Components

#### Buttons

Primary:

- Brand Gold background
- Charcoal text
- Used for main actions like Run Check, Save, Post to ClickUp
- Hover uses Brand Gold Hover with white text if contrast is stronger

Secondary:

- White background
- Border
- Used for Cancel, Preview, Open

Sidebar:

- Charcoal background
- White or near-white text
- Active nav item uses Brand Gold accent bar or gold-tinted background

Danger:

- Red text or red background depending on severity
- Used only for destructive actions

Icon buttons should use recognizable icons with tooltips.

#### Inputs

Use labeled fields with clear validation.

Important fields:

- Client name
- Location ID
- PIT token
- ClickUp task ID
- Date range
- Reply tag
- Expected phrase

#### Date Selector

Monthly Check should support:

- Month picker
- Custom date range

Blast Analyzer should support:

- Start date
- End date
- Quick presets such as Last 7 days, Last 30 days, This month, Last month

#### Status Badges

Use badges for:

- Green / Yellow / Red
- Connected / Missing Setup
- Posted / Draft
- Positive / Negative / Neutral / Opt-out / Needs Review

#### Tables

Tables should support:

- Search
- Sort
- Filter
- Empty states
- Loading states

## API And Integration Spec

### HighLevel

Purpose:

Read account evidence for maintenance checks.

Authentication:

```http
Authorization: Bearer <PRIVATE_INTEGRATION_TOKEN>
Version: 2021-07-28
```

Data used:

- Contacts
- Conversations/messages
- Calls through message export with channel `Call`
- Workflows metadata
- Opportunities
- Tags
- Custom fields
- Calendar events if needed

Automations Firing uses read-only outcome evidence from contacts, conversations/messages, and opportunities. The app checks the configured form lead tag, active pipeline, staff notification phrase, and first-reply stage. It does not update opportunities or trigger workflows.

Frontend behavior:

- User should never see raw PIT token after saving.
- HighLevel errors should be translated into clear setup messages.
- No screen should include a Send, Message, Call, Enroll, Add Tag, or Update Contact action.
- Disconnecting a client should clear this tool's saved token only; it should not call any HighLevel endpoint.

### ClickUp

Purpose:

Post reviewed report comment to a client task.

Data used:

- ClickUp task ID
- Generated comment body

Frontend behavior:

- User previews comment before posting.
- If already posted, app asks for confirmation before posting again.

### AI Classification

Purpose:

Classify blast replies.

Inputs:

- Contact conversation messages within selected date range
- Blast context, if provided

Outputs:

- Classification
- Short summary
- Evidence excerpt or evidence message IDs
- Confidence
- Offer relevance: Promoted service, Different service, or Unclear
- Read-only HighLevel DND indicator and channel when applicable
- Method: AI, rules fallback, or sample
- Review status

Allowed labels:

- Positive
- Negative
- Neutral
- Opt-out
- Needs review

AI should classify the customer's overall intent toward the service promoted in the actual matched outbound blast across the complete post-blast conversation rather than a fixed phrase list or only the latest reply. Positive includes genuine interest in the promoted service, relevant pricing/detail questions, relevant service questions, next-step requests, and willingness to visit, book, or continue for that service. Negative requires a clear decline, rejection, or explicit lack of interest in the promoted offer. A different-service-only inquiry is Neutral because it neither accepts nor rejects that offer. Temporary deferrals such as `not ready right now`, acknowledgements such as `okay, thanks`, and identity questions such as `who is this` are also Neutral unless the wider conversation supports another label. Overall/channel-specific HighLevel DND, a standalone `STOP`, or an unambiguous stop-contact request takes Opt-out precedence. Normal language such as `I'll stop by tomorrow` is not an opt-out. Needs review is exceptional and should be reserved for no usable inbound text, call-only evidence without text intent, or a genuinely irreconcilable conversation.

For live HighLevel analysis, the blast phrase is required as a distinctive matching anchor; users do not need to paste the full blast twice. The server automatically extracts the actual matched outbound blast as the promoted-offer context. AI should receive that offer and every exported message from the matched outbound blast onward inside the selected date range as a structured in-memory JSON conversation. The complete conversation is the primary evidence; outbound messages are context and inbound messages express customer intent. Every reply-tagged candidate should appear in the table. Contacts without a matching outbound blast must not use an unanchored fallback and should show `Not analyzed — No blast match`; contacts with a matching blast but no later inbound message should show `Not analyzed — No post-blast reply`. The result row should indicate offer relevance or read-only HighLevel DND state, how many post-blast messages were reviewed, and whether the thread was anchored to the matched blast.

Frontend behavior:

- AI classification should be editable by the user.
- Only genuinely unusable or irreconcilable conversations should be marked Needs review; ordinary uncertainty, brevity, or hesitation should normally resolve to Neutral.
- The Blast Analyzer results table should be headed All tagged contacts and show Contact, Last reply date, Classification, Confidence, Summary, Evidence, Offer relevance / DND, Method, and Review status.
- The Settings screen should show whether AI classification is connected without exposing the OpenAI API key.

## Empty States

### No Clients

Show a simple setup prompt:

```text
Add your first client to start running Lead Hero health checks.
```

### No Blast Replies

```text
No matching blast replies were found for this date range and tag.
```

### No Monthly Data

```text
No matching activity was found for this client and date range.
```

## Loading States

Long-running checks should show step progress:

- Loading contacts
- Checking routing messages
- Reading call activity
- Reviewing attribution
- Analyzing blast replies
- Generating report

### Blast Analyzer Async Progress

Because live blast analysis runs as a background job, the Blast Analyzer has its own in-progress state:

- After submitting the form, the Run Analysis button changes to "Running..." and becomes disabled.
- A branded progress panel replaces the results area with an overall percentage, gold progress bar, current phase, contextual action verb, detail, and phase-specific count.
- The real phases are Preparing, Contact scan, Conversation export, Blast matching, Reply classification, Saving, and Complete.
- Contextual verbs use bracketed Lead Hero language such as `[Sweeping contact pages...]`, `[Gathering conversation trails...]`, `[Anchoring outbound blast messages...]`, and `[Reading reply intent...]`. Do not use explosives or demolition terminology.
- Contact scanning shows contacts inspected, conversation export shows completed date windows, and classification shows reviewed versus total tagged contacts.
- The progressbar must expose `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and descriptive `aria-valuetext`. Its pulse and shimmer animations must stop when the user prefers reduced motion.
- When the job completes, the results appear automatically and the button re-enables.
- If the job errors, an error toast is shown and the button re-enables.
- If the read-only contact scan reaches its 50,000-contact safety ceiling, show a clear incomplete-scan error and do not display the partial population as a completed analysis.
- Do not describe HighLevel's 10,000-result page-offset restriction as a generic timeout. The server should continue the read-only fallback with contact cursors; only a missing/repeated cursor or the 50,000-contact ceiling should produce an incomplete-scan error.
- Continue polling for as long as the server returns a readable `running` job. Do not abandon a healthy large-account analysis after a fixed 15-minute browser timeout; stop only on a final job error or three consecutive status-connection failures.

## Validation Rules

- Client name is required.
- HighLevel location ID is required.
- HighLevel PIT token is required.
- HighLevel PIT token is required when adding a new client, but optional when editing an existing client with a saved token.
- ClickUp task ID is required before posting.
- Blast Analyzer requires client, date range, reply tag, and blast message phrase.
- Monthly Check requires client and date range.
- Date end cannot be before date start.
- Invite user requires a valid email, Admin/User role, initial password confirmation, and the acting Admin's current password.
- Password and confirmation must match and contain 12 to 128 characters; self-service changes also require the current password.

## Accessibility

- All form fields need labels.
- Tables should be keyboard navigable.
- Traffic light status must include text, not color only.
- Error messages should be visible near the related field.
- Buttons need clear disabled/loading states.

## MVP UI Priorities

Build in this order:

1. Clients
2. Routing Setup
3. Monthly Check
4. Blast Analyzer
5. ClickUp preview/posting
6. Reports history

The first release should prioritize accurate data and safe review workflows over decorative visuals.
