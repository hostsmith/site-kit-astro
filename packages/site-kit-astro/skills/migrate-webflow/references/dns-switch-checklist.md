# DNS switch checklist

A migrated site goes to production on its Hostsmith address first, with no-index on, while the old domain still points to Webflow, so visitors keep the old site. The domain moves to Hostsmith only when every item holds. The migration report ends with the same list.

- [ ] **The old URLs:** `npm run check:urls -- --live <production site address>` passes against the deployed production site, so every URL in `.hostsmith/old-urls.txt` has its page.
- [ ] **The forms:** every form in the report's "Forms" works through the kit's contact form. Until it does, the switch waits: the old site's forms would stop working on the day the domain moves.
- [ ] **The site's URL:** `url` in `src/site.config.ts` is the final domain, such as `https://www.acme.com`, so canonical links, the sitemap and Open Graph URLs name it.
- [ ] **The domain:** the custom domain is set up on the Hostsmith production site.
- [ ] **Indexing:** the repository variable `SITE_NOINDEX` is `false`, and production has been deployed again since, so search engines may index the site.

Then point the domain's DNS records at Hostsmith, as the Hostsmith dashboard shows them for the domain.

After the switch:

- submit the sitemap, `<site URL>/sitemap.xml`, again in the owner's search console, such as Google Search Console;
- check a few old URLs on the domain in a browser, and run `npm run check:urls -- --live <site URL>` once more;
- keep the Webflow site until the owner is sure, then cancel its site plan.
