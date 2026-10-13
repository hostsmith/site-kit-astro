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

3. Replace the example content in `src/content/` and the tokens in `src/styles/tokens.css`.

## How content works

- **Pages** are `src/content/pages/**/*.md`. A page is an ordered list of typed sections in its frontmatter, and its body stays empty. `home` is served at `/`, and other pages at `/<file path>`.
- **Sections** have a stable `id` and a `type`. Get a new id with `npm run section-id -- <page file>`. The shared section types are in `src/components/sections/`, and site-specific ones go in `src/components/sections/site/`.
- **Collections**, such as `news`, are folders of Markdown entries. Each has a base path in `src/site.config.ts` and a detail template in `src/components/collections/`.
- **Settings** are in `src/content/settings/site.yml`: site name, language, navigation, footer, contact details and interface text.
- `public/admin/config.yml` is the Decap CMS schema, and `src/content.config.ts` mirrors it. Change both together.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the site into `dist/`. Set `SITE_NOINDEX=true` for preview builds. |
| `npm run dev` | Starts the dev server. |
| `npm test` | Runs the kit's self-tests. |
| `npm run section-id -- <page file>` | Prints a new section id for that page. |
| `npm run check:urls` | Checks that every path in `.hostsmith/old-urls.txt` has a page. Add `--live <url>` to check a deployed site. |

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
