# Frontend Specification Document

## Product

Lead Hero Health Check Tool

## Document Status

- Updated: July 31, 2026
- Describes the implemented static frontend and current product behavior
- No React, TypeScript, Tailwind CSS, shadcn, or Radix dependency is used

## Experience Goal

The interface should feel like a focused internal operations dashboard:

- Immediate utility after login
- Clear client context
- Calm, readable evidence
- Safe and explicit external actions
- Visible progress for long-running analysis
- Minimal risk of confusing one client's data with another's

It should not resemble a campaign builder or include CRM action controls.

## Frontend Architecture

The frontend is implemented with:

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/assets/lead-hero-logo.png`

Rendering uses JavaScript template strings and direct DOM event binding. Server APIs return JSON. There is no compile or bundling step.

The progress component is a native HTML/CSS implementation rather than a copied React/Radix component because the project is not a React/shadcn codebase.

## Brand Direction

Use Lead Hero's visual language:

- Gold for primary actions and emphasis
- Charcoal for navigation and structure
- White and soft neutral surfaces for working content
- Green, amber, and red only for status meaning

Logo:

```text
public/assets/lead-hero-logo.png
```

The app must use the bundled project asset, not an absolute path to a user's Downloads directory.

## Color System

```text
Brand Gold:       #F5A800
Brand Gold Hover: #D98F00
Brand Gold Soft:  #FFF4D6
Gold Border:      #F2C15B
Charcoal:         #151515
Charcoal Soft:    #242424
Background:       #F7F6F2
Surface:          #FFFFFF
Surface Subtle:   #FBFAF7
Border:           #DDD8CC
Divider:          #E8E3D8
Text Primary:     #171717
Text Secondary:   #4F4A42
Muted Text:       #777063
Success:          #16A34A
Warning:          #D98F00
Danger:           #DC2626
Info:             #2563EB
```

Status must always use a text label in addition to color.

## Typography and Density

Preferred font:

```text
Inter, with a system sans-serif fallback
```

Recommended scale:

```text
Page title:    24px / 32px / 600
Section title: 18px / 28px / 600
Card title:    15px / 24px / 600
Body:          14px / 22px / 400
Small:         12px / 18px / 400
Button:        14px / 20px / 500
```

Layouts should remain compact enough for operational tables without reducing readability.

## Layout Measurements

Target desktop values:

```text
Sidebar width:          240px
Main content max width: 1280px
Desktop page padding:   24px
Mobile page padding:    16px
Section spacing:        24px
Form gap:               16px
Card radius:            8px maximum
Button height:          36px to 40px
Table row height:       44px minimum
```

## Application Shell

Desktop:

- Dark left sidebar
- Lead Hero logo
- Primary navigation
- Signed-in user identity
- Logout control
- Main content area on a light background

Mobile:

- Navigation adapts to the available width.
- Forms collapse to one column.
- Tables remain horizontally usable.
- Dialogs fit the viewport.

## Navigation

Current primary navigation:

- Clients
- Blast Analyzer
- Monthly Check
- Reports
- Settings

Routing Setup is part of the Clients screen in the current implementation rather than a separate primary navigation item.

Settings appears for both roles. Admin-only sections are conditionally rendered for Admin.

## Global Interface Rules

- Every input has a visible label.
- Main actions have explicit loading and disabled states.
- Errors appear as safe toasts or near the relevant workflow.
- Empty states name the selected client where context matters.
- No UI exposes a plaintext saved PIT.
- No UI includes Send, Message, Call, Enroll, Add Tag, Update Contact, or workflow-trigger controls.
- External writes must be identifiable and confirmed.

## Login

Elements:

- Lead Hero branding
- Email
- Password
- Sign in button
- Safe error message

Not present:

- Signup
- Forgot password
- Email recovery
- Temporary password generation

Inactive and unprovisioned users receive a safe access error.

## Clients Screen

Purpose:

- Manage account configuration.
- Manage the stored read-only HighLevel connection.
- Configure routing evidence.

### Client list

Show:

- Client name
- Connection status
- HighLevel location ID
- Timezone
- ClickUp task ID status
- Edit
- Disconnect when a token exists

Both Admin and User can manage clients.

### Add/edit client form

Fields:

- Client name
- HighLevel location ID
- Read-only PIT
- ClickUp task ID
- IANA timezone selector
- Form-lead tag
- Active pipeline name/ID
- First-reply stage name/ID
- Reply movement window

Behavior:

- PIT is required for a new live client.
- Existing plaintext PIT is never prefilled.
- Edit placeholder explains that blank preserves the saved PIT.
- Saving metadata does not call HighLevel.

Safety copy:

```text
Use a read-only HighLevel Private Integration Token.
```

### Disconnect

- Available only when a saved token exists.
- Requires confirmation.
- Copy states that only the Health Check Tool's saved token is removed.
- Must not imply the HighLevel account or token is changed.
- Existing reports, routing setup, and client metadata remain.

### Routing setup within Clients

Fields:

- Client
- Staff contact ID
- Staff phone
- Expected phrase
- Expected delay

Default phrase:

```text
New form submission
```

Safety copy states that checks are read-only and do not send or resend notifications.

## Blast Analyzer Screen

Purpose:

Analyze every contact carrying the selected reply tag and classify only safely anchored post-blast conversations.

### Form

Required:

- Client
- Start date
- End date
- Reply tag
- Blast message phrase

Optional:

- Workflow name or ID

The phrase field must be visually and technically required. Placeholder copy should ask for distinctive wording from the outbound blast.

### Run behavior

- Validate all required fields.
- Disable Run Analysis while active.
- Change label to `Running...`.
- Lock the client selector for the submitted run.
- Replace the result area with the live progress panel.
- Preserve the submitted client and form values across progress updates.

### Progress panel

The implemented panel contains:

- `Live analysis` kicker
- Contextual bracketed action verb
- Short safe detail
- Overall percentage
- Gold progress track and fill
- Current phase
- Aggregate phase count

Phases:

- Preparing
- Contact scan
- Conversation export
- Blast matching
- Reply classification
- Saving
- Complete

Approved product-language examples:

```text
[Calibrating the blast scan...]
[Filtering reply-tag candidates...]
[Sweeping contact pages...]
[Gathering conversation trails...]
[Anchoring outbound blast messages...]
[Reading reply intent...]
[Checking service relevance...]
[Weighing conversation signals...]
[Sorting reply sentiment...]
[Polishing the final analysis...]
[Blast analysis complete.]
```

These phrases refer to marketing blast analysis. The UI must not use explosives, weapons, demolition, shockwave, fragmentation, or structural-breach terminology.

Progress must be based on real server phases rather than a decorative timer.

Counts:

- Contact scan: contacts inspected
- Conversation export: completed date windows
- Classification: reviewed contacts out of total tagged contacts

Accessibility:

- Progress container uses `role="progressbar"`.
- Include `aria-valuemin`, `aria-valuemax`, and updated `aria-valuenow`.
- Include descriptive `aria-valuetext`.
- Status changes use an appropriate live region.
- Pulse and shimmer animation stop for `prefers-reduced-motion`.

Polling:

- Poll every three seconds.
- Continue while status is readable and `running`.
- Do not impose a fixed 15-minute timeout.
- Stop and show a connection-specific error after three consecutive unreadable status requests.
- Stop on final server error.

### Completed summary

Cards:

- Total reply-tagged contacts
- Analyzed replies
- Positive
- Negative
- Neutral
- Opt-out
- Needs review

### All tagged contacts table

Columns:

- Contact
- Last reply
- Classification
- Confidence
- Summary
- Evidence
- Offer relevance / DND
- Method
- Status

Rows:

- Every tagged contact appears.
- A missing outbound anchor shows `Not analyzed — No blast match`.
- A matched blast without a later inbound reply shows `Not analyzed — No post-blast reply`.
- Classified rows state the number of post-blast messages reviewed where available.
- Method distinguishes AI, Rules, Rules fallback, and Sample.
- Offer relevance distinguishes Promoted service, Different service, and Unclear.
- DND rows show safe channel/overall context without exposing raw metadata.

Manual editing of a saved classification is not implemented in the current frontend. Any future review override needs a defined audit trail and must not alter HighLevel.

### Client isolation

- Result selection uses the Blast form's selected client.
- Saved analyses are filtered by `clientId`.
- The newest saved analysis for that client is selected.
- An active result with another `clientId` is ignored.
- Changing to a client with no saved analysis shows:

```text
No saved blast analysis exists for [Client Name]. Run an analysis to create one.
```

- A completed background job restores and displays its submitted client.

### Clear loaded result

`Clear loaded result`:

- Hides the current on-screen result.
- Leaves the saved analysis intact.
- Does not delete database data.

### Error states

Large scan integrity:

```text
The contact scan could not be completed safely. No partial analysis was saved.
```

No matching analysis:

```text
No matching post-blast replies were classified. Review the diagnostic rows.
```

Do not describe HighLevel's 10,000-result offset restriction as a generic timeout.

### Date-selector enhancements

The current form provides explicit start and end dates. Quick presets such as Last 7 days, Last 30 days, This month, and Last month remain a future usability enhancement and must not change the submitted timezone/date semantics.

## Monthly Check Screen

Purpose:

Generate a draft Lead Hero maintenance report for review.

Inputs:

- Client
- Month or custom date range
- Include saved blast analysis
- Saved blast analysis selector

The selector orders saved analyses newest first and includes enough client/date information to distinguish repeated runs.

Evidence sections:

- System Health
- Usage and Activity
- Calls
- Blasts
- Issues
- Next Month Focus

Automation outcome evidence:

- Form-lead contacts found
- Active-pipeline opportunities found
- Staff notification matches
- First replies found
- Replied contacts in expected stage

A contact with no first reply must not be shown as a reply-stage failure.

### Report action

- Display the generated ClickUp comment before posting.
- `Post to ClickUp` requires confirmation.
- Show Draft or Posted.
- A posting error leaves the report visible and saved.

### Validation status

The screen and server path are implemented. Deeper end-to-end validation of Monthly Check, lead-flow evidence, and live ClickUp posting is intentionally deferred and may result in workflow revisions.

## Reports Screen

Purpose:

Review saved monthly reports and posting state.

Current elements:

- Saved report table
- Client
- Date range
- Overall status
- Draft/Posted state
- Open/view report behavior

The original design proposed client, month, and status filters. Those richer report filters and sorting controls are not yet implemented; future additions must preserve client clarity.

## Settings Screen

Visible to Admin and User.

### Your account

- Current email
- Current role
- Current password
- New password
- Confirm new password
- Change password
- Sign-out notice after success

### Safe connection status

Show state only for:

- HighLevel
- ClickUp
- AI provider
- Storage
- Authentication

Never show credential values.

### Admin-only user directory

The directory is searchable and paginated.

Safe columns:

- Email
- Role
- Status
- Created date
- Last sign-in
- Actions

Actions:

- Change role
- Deactivate/reactivate
- Reset password

Controls are disabled for:

- The signed-in Admin's own role/status
- Protected environment-managed Admin demotion/deactivation
- Managed reset of self
- Reset of inactive users

Confirmation is required for role and active-state changes.

### Admin-only manual account creation

Heading remains **Invite user**, with explanatory copy:

```text
Create a confirmed member manually. No invitation email is sent.
```

Fields:

- Email
- Role, default User
- Initial password
- Confirm initial password
- Current Admin password

After submission:

- Clear all password fields.
- Do not display the password.
- Refresh the directory.
- Show a safe success or error toast.

### Admin-managed reset dialog

Fields:

- New password
- Confirmation
- Acting Admin's current password

The dialog names the target email, never a password or Auth token.

### Audit events

Admin-only, paginated, and sanitized.

May display:

- Timestamp
- Safe action
- Status
- Safe target reference
- Sanitized message

Must not display IP addresses, sessions, credentials, password data, Auth metadata, or raw conversation text.

## Integration-facing UI Rules

### HighLevel

- Never render a saved plaintext PIT.
- Translate invalid-token and missing-scope failures into setup guidance.
- Keep every visible operation read-only.
- Show connection state without exposing upstream request headers or response bodies.

### ClickUp

- Show the configured-destination requirement.
- Preview the complete generated comment before posting.
- Require confirmation.
- Preserve the draft and show a safe error after failure.

### AI provider

- Show connected/not connected and approved provider/model labels where safe.
- Do not render an API key.
- Distinguish AI from rules fallback in each result.
- Never render model reasoning or chain-of-thought.

## Components

### Buttons

- Primary gold: run, save, confirm, post
- Secondary white/bordered: cancel, clear, view
- Danger: deactivate or disconnect where appropriate
- Small controls: row actions and pagination

All buttons need a visible disabled/loading state.

### Inputs

- Visible labels
- Browser autocomplete appropriate to password intent
- Inline constraints where possible
- Server error remains the source of truth

### Badges

Use badges for:

- Green / Yellow / Red
- Connected / Missing setup
- Active / Inactive / Pending / Unprovisioned
- Admin / User
- Draft / Posted
- Positive / Negative / Neutral / Opt-out / Needs review
- HighLevel DND

### Tables

- Readable headers
- Safe overflow on narrow screens
- Clear empty state
- Compact row actions
- Text and badges rather than color-only meaning

Search, sort, and filter behavior is screen-specific. The Admin user directory has search and pagination; generalized client/report table search, sorting, and filtering remain enhancements rather than a current global table capability.

### Dialogs

- `role="dialog"`
- `aria-modal="true"`
- Clear title and target
- Cancel action
- Confirmation action
- Close behavior that does not submit

## Validation Rules

### Client

- Name required
- HighLevel location ID required
- PIT required for new client
- PIT optional for an existing connected client
- Timezone uses an IANA selector

### Date range

- Start and end required
- End cannot precede start

### Blast

- Client required
- Reply tag required
- Blast phrase required

### Monthly

- Client required
- Date range required

### User creation

- Valid email required
- Role must be Admin or User
- Password and confirmation required
- Password length 12–128
- Current Admin password required

### Password change/reset

- Confirmation must match
- Password length 12–128
- Acting user's current password required
- Self-change password must differ from current password

## Empty States

No clients:

```text
Add your first client to start running Lead Hero health checks.
```

No client-specific Blast analysis:

```text
No saved blast analysis exists for [Client Name]. Run an analysis to create one.
```

No monthly data:

```text
No matching activity was found for this client and date range.
```

No user or audit search results:

```text
No matching records were found.
```

## Accessibility Requirements

- Keyboard-operable navigation, forms, buttons, dialogs, and tables
- Visible focus states
- Labels for all fields
- Text equivalents for color-coded status
- Live-region updates for asynchronous job state
- Accurate progressbar ARIA values
- Reduced-motion support
- Sufficient color contrast
- Errors associated with the relevant workflow

## Responsive Requirements

- Desktop sidebar and content remain readable at common laptop widths.
- Forms move from multi-column grids to single-column layouts on small screens.
- Progress header and metadata stack on narrow screens.
- Percentage remains prominent.
- Wide tables scroll without clipping actions.
- Password dialog remains within the viewport.

## Safety Acceptance Criteria

- No saved plaintext PIT appears in the DOM.
- No HighLevel mutation action is rendered.
- No public signup or email-recovery control is rendered.
- User does not see Admin-only directory or audit sections.
- Password fields clear after account actions.
- Blast result changes immediately with selected client.
- Long-running Blast analysis shows real progress and safe aggregate counts.
- Diagnostic rows remain visible for every unclassified tagged contact.
- ClickUp post has a visible review and confirmation step.
- Errors never expose credentials, raw upstream responses, or raw conversation exports.

## UI Delivery Priorities

Implemented screen order:

1. Clients and embedded Routing Setup
2. Blast Analyzer
3. Monthly Check
4. Reports
5. Settings and user management

Current QA priority:

1. Blast Analyzer completeness, classification, progress, and client isolation
2. Authentication, user management, and HighLevel safety
3. Routing and lead-flow product validation
4. Monthly report validation
5. Live reviewed ClickUp posting

Accurate evidence and safe controls take precedence over decorative polish.
