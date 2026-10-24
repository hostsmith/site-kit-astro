---
scope: any
---

# 2. URL map

List every URL the old site serves, so the new site keeps each one. Hostsmith has no redirects: a URL missing here breaks for visitors, links and search engines on the day the domain moves.

## Collect the URLs

Write each path, one per line, into `.hostsmith/old-urls.txt`, in place of the example's paths, keeping its comment lines. `npm run check:urls` checks the build against it.

**With a sitemap,** `.hostsmith/snapshot/sitemap.xml`: take each `<loc>`'s path, and in a localized site each alternate's path too. Then add the static pages from the export that the sitemap leaves out, since a page can be excluded from the sitemap and still be live.

**Without one:**

1. **Static pages:** each `.html` file in `.hostsmith/snapshot/code/` and its folders, as a clean path: `index.html` is `/`, `about.html` is `/about`, and `services/painting.html` is `/services/painting`. Leave out:
   - `detail_<collection>.html`, a collection's template, which has no URL of its own;
   - `404.html`, which a host serves for any missing page;
   - `401.html`, the password page, and `search.html`, the search results page, which don't carry over. If either is live, list its URL in the report's "Not carried over".
2. **Collection items:** each row of each collection's CSV, as `<base path>/<Slug>`. Leave out the rows whose `Draft` or `Archived` is `true`: they have no live URL.
3. **Base paths:** the export doesn't hold them. Propose one for each collection, and wait for the person to confirm them all before you write the URL map:
   - from a link to an item: search the export's pages and the CSVs' rich text for a link whose last segment is an item's slug. `/blog/from-woolen-mill-to-workspace` for the slug `from-woolen-mill-to-workspace` gives `/blog`;
   - otherwise from the template's name: `detail_team.html` suggests `/team`. Webflow's default base path is the collection's slug, so a collection named Blog Posts may be at `/blog-posts`.

   In a localized site, each locale's base path comes from the sitemap's alternates.

Record each collection's confirmed base path in the report's "Answers". Step 6 writes it into `src/site.config.ts`.

## Check the links

- **Clean paths:** list every internal link in the export's pages and in the CSVs' rich text: an `href` that starts with `/`, or that names a page file, such as `about.html` or `../index.html`. Steps 5 and 6 write each one as its clean path: `about.html` is `/about`, `index.html` is `/`, and a fragment or query stays, as in `/membership#plans`.
- **Links to items:** check every link to a CMS item against the URL map. A link to an item that isn't in it, such as a draft, an archived item or a mistyped slug, goes into the report's "Links to check", with its page.

## Note for later steps

While you read each page, add these to the report, each with its page:

- **Forms:** each `form` inside a `w-form` element, with every field's label, name, type and options, whether it's required, its submit button's label, and its success and error messages, for the report's "Forms". The kit's contact form comes in a later release. Until then, no form is carried over.
- **Embeds and custom code:** each `w-embed`, `w-video` and `w-iframe` element, each `iframe`, and each `script` in the body or the head that isn't Webflow's own, for step 5 and the report's "Embeds" and "Not carried over". A `<style>` in an embed, such as Client-First's global styles, is site CSS: step 3 ports it.
- **Interactions:** the classes that IX3's or IX2's definitions in `.hostsmith/snapshot/code/js/webflow.js` name, and the pages whose elements carry them, for step 5 (see the element mapping, "Interactions": `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/elements.md`).
