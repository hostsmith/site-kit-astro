---
scope: kit
---

# 11. Clean up

Remove what's left of the `webflow` example, so the site holds only its own content. The clean-up script removes the example's files that the migration didn't change, compared with the commit before the migration's first:

```bash
node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/clean-up.mjs
```

- **Pages:** every page in `src/content/pages/` that the migration didn't write. The page entry `404` stays, as step 5 wrote it.
- **The `news` collection,** unless the migration reused it: `src/content/news/`, its schema in `src/site.schema.ts`, its base path in `src/site.config.ts`, its folder collection in `public/admin/config.site.yml` and `src/components/collections/news.astro`.
- **Media:** the example's placeholder images, logos and video in `public/assets/`, and its icon `src/icons/square-dot.svg`, where nothing uses them any more.

It prints what it removed, and what it left for you, such as a file the migration changed that still names `news`, or a credit for a removed file: handle those yourself. `--dry-run` prints the same and changes nothing. Then:

- **Settings:** remove any of the example's text left in the settings, such as a header action or a footer block the old site didn't have.
- **The README:** the site's `README.md` says what the site is, in place of the example's description.
- **Interface strings:** keep the kit's keys for the parts the site uses. The others may stay: they're optional.

Then run `npm run decap-config`, `npx site-kit schema`, and step 9's "The checks" and "No Webflow left" again, and commit. The fidelity check needs to run again only if this step changed the settings, such as a header action or a footer block: then run it with `--only home`, and open the pictures it unticks.

The snapshot stays in `.hostsmith/snapshot/`, ignored by git, for a rerun. The report says it can be deleted once the owner has approved the site.

## Before the domain moves

The migrated site goes to production on its Hostsmith address, with no-index on, while the old domain still points to Webflow. The domain moves only when every item of the DNS switch checklist holds: `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/dns-switch-checklist.md`. Its items are at the end of the report. Tell the person which ones don't hold yet.
