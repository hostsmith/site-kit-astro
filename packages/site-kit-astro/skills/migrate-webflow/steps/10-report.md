---
scope: any
---

# 10. Report

Complete `.hostsmith/migration-report.md`, which the earlier steps started from `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/report-template.md`. It's for the owner: what moved, what changed, what didn't carry over, and what needs their decision before the site goes to production.

- **Every section filled in.** A section with nothing to report says so in a line, such as "No forms". Remove the template's guidance comments.
- **Plain words.** The owner isn't a developer. Name pages by their titles and URLs, and say what a visitor would notice, not which class or file changed.
- **What to approve:** the "For the owner to approve" list at the top gathers every decision the report asks for: each font and its recommendation, each embed's choice, each page written anew, such as the 404, each alt text written, the fidelity check's differences left as they are, and whether to fix the gaps under "Accessibility" after the move, which the site carries as the old one had them.
- **The DNS switch checklist** stays at the end, unchecked. The domain moves only when every item holds.

Commit the report. The person reviews it with the owner, who approves it before the branch is merged to `main`.
