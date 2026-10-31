---
scope: any
---

# 1. Snapshot

Copy Webflow's exports into the site, so every later step reads one fixed set of files.

## Check that git ignores the snapshot

```bash
git check-ignore -q .hostsmith/snapshot/probe
```

If it exits with anything but 0, stop before copying anything. Say that `.gitignore` needs the line `.hostsmith/snapshot/`, which the `webflow` example has, and wait for the person to add it or to let you add it. The snapshot holds Webflow's own scripts and styles and CMS items that were never published, so it's never committed. Tailwind skips ignored files too, so the export's class names stay out of the site's CSS.

## Copy the exports

| Path | What it holds |
| --- | --- |
| `.hostsmith/snapshot/code/` | the code export, unzipped, with `index.html` directly inside |
| `.hostsmith/snapshot/cms/` | the CSV exports, under the names they came with |
| `.hostsmith/snapshot/sitemap.xml` | the live site's sitemap, when it publishes one |
| `.hostsmith/snapshot/answers.md` | the answers given in advance, when the person gave a file of them |
| `.hostsmith/snapshot/fidelity/` | the fidelity check's tools and screenshots, from step 9 |
| `.hostsmith/snapshot/work/` | your scripts and notes during the migration |

- **A rerun:** if `.hostsmith/snapshot/code/` exists and the person gave no new exports, reuse the snapshot, and go on to "Note what the snapshot lacks". New exports replace the whole snapshot: delete `.hostsmith/snapshot/` first.
- **The code export:** a ZIP holds one folder, named like `<site>.webflow`. Unzip it into `.hostsmith/snapshot/work/`, and move that folder's contents into `.hostsmith/snapshot/code/`, so `.hostsmith/snapshot/code/index.html` exists. Copy an unzipped folder's contents the same way. Leave the person's originals where they are.
- **The CSV exports:** copy each file into `.hostsmith/snapshot/cms/` under its own name. Given a folder, copy every `.csv` in it.
- **The sitemap:** if the person gave the live site's address, fetch its sitemap and nothing else:

  ```bash
  curl -fsSL "<address>/sitemap.xml" -o .hostsmith/snapshot/sitemap.xml
  ```

  If it fails, the site has none: a site on its `webflow.io` address publishes no sitemap. Step 2 then builds the URL map without one. If the person has a sitemap saved from the site's custom domain, copy that instead.

- **Answers given in advance:** copy the person's file of answers to `.hostsmith/snapshot/answers.md`. Answers in the prompt go in the same file, under "From the prompt", so a rerun or a new session has them too. Every step looks there before asking (`SKILL.md`, "Answers given in advance").

Use no Webflow API and no Webflow token: the exports hold everything this skill reads.

## Read the CSV names

Each CSV holds one collection, which its file name gives. Never ask the person to rename a file Webflow named.

| File name | Collection | Locale |
| --- | --- | --- |
| `<site> - <Collection> - <collection id>.csv`, Webflow's own, such as `acme - Blog Posts - 64f1a2b3c4d5e6f708192a3b.csv` | `<Collection>`, such as Blog Posts | the primary locale |
| `<site> - <Collection> - <collection id>.<locale code>.csv` | `<Collection>` | the locale code |
| `<collection>.csv`, such as `team.csv` | `<collection>` | the primary locale |
| `<collection>.<locale code>.csv`, such as `posts.de.csv` | `<collection>` | the locale code |

A site uses Webflow Localization when its sitemap lists alternates (`xhtml:link`), or the person says so. Without a sitemap, ask once. In a localized site, ask which locale each file holds whose name doesn't say, before you read it: its `Locale ID` column doesn't say which locale that is.

## Note what the snapshot lacks

Tell the person, and write each into the report's "Missing pieces":

- **Fonts:** each `@font-face` in `.hostsmith/snapshot/code/css/` whose `src` points at no file, such as `url('../images/')`, or at a file the export doesn't hold. Webflow's export leaves out uploaded fonts. Step 3 looks into each one.
- **Utility pages:** `404.html` and `401.html`, which Webflow exports only once they've been edited. Without `404.html`, step 5 writes the 404 page.
- **Collections:** each `detail_<collection>.html` in the export is a collection's template page, and each needs its CSV. So does a collection without a template whose items a page lists. Ask for every missing CSV now: step 6 can't start without them.
- **What the export never holds:** CMS content, which comes from the CSVs; a localized collection's entries, which come from a CSV per locale; a static page's text in another locale, which no export holds and Webflow publishes only on the live site (step 5); code components; and each collection list's settings, which step 6 asks for.

## Start the report

Copy `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/report-template.md` to `.hostsmith/migration-report.md`. Fill in "Sources": the code export, by the name of the ZIP or folder the person gave, and each CSV and the sitemap, each with its size and modification date (`ls -l`), so the owner can see which exports the site came from. Fill in "Missing pieces" from the list above.

From here on, each step adds its findings and the person's answers to the report as it goes.
