---
name: migrate-webflow
description: Migrate a Webflow site into this kit site from Webflow's code export and CMS CSV exports, porting its design onto the theme of the kit's webflow example.
---

# Migrate a Webflow site

This skill moves a Webflow site into a kit site created from the kit's `webflow` example: its pages, CMS collections, media, settings and design. It ports the old design onto the example's theme, so the site keeps its look, its content and its URLs, without Webflow's code. The goal is the same content and look, not a pixel-identical copy.

This skill's files are in `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/`, and every path in them is written from the site's root. Read each step's file when you reach that step, not before. Follow the kit's rules in `node_modules/@hostsmith/site-kit-astro/AGENTS.md` throughout: where this skill seems to disagree with them, the rules win, and the report says where it happened.

## Inputs

Ask the person for whatever is missing:

- **The code export:** Webflow's code export of the site, as a ZIP or its unzipped `<site>.webflow` folder. Code export needs a paid Workspace plan, Core or higher, in the workspace that holds the site.
- **The CMS exports:** a CSV export of each CMS collection, under the names Webflow gave them, such as `acme - Blog Posts - 64f1a2b3c4d5e6f708192a3b.csv`, as files or a folder. A site with Webflow Localization exports each collection once per locale.
- **The live site's address,** such as `https://www.acme.com`, if it has one. The skill reads only its `sitemap.xml` from it.
- **Answers given in advance,** if the person has them: answers to the questions the steps ask, in the prompt or in a Markdown file of questions and answers kept with the exports. Step 1 copies the file into `.hostsmith/snapshot/answers.md`, so a rerun has it.

The exports stay where the person keeps them, outside the site, and step 1 copies them into `.hostsmith/snapshot/`, which git ignores. Never ask for them anywhere else in the site, where git would see them.

Never copy the live site: no crawler, site downloader or scripted page fetch. Webflow's Acceptable Use Policy forbids it, and the exports hold what the migration needs. From the web, the skill reads only the live `sitemap.xml` and the image files that the CSV exports link to. The person compares pages with the old site in a browser, in step 9.

## Before you start

Check these before you copy anything, in this order:

