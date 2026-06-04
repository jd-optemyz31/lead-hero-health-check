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

Admins can disconnect a client's HighLevel account from the tool. Disconnecting removes the saved HighLevel Private Integration Token from the Health Check Tool only. It does not change, revoke, or delete anything inside HighLevel.

Admins can edit all client connection details after setup, including timezone, location ID, ClickUp task ID, form lead tag, active pipeline, and first-reply stage. When editing an existing client, the Private Integration Token field is optional; leaving it blank keeps the saved encrypted token, and entering a new token replaces it.

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
- Optional message phrase

Outputs:

- Replied contacts
- Positive replies
- Negative replies
- Neutral replies
- Opt-outs
- Needs review
- Conversation summaries
- Recommended follow-up

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

1. Admin opens Clients.
2. Admin chooses Disconnect for the client.
3. Tool asks for confirmation.
4. Tool removes the encrypted HighLevel token and token preview from its own storage.
5. Client setup, routing setup, reports, and ClickUp task ID remain saved.
6. Live HighLevel checks are disabled until a new read-only PIT is saved.

### Editing Client Connection Details

1. Admin opens Clients.
2. Admin chooses Edit for the client.
3. Tool pre-fills all editable setup fields.
4. Admin updates timezone, location ID, ClickUp task ID, automation-flow fields, or other client metadata.
5. Admin leaves the PIT field blank to keep the saved token, or enters a new read-only PIT to replace it.
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
5. User optionally selects workflow name/ID or message phrase.
6. Tool finds matching contacts and conversations.
7. Tool classifies replies.
8. User saves the blast analysis.
9. Saved blast analysis can later be attached to a monthly report.

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
