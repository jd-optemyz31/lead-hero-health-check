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

Admins can disconnect a client from live HighLevel checks by removing the saved HighLevel Private Integration Token from this tool. This does not call HighLevel and does not change the client's HighLevel account.

## Client Edit Decision

Admins can edit client connection details, including timezone and automation-flow fields. Timezone should be selected from IANA timezone IDs. On edit, leaving the PIT field blank keeps the saved encrypted token; entering a new PIT replaces it.

## AI Blast Analysis Decision

Blast Analyzer can use OpenAI from the server only when `OPENAI_API_KEY` is configured. Results are presented as summary cards plus a reply table with classification, confidence, summary, evidence, method, and review status. If OpenAI is unavailable or uncertain, the tool uses rules fallback and marks uncertain replies as `Needs review`.

## Brand Direction

The frontend specification uses the Lead Hero logo theme: gold accents, white/light working surfaces, soft silver-gray borders, and dark charcoal structure.