1. **A kit site.** The site has `src/site.schema.ts`. If it doesn't, stop and change no file. Say that a migration needs a kit site created from the kit's `webflow` example (https://hostsmith.net/docs/site-kit/move-from-webflow), and that an import into an existing Astro site isn't available yet.
2. **The `webflow` example.** The opening of `src/styles/theme/README.md` names the `webflow` example. If it names another, such as `basics`, say that the port starts from the `webflow` example's theme, and that every library part would otherwise keep that theme's look. Give the create command below, and wait for the person's answer before going on.
3. **A rerun.** If `.hostsmith/migration-report.md` exists, a migration ran here before. Say so, and ask whether to redo it all, from the same snapshot or from new exports, or only some steps.
4. **Example content only.** The content is still the example's: `name: Site name` in `src/content/settings/site.en.yml`, only the example's pages in `src/content/pages/` (`home`, `404`, `heroes`, `text`, `media`, `cards`, `interactive`, `interactive/embeds`, `interactive/reveal`, `news` and `contact`), and only the `news` collection in `src/site.schema.ts`. Otherwise, list the pages and collections that step 11 would remove, and wait for the person's go-ahead.
5. **A code export.** If the person gave only the live site's address, stop. Say that the migration needs Webflow's code export and CSV exports, and that code export needs a paid Workspace plan. Download nothing from the live site.

The command that creates a site from the `webflow` example, where `<version>` is the kit release, such as the one in the site's `package.json`:

```bash
npm create astro@latest <folder> -- --template hostsmith/site-kit-astro/examples/webflow#v<version> --no-ai
```

Then run `npm ci` if `node_modules` is missing, and `npm run build`, to see that the site builds before you change it.

## How to work

- **One branch.** Work on a branch, `migrate-webflow`, and commit after each step, naming it, such as `Migrate from Webflow: theme`. The person merges it to `main` once they've approved the report.
- **The report as you go.** Step 1 starts `.hostsmith/migration-report.md` from the template, and every step adds its findings and the person's answers to it. A rerun, or a new session after a break, reads it to see where the migration stands.
- **Questions together.** Ask only what the exports can't tell. Collect a step's questions and ask them at once, and record each answer in the report.
- **Answers given in advance.** Before asking a question, look for its answer in the prompt and in `.hostsmith/snapshot/answers.md`. Use an answer you find without asking, and record it in the report's "Answers" as given in advance. Ask only what's left. When no one can answer, such as in an unattended run, stop at the first question nothing answers, and say exactly what you need.
- **The text as it is.** Copy the old site's text exactly. Don't rewrite, shorten or correct it, apart from what a step names. List a typo you notice in the report, for the owner.
- **Read through the helpers.** Everything you read stays in your context, and is read again on every turn after. So read the export and the kit through the skill's helpers in `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/`, never whole:
  - `outline.mjs`: export pages as outlines, their text, links, images, forms and interactions, with the classes to look up. Name every page a step reads in one call, so the header and the footer print once.
  - `css-rules.mjs`: the export's stylesheets, by `--variables`, `--elements`, `--fonts` or class names, with the variables the rules use.
  - `props.mjs`: the section types and their props, from `.hostsmith/schema.json`, and with a type's name, its props in full and its hooks, in place of `src/kit-content.ts` and the sections of `HOOKS.md`.
  - `csv.mjs`: the CMS's CSV exports, their columns and how many rows fill each, and with `--columns`, those columns of every row. Your own scripts import its `readCsv`.

  Read a page's HTML or a stylesheet only for what a helper leaves out, and then only the lines you need.
- **Your own scripts.** A script you write for the migration, such as one that writes a collection's entries, goes in `.hostsmith/snapshot/work/`, which git ignores, and uses only Node's built-in modules. Never add a package to the site.
- **Webflow's code stays out.** Read `webflow.js` and Webflow's CSS as text, and never run, import or copy them. No `w-` class, Webflow class name, `data-wf-` attribute or Webflow host reaches the site.

## With subagents

On a large site, one whose export has more than 15 HTML pages, its templates and utility pages counted, and where you can hand work to subagents, such as Claude Code's, lead the migration and keep your own context small: everything you read stays in it, and is read again on every turn after. Never read the export's HTML or CSS, the screenshots or the kit's long references yourself. Hand each heavy phase to a fresh subagent:

| Phase | Subagents |
| --- | --- |
| The look: steps 3 and 4, and step 5's sample, with the sample's images | one |
| The pages: step 5's other groups | one per group of four or five pages, side by side |
| The collections: step 6 | one, beside the page groups |
| The review: step 9's pictures | one per group of about 16 pictures, as step 9 says |
| The fixes: step 9's differences | one for the theme, and one for each type or page, side by side where they touch different files |

Do steps 1, 2, 7's other images, 8, 10 and 11 yourself, run the checks and the scripts, and keep step 9's checklist.

- **What each gets:** the steps it does, by their paths, the paths of the report and `.hostsmith/snapshot/`, what earlier phases made, such as the types, the site variants and the settings' facts, and the answers given in advance. Its text writes each fact's placeholder, such as `{street}`, never its value.
- **What each does:** reads what its phase needs, does it, commits, writes its findings and answers into the report, and returns a short summary: what it made, what it couldn't carry, and the questions left. Never its files' contents.
- **Questions:** a subagent asks the person nothing. It returns the questions that the answers given in advance don't answer. Ask the person yourself, and hand the answers to the same subagent, where you can continue it, or to a new one.

On a smaller site, do every step yourself, in order, and hand only step 9's review to subagents, as step 9 says: your context stays small enough, and each subagent would read the export, the schema and the steps again. Without subagents, do every step yourself.

## Steps

1. [Snapshot](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/01-snapshot.md): copy the exports into `.hostsmith/snapshot/`, note what they lack, and start the report.
2. [URL map](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/02-url-map.md): every URL the old site serves, in `.hostsmith/old-urls.txt`, with each collection's base path, the forms, the embeds and the interactions.
3. [Theme](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/03-theme.md): the old design's tokens, fonts, header and footer on the `webflow` example's theme.
4. [Settings](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/04-settings.md): the locales, the header, the footer, the facts and the head.
5. [Pages to sections](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/05-pages-to-sections.md): each page as section entries: library types first, a site variant for one section's own look, and a site-local type only for an element no library type renders, with Webflow's elements as the kit's parts. A sample of pages first, to settle the theme, then the rest in bulk.
6. [CMS to collections](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/06-cms-to-collections.md): each CMS collection from its CSV, with its detail template.
7. [Media](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/07-media.md): images, icons and videos into `public/assets/` and `src/icons/`, with their credits.
8. [Brief](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/08-brief.md): `.hostsmith/brief.md`, filled in, right after step 2, while your context is small.
9. [Verify](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/09-verify.md): the checks, the content check, the fidelity check against the export in rounds until it converges, the accessibility check, and the person's comparison with the old site.
10. [Report](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/10-report.md): `.hostsmith/migration-report.md`, complete, for the owner to approve.
11. [Clean up](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/steps/11-clean-up.md): the example's content removed, by a script, and the DNS switch checklist.

The references the steps use:

- [Client-First mapping](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/client-first.md): Webflow's Client-First classes onto the theme's tokens and utilities.
- [Element mapping](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/elements.md): Webflow's built-in elements and interactions onto the kit's parts, and what has no replacement.
- [Report template](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/report-template.md): the migration report's sections.
- [DNS switch checklist](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/dns-switch-checklist.md): what must hold before the domain moves to Hostsmith.
- [DevLink](node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/devlink.md): an optional experiment for a site whose Components the person exports with Webflow's DevLink.

Each step file starts with its scope. `scope: any` means the step doesn't depend on the kit's sections and theme, and `scope: kit` that it does.
