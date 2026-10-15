# Site Kit

A starter template for small-business websites, built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com). Content lives in Markdown and YAML files, so people and AI agents can change a site with ordinary edits and review them in a pull request.

The kit is plain Astro. Hostsmith appears only in deployment tooling, so a kit site builds and runs on any static host.

## Start a site

1. Click **Use this template** on GitHub to create a repository for the site.
2. Install and build:

   ```bash
   npm ci
   npm run build   # writes the static site to dist/
   npm run dev     # local preview with live reload
   ```

3. Set `url` in `src/site.config.ts` to the site's production URL, and replace the example content in `src/content/` and the tokens in `src/styles/tokens.css`.

## How content works

- **Pages** are `src/content/pages/**/*.md`. A page is an ordered list of typed sections in its frontmatter, and its body stays empty. `home` is served at `/`, and other pages at `/<file path>`.
- **Sections** have a stable `id` and a `type`. Get a new id with `npm run section-id -- <page file>`. The shared section types are in `src/components/sections/`, and site-specific ones go in `src/components/sections/site/`, with their schemas in `src/site.schema.ts`.
- **Collections**, such as `news`, are folders of Markdown entries. Each has a schema in `src/site.schema.ts`, a base path in `src/site.config.ts` and a detail template in `src/components/collections/`.
- **Settings** are in `src/content/settings/site.yml`: site name, language, navigation, footer, contact details and interface text.
- **Schemas** come in two parts. The kit's part is `public/admin/config.kit.yml` (Decap CMS), mirrored in `src/content.config.ts`. The site's part is `public/admin/config.site.yml`, mirrored in `src/site.schema.ts`. Change each pair together, then run `npm run decap-config`, which assembles `public/admin/config.yml` for Decap from the two Decap parts.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the site into `dist/`. Set `SITE_NOINDEX=true` for preview builds. |
| `npm run dev` | Starts the dev server. |
| `npm test` | Runs the kit's self-tests. |
| `npm run section-id -- <page file>` | Prints a new section id for that page. |
| `npm run check:urls` | Checks that every path in `.hostsmith/old-urls.txt` has a page. Add `--live <url>` to check a deployed site. |
| `npm run decap-config` | Assembles `public/admin/config.yml` from the kit's and the site's Decap parts. |
| `npm run kit:update -- <version>` | Takes a kit release into the site, on a new branch. See [Kit updates](#kit-updates). |

## Kit updates

A site created from the template takes later kit releases with one command. Every file has one owner:

- **The kit** owns the files listed under `kitFiles` in `kit.lock.json`: the layout, the section library, the build and deploy setup, the scripts and the tests. Don't edit them in a site. To change a library section for one site, copy it into `src/components/sections/site/` under a new name.
- **Merged files** hold a part of each: `hostsmith.json`, `package.json`, `package-lock.json` and `public/admin/config.yml`. An update keeps the site's part, such as `site.id` and the package name.
- **The site** owns everything else: content, media, tokens, `src/site.config.ts`, `src/site.schema.ts`, `public/admin/config.site.yml`, site-local sections, collection templates, custom pages and this README. No update touches them.

To update, with a clean working tree:

```bash
npm run kit:update -- 0.5.0
```

It fetches the release's tag, so the site needs no shared git history with the kit. On a new branch, `kit-update/v0.5.0`, it replaces each kit file the site hasn't changed since its installed release, merges the merged files, and runs `npm ci`, `npm run decap-config`, the build, `npm run check:urls` and `npm test`. If they pass, it commits. Push the branch to deploy it to the preview site, check it there, then merge it into `main`.

A **reported file** is a kit file the update left alone, because the site changed it, deleted it, or has its own file where the release adds one. The update lists each one, and so does its commit message. The site's version stays, and stops getting kit fixes. To take the release's version of a reported file, run the update again with `--force <path>`.

While the kit repository is private, fetching a release needs read access to it.

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

The workflow never runs in the kit's own repository.

## License

[MIT](./LICENSE)
