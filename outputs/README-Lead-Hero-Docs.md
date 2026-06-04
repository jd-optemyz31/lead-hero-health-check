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

## Brand Direction

The frontend specification uses the Lead Hero logo theme: gold accents, white/light working surfaces, soft silver-gray borders, and dark charcoal structure.
