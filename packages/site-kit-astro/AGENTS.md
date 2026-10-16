# Kit rules

The rules of the Hostsmith site kit, for any agent working in a site built on it. The site's own `AGENTS.md` points here and adds the site's notes.

> The full rules for content edits, section types and the owner request workflow come in a later kit release.

## Where the kit is

The kit is the package `@hostsmith/site-kit-astro`, in `node_modules/@hostsmith/site-kit-astro/`. Search tools that respect `.gitignore` skip `node_modules`, so look there by path:

- library section types: `src/components/sections/<type>.astro`, their schemas in `src/kit-content.ts`, their Decap types in `decap/config.kit.yml`;
- the base layout: `src/layouts/Base.astro`;
- the kit's styles: `styles.css`.

Site code imports the kit only through these package names:

- `@hostsmith/site-kit-astro/schema`: field types and helpers for `src/site.schema.ts`;
- `@hostsmith/site-kit-astro/field`: `field` and `sectionFields`, for field attributes;
- `@hostsmith/site-kit-astro/markdown`: `renderMarkdown` and `assertNoH1`;
- `@hostsmith/site-kit-astro/settings`: `getSettings` and `SETTINGS`;
- `@hostsmith/site-kit-astro/routes`: `pagePath` and `getEntryRoutes`;
- `@hostsmith/site-kit-astro/custom-page`: `customPage`, for `template: custom` pages;
- `@hostsmith/site-kit-astro/components/Sections.astro` and `@hostsmith/site-kit-astro/layouts/Base.astro`.

Never edit files in `node_modules`: the next install replaces them.

## The site's files

Every file in the site repository is the site's. The kit reads these from it, so keep them where they are:

- `src/site.config.ts`: the production site URL and each collection's base path;
- `src/site.schema.ts`: the site-local section types and the site's collections;
- `src/components/sections/site/<type>.astro`: site-local section types;
- `src/components/collections/<collection>.astro`: each collection's detail template;
- `src/pages/`: hand-written pages, such as `template: custom` pages;
- `src/styles/global.css`: imports the kit's styles, then `src/styles/tokens.css`.

To change a library section for this site, copy it from the kit into `src/components/sections/site/` under a new name, change its imports to the package names above, and register the copy as a site-local type: its schema in `src/site.schema.ts`, its Decap type in `public/admin/config.site.yml`.

Don't edit `public/admin/config.yml`. Edit `public/admin/config.site.yml`, then run `npm run decap-config`, which assembles `config.yml` from it and the kit's part. The build fails while `config.yml` is stale.

## Kit updates

To take kit release `<version>`:

1. `git switch -c kit-update/v<version>`
2. `npm install --save-exact @hostsmith/site-kit-astro@<version>`. If npm reports a conflict on `astro`, install the `astro` version the release notes name in the same command.
3. `npm run decap-config`, `npm run build` and `npm run check:urls`.
4. For a major release, apply the steps in its release notes.
5. Commit, push the branch, check the preview site, then merge it to `main`.

Never copy files from the kit's repository or merge its history.

## Dependencies

Every dependency is pinned to an exact version, and `package-lock.json` is committed. Use only these packages:

- `@hostsmith/site-kit-astro`
- `astro`
- `@astrojs/react`, `react` and `react-dom`, only for the DevLink experiment

Don't add a package that isn't on this list. If a change seems to need one, stop and raise it with the developer instead.
