# Migration report

<!-- Written by the migration skill, step by step, from node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/report-template.md. Every section stays: one with nothing to report says so in a line. Step 10 removes these comments. -->

The site <site name> moved from Webflow to this repository on <date>, from the exports listed under "Sources". This report lists what moved, what changed, what didn't carry over, and what the owner needs to decide before the site goes to production.

## For the owner to approve

<!-- Every decision below that the owner makes, as a checklist: colors changed for contrast, fonts, embeds, pages written anew, alt text written, differences left as they are. -->

- [ ] <decision, and where it's described below>

## Sources

<!-- Step 1. The code export by the name of its ZIP or folder, each CSV and the sitemap, each with its size and modification date. -->

| File | Size | Modified |
| --- | --- | --- |

The snapshot is in `.hostsmith/snapshot/`, which git ignores. It can be deleted once the owner has approved the site.

## Pages

<!-- Step 5. Each page with its URL and its sections in order, each with its type, library or site-local. -->

| Page | URL | Sections |
| --- | --- | --- |

## Site-local types and Components

<!-- Step 5. Each site-local type, what it shows and the pages it's on. Each Component found by repetition, the type it became, and the pages it's on. Each Webflow element that a kit part replaced, such as Tabs on About. -->

## Collections

<!-- Step 6. Each collection, with its base path, its number of entries, its drafts, its fields, its title and description patterns, and its breadcrumb switch. Then the site-wide breadcrumb switch, for the pages in folders. -->

## Interactions

<!-- Steps 2 and 5. Each interaction by its id, what it did, and what was done with it, such as "fade-up on scroll, on the section headers: reveal: fade-up on 11 sections". -->

## Embeds

<!-- Step 5. Each embed with its page, its provider, and the person's choice: on a click, directly, a link or image, or dropped. -->

## Forms

<!-- Step 2. Each form with its page, every field (label, name, type, options, required), its button, and its success and error messages. No form works until the kit's contact form is set up. -->

## Fonts

<!-- Step 3. Each font family: where it came from, its license, the recommendation, and whether its files arrived. -->

## Colors changed for contrast

<!-- Step 3. Each role changed to pass a contrast pair: the role, the pair, the old value and the new one. -->

## Builder defaults kept

<!-- Step 3. Each default of Webflow's own CSS that showed on the old site, because the site's CSS never set it, kept in `src/styles/theme/builder-defaults.css`: where it shows, such as the selected tab on About, and its old value. Otherwise: "None showed." -->

To use the theme's own styles instead, delete `src/styles/theme/builder-defaults.css`, its import in `src/styles/global.css`, and the `--color-builder-*` colors in the site's preset.

## Not carried over

<!-- Each thing that didn't move, with its page or item: custom code, interactions not ported, pagination, the password and search pages, archived items, color fields, embeds with code. -->

## Missing pieces

<!-- Steps 1, 4, 5 and 6. Fonts the export lacked, the favicon and touch icon when the export had only Webflow's defaults, the 404 page when the export had none or a default one, missing Open Graph images, empty image fields such as entries without a photo. -->

## Answers

<!-- Every answer the person gave: base paths, collection list settings, title and description patterns, which field a reference shows, the default Open Graph image. Mark each answer that was given in advance, in the prompt or in `.hostsmith/snapshot/answers.md`, as given in advance. -->

## Alt text written

<!-- Step 5. Each image whose alt text the export didn't have, with the text written for it. -->

## Links to check

<!-- Steps 2 and 6. Links to items that aren't in the URL map, and references to slugs that don't exist. -->

## Fidelity check

<!-- Step 9. The differences between the build and the export, per page and width, and what the person found comparing the site with the old one in a browser. When the check couldn't run, such as in a sandbox, say so, why, and what would let it run. -->

| Page | Width | Difference |
| --- | --- | --- |

## To translate

<!-- A localized site only: each page and settings file copied into another locale with the primary locale's text. Otherwise: "The site has one locale." -->

## DNS switch checklist

The domain moves to Hostsmith only when every item holds:

- [ ] `npm run check:urls -- --live <production site address>` passes against the deployed production site.
- [ ] Every form listed under "Forms" works through the kit's contact form.
- [ ] `url` in `src/site.config.ts` is the final domain.
- [ ] The custom domain is set up on the Hostsmith production site.
- [ ] The repository variable `SITE_NOINDEX` is `false`, and production has been deployed again since.

After the switch, submit the sitemap, `<url>/sitemap.xml`, again in the owner's search console.
