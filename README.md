# Site Kit

A kit for small-business websites, built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com). Content lives in Markdown and YAML files, so people and AI agents can change a site with ordinary edits and review them in a pull request.

The kit has two parts:

- the npm package [`@hostsmith/site-kit-astro`](https://www.npmjs.com/package/@hostsmith/site-kit-astro): an Astro integration, the section library, the layout, the routes, the content schemas and the `site-kit` command;
- example sites, in [`examples/`](./examples): a new site starts as a copy of one (see [Examples](#examples)).

A site repository holds only the site: its content, settings, design tokens and its own sections. It takes kit releases with `npm install`. The kit is plain Astro, and Hostsmith appears only in deployment tooling, so a kit site builds and runs on any static host.

The kit is before 1.0, and built first for sites migrated from Webflow.

## Examples

Each example is a complete site, and each release deploys it from this repository.

| Example | What it shows | Live site |
| --- | --- | --- |
| [`basics`](./examples/basics) | a bakery's site: every section type, a news collection and a custom page | [kit-astro-basics.us.hostsmith.link](https://kit-astro-basics.us.hostsmith.link) |

## Start a site

1. Create the site from an example of a kit release. `basics` names the example, and `v0.4.0` the release: use the latest one from the [releases](https://github.com/hostsmith/site-kit-astro/releases).

   ```bash
   npm create astro@latest my-site -- --template hostsmith/site-kit-astro/examples/basics#v0.4.0
   cd my-site
   npm run build   # writes the static site to dist/
   npm run dev     # local preview with live reload
   ```

2. Create a GitHub repository for the site and push it.
3. Replace the example content in `src/content/` and the tokens in `src/styles/tokens.css`, and set `url` in `src/site.config.ts`.

## What a site holds

| Path | What it is |
| --- | --- |
| `src/content/` | pages, collection entries and `settings/site.yml` |
| `src/site.config.ts` | the production site URL and each collection's base path |
| `src/site.schema.ts` | the site's own section types and collections |
| `src/components/sections/site/` | the site's own section types |
| `src/components/collections/` | one detail template per collection |
| `src/pages/` | hand-written pages, such as `template: custom` pages |
| `src/styles/tokens.css` | the design tokens |
| `src/styles/global.css` | imports the kit's styles, then the tokens |
| `public/assets/` | media |
| `public/admin/config.site.yml` | the site's part of the Decap config |
| `public/admin/config.yml` | the Decap config, assembled by `npm run decap-config` |
| `astro.config.mjs`, `src/content.config.ts` | wire the kit in. They rarely change |
| `AGENTS.md`, `CLAUDE.md`, `.claude/skills/` | agent rules: the kit's rules come from the package |
| `.hostsmith/` | the site's brief and the old site's URLs |
| `.github/workflows/hostsmith.yml` | the deploy workflow |

Every file in a site repository is the site's. The kit's code is in `node_modules/@hostsmith/site-kit-astro/`, and no kit update changes the site's files, apart from `package.json`, `package-lock.json` and the generated `public/admin/config.yml`.

## How content works

- **Pages** are `src/content/pages/**/*.md`. A page is an ordered list of typed sections in its frontmatter, and its body stays empty. `home` is served at `/`, and other pages at `/<file path>`.
- **Sections** have a stable `id` and a `type`. Get a new id with `npm run section-id -- <page file>`. The library's section types are in the package, and the site's own types go in `src/components/sections/site/`, with a schema in `src/site.schema.ts` and a Decap type in `public/admin/config.site.yml`.
- **Collections**, such as `news`, are folders of Markdown entries. Each has a schema in `src/site.schema.ts`, a base path in `src/site.config.ts` and a detail template in `src/components/collections/`.
- **Settings** are in `src/content/settings/site.yml`: site name, language, navigation, footer, contact details and interface text.
- `public/admin/config.yml` is the Decap CMS schema, assembled from the kit's part and `public/admin/config.site.yml`. The Zod schemas mirror it: change the site's Decap part and `src/site.schema.ts` together, then run `npm run decap-config`. The build fails while `config.yml` is stale.

## What a site may rely on

The kit's public API is what a minor release keeps working:

- the integration and its options, `siteKit({ url, collections })` in `astro.config.mjs`;
- the exports of `src/site.schema.ts`, `siteSectionSchemas` and `siteCollections`;
- the paths the kit reads from the site: `src/site.config.ts`, `src/site.schema.ts`, `src/components/sections/site/*.astro`, `src/components/collections/<collection>.astro`, `src/pages/**/*.astro` and `src/styles/global.css`;
- the package's exports:

| Import | What it gives |
| --- | --- |
| `@hostsmith/site-kit-astro` | the integration |
| `@hostsmith/site-kit-astro/content` | `collections`, for `src/content.config.ts`, and the `Section` type |
| `@hostsmith/site-kit-astro/schema` | field types and helpers for `src/site.schema.ts` |
| `@hostsmith/site-kit-astro/field` | `field` and `sectionFields`, for field attributes |
| `@hostsmith/site-kit-astro/markdown` | `renderMarkdown` and `assertNoH1` |
| `@hostsmith/site-kit-astro/settings` | `getSettings` and `SETTINGS` |
| `@hostsmith/site-kit-astro/routes` | `pagePath` and `getEntryRoutes` |
| `@hostsmith/site-kit-astro/custom-page` | `customPage`, for `template: custom` pages |
| `@hostsmith/site-kit-astro/components/Sections.astro` | renders a list of sections |
| `@hostsmith/site-kit-astro/layouts/Base.astro` | the base layout |
| `@hostsmith/site-kit-astro/styles.css` | the kit's styles, Tailwind included |

Anything else in the package can change in any release, and the package doesn't let a site import it.

## Kit updates

A site takes kit release `0.5.0` on a branch, which the deploy workflow deploys to the preview site:

```bash
git switch -c kit-update/v0.5.0
npm install --save-exact @hostsmith/site-kit-astro@0.5.0
npm run decap-config
npm run build
npm run check:urls
```

Then commit, push, check the preview site and merge the branch to `main`. If npm reports a conflict on `astro`, the release notes name the `astro` version to install with the kit. A major release's notes give the steps for the site's files.

## Commands

In a site:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the site into `dist/`. Set `SITE_NOINDEX=true` for preview builds. |
| `npm run dev` | Starts the dev server. |
| `npm run section-id -- <page file>` | Prints a new section id for that page. |
| `npm run check:urls` | Checks that every path in `.hostsmith/old-urls.txt` has a page. Add `--live <url>` to check a deployed site. |
| `npm run decap-config` | Assembles `public/admin/config.yml`. Add `--check` to only check it. |

## Deploying to Hostsmith

`.github/workflows/hostsmith.yml` deploys a push to `main` to the production site (`site.id` in `hostsmith.json`), and a push to any other branch to the preview site. Each deploy runs in the GitHub environment named after its target, `production` or `preview`, and the repository's deployments list links to the site.

In the repository settings, under Environments:

1. In `production`, add the secret `HOSTSMITH_TOKEN`: a Hostsmith API token restricted to the production site, with "Custom" permissions `sites:read` and `files:write`. Under deployment branches, allow only `main`, so other branches can't use this token.
2. In `preview`, add the secret `HOSTSMITH_TOKEN`: a token restricted to the preview site, with the same permissions.

Private repositories on GitHub Free have no environment secrets. There, add one repository secret `HOSTSMITH_TOKEN` restricted to both sites instead.

Variables, in the repository or the environment:

| Setting | Kind | What it is |
| --- | --- | --- |
| `HOSTSMITH_PREVIEW_SITE_ID` | variable | The preview site. Without it, branch pushes only build. |
| `HOSTSMITH_PARTITION` | variable | `us` or `eu`, when the sites aren't in your account's home partition |
| `SITE_NOINDEX` | variable | `true` until the site's domain points to Hostsmith. Previews are always no-index. |

## Working on the kit

This repository is an npm workspace: the package in `packages/site-kit-astro/` and the examples in `examples/`, which use the package from the workspace. `npm ci` installs them, `npm run build` builds the `basics` example, and `npm test` runs the kit's tests. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Every example is also a reference site: each release deploys it to its production site, and each branch of this repository to its preview site.

## License

[MIT](./LICENSE)
