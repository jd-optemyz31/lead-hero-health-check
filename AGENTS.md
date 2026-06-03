# Agent Instructions

Always read this `AGENTS.md` file before working.

This project is the Lead Hero Health Check Tool.

Before making product or technical changes, read these docs:

- `outputs/01-PRD-Lead-Hero-Health-Check-Tool.md`
- `outputs/02-Technical-Architecture-Lead-Hero-Health-Check-Tool.md`
- `outputs/03-Security-And-Access-Lead-Hero-Health-Check-Tool.md`
- `outputs/04-Frontend-Specification-Lead-Hero-Health-Check-Tool.md`
- `outputs/README-Lead-Hero-Docs.md`

Core safety rule:

HighLevel must remain read-only. Do not add any feature, route, API call, or UI control that can:
- send SMS
- send email
- place calls
- add contacts to workflows
- update contacts
- add or remove tags
- update opportunities
- modify workflows
- trigger outbound communication to account contacts

ClickUp is the only approved write destination for reviewed report comments.

Product notes:

- Routing check uses staff notification contact(s) and the phrase `New form submission`.
- Blast Analyzer must be runnable anytime.
- Blasts are run inside HighLevel, not through this tool.
- Monthly reports must be review-before-post.
- Do not assume HighLevel exposes full workflow node-level inspection.
