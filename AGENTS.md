# Agent rules

> Placeholder. The full rules for agents working in a kit site (content edits, section types, the owner request workflow) come in a later kit release.

## Kit files

In a site repository, the kit owns the files listed under `kitFiles` in `kit.lock.json`, and `npm run kit:update` replaces them with each kit release. The site owns its content, `src/site.config.ts`, `src/site.schema.ts`, `src/styles/tokens.css`, `public/admin/config.site.yml`, its site-local section types, collection templates and custom pages, and its media.

- Don't edit kit-owned files in a site repository. An update keeps a changed kit file as it is, reports it, and stops updating it.
- To change a library section for one site, copy it into `src/components/sections/site/` under a new name, and register the copy as a site-local type: its schema in `src/site.schema.ts`, its Decap type in `public/admin/config.site.yml`.
- Don't edit `public/admin/config.yml`. Edit `public/admin/config.site.yml`, then run `npm run decap-config`, which assembles `config.yml` from it and the kit's part.
- Take kit releases with `npm run kit:update -- <version>`, never by copying files from the kit or merging its history. It works on the branch `kit-update/v<version>`, runs the checks and commits. Push the branch, check the preview site, then merge it.

## Dependencies

Every dependency is pinned to an exact version, and `package-lock.json` is committed. Use only these packages:

- `astro`
- `@astrojs/markdown-satteri`
- `tailwindcss`
- `@tailwindcss/vite`
- `@hostsmith/sdk` (development dependency only)
- `@astrojs/react`, `react` and `react-dom`, only for the DevLink experiment

Don't add a package that isn't on this list. If a change seems to need one, stop and raise it with the developer instead.
