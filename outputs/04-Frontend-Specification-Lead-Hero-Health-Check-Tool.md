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
- Admin-only Edit action for client connection details
- Admin-only Disconnect action for saved HighLevel connection
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

- Show Disconnect only for admins and only when a token is saved.
- Require confirmation before disconnecting.
- Confirmation copy should explain that the action removes the saved token from the Health Check Tool only.
- Do not imply that the HighLevel account, contacts, opportunities, workflows, or token inside HighLevel will be changed.
- After disconnecting, show the client as missing a HighLevel token and disable live connection tests.

Edit behavior:

- Show Edit only for admins.
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
- Optional blast message phrase input
- Run Analysis button
- Results summary
- Reply classification table
- Save Analysis button

Result cards:

- Total replied contacts
- Positive
- Negative
- Neutral
- Opt-out
- Needs review

Table columns:

- Contact
- Last reply date
- Classification
- Summary
- Evidence
- Review status

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

Manage users, API settings, and safe defaults.

Main elements:

- Users
- Roles
- ClickUp API connection status
- HighLevel API version
- Security settings

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
- Evidence message IDs

Allowed labels:

- Positive
- Negative
- Neutral
- Opt-out
- Needs review

Frontend behavior:

- AI classification should be editable by the user.
- Any uncertain result should be marked Needs review.

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

## Validation Rules

- Client name is required.
- HighLevel location ID is required.
- HighLevel PIT token is required.
- HighLevel PIT token is required when adding a new client, but optional when editing an existing client with a saved token.
- ClickUp task ID is required before posting.
- Blast Analyzer requires client, date range, and reply tag.
- Monthly Check requires client and date range.
- Date end cannot be before date start.

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
