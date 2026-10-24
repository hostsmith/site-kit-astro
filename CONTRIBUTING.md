# Contributing

Thanks for your interest in the Site Kit. Issues and pull requests are welcome. Please read this short guide first.

## Scope

This repository is the kit: the package `@hostsmith/site-kit-astro` with the content model, the shared section types, routing and SEO, the example sites that new sites start from, and the kit's tests. Good fits:

- Bugs in the build, routing, field attributes or section types
- Accessibility fixes
- Documentation fixes
- Test coverage

New section types and new dependencies need a discussion in an issue first. The kit keeps a short dependency allowlist for sites, listed in `packages/site-kit-astro/AGENTS.md`.

## Layout

The repository is an npm workspace:

| Path | What it is |
| --- | --- |
| `packages/site-kit-astro/` | the package, published to npm as TypeScript and `.astro` source, with no build step |
| `examples/<name>/` | the example sites. Each depends on the package's released version, which npm links to the workspace, and each is also a reference site (see below) |
| `tests/` | the kit's tests. They build every example, and copies of `basics` or `webflow` with the fixtures in `tests/fixtures/` |
| `tests/browser/` | the browser tests of the interactive parts: keyboard paths, pages without scripts, reduced motion and the network log, on the `interactive` fixture and the `webflow` example |
| `scripts/` | the release's version hook, the license policy, and the list of examples for the reference-site workflow |

The package's `exports` are part of its public API (see below). A module that sites may import needs an entry there, and a new one needs the same care as any other API change.

## Development

```bash
git clone https://github.com/hostsmith/site-kit-astro
cd site-kit-astro
npm ci
git config core.hooksPath .githooks
```

```bash
npm run build          # build every example with the package from the workspace
npm test               # run the kit's tests, including a build from the packed package
npm run test:browser   # run the browser tests of the interactive parts
```

The browser tests use [Playwright](https://playwright.dev)'s Chromium when it's installed, with `npx playwright install chromium` (about 150 MB), and the installed Google Chrome otherwise.

## Dependencies and licenses

Everything the package, with its peer `astro`, and the examples install must comply with the kit's license policy in `scripts/licenses.mjs`. `npm test` reads `package-lock.json`, with every platform's optional packages, and fails on a package that breaks it. The failure names the package, its license and the path that reaches it, so a dependency update can't bring a license in unnoticed. The release runs the same tests before it pushes.

The allowed licenses are `MIT`, `MIT-0`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `0BSD`, `BlueOak-1.0.0` and `CC0-1.0`. GPL, AGPL, SSPL and packages that declare no license are never allowed.

Two copyleft build tools are allowed as exceptions, each only through the packages that use it. npm installs them unmodified from their publishers, and none of their code reaches the package, an example or a built site:

| Packages | License | Only through | Why |
| --- | --- | --- | --- |
| `@img/sharp-libvips-*`, `@img/sharp-win32-*`, `@img/sharp-wasm32` | `LGPL-3.0-or-later`, alone or as `Apache-2.0 AND LGPL-3.0-or-later` or `Apache-2.0 AND LGPL-3.0-or-later AND MIT` | sharp and its bindings | sharp's prebuilt `libvips`, which npm installs for the platform |
| `sharp` | `Apache-2.0` | astro | Astro installs it as an optional dependency, which npm can't skip. The kit sets Astro's passthrough image service, so no build loads it |
| `lightningcss` | `MPL-2.0` | vite or @tailwindcss/node | Vite's and Tailwind's CSS transformer. The CSS it writes isn't its code |
| `lightningcss-*` | `MPL-2.0` | lightningcss | its prebuilt binaries |

The repository's own development dependency, Playwright (`Apache-2.0`), runs the browser tests. No site installs it, and neither the package nor an example reaches it.

To add a dependency, add it and run `npm test`.

- **A new permissive license** goes into `ALLOWED` and the list above in the same pull request, after someone has read it.
- **A new exception, or a new path to one,** needs an issue first. It changes `EXCEPTIONS` and the table above together.
- **No dependency's files are copied into the repository.** Third-party code, fonts and images in an example are listed in its `CREDITS.md` with their source and license.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook enforces the format.

| Type | When | Releases? |
| --- | --- | --- |
| `feat:` | new functionality | minor |
| `fix:` | bug fix | patch |
| `feat!:` or `BREAKING CHANGE:` | a break of the rules below | major |
| `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` | non-shipping | none |

## What makes a release major

Sites take minor and patch releases with `npm install` and nothing else. So a minor or patch release:

- keeps content that was valid under the previous release valid: a new prop or setting is optional or has a default;
- keeps the public API working: the integration's options, the exports of a site's `src/site.schema.ts`, the paths the kit reads from a site, the package's `exports` (see the README), and the styling hooks and states in `packages/site-kit-astro/HOOKS.md`;
- needs no change to the files a site took from its example, and no new major version of `astro`.

Anything else is a major release: a required prop or setting, a removed or renamed section type, prop, export, path or hook, a change a site has to make in its own files. A hook, state, variant, tone or section type is deprecated in a minor release before a major one removes it (see "Changing hooks"). Its release notes give the steps for a site's files. When a release needs a newer `astro` within the same major, its notes say which version.

## Changing hooks

A site's theme styles the kit through the hooks in `packages/site-kit-astro/HOOKS.md`, so a renamed or removed hook leaves part of every site unstyled. Renames and removals go through two releases, so a site can move to the replacement while the old hook still works:

| Change | Deprecation | Commit |
| --- | --- | --- |
| Add a hook, state, variant, tone or section type | none | `feat:` |
| Change an element's tag or nesting, keeping its hooks | none, since nesting isn't API; list it in the release notes | `feat:` or `fix:` |
| Rename a hook or state | deprecate, then remove | `feat:`, later `feat!:` |
| Remove a part, variant, tone or section type | deprecate, then remove | `feat:`, later `feat!:` |

**The deprecating release** (`feat:`):

1. Keep the old hook working:
   - a renamed hook: the element carries the new class and the old one, as in `class="sk-hero__title sk-hero__heading"`. This is the one exception to "one part class per element" besides `sk-prose`;
   - a removed part keeps rendering as before;
   - a removed variant, tone or section type: content that uses it still validates, and the build prints a warning naming the content file, the field and the replacement, or "no replacement".
2. Move the hook's row from its block's table to the `## Deprecated` table in `HOOKS.md`, with the replacement, the version and a note. The markup test keeps counting it, and `npm run check:styles` warns about it in sites.
3. Move every example's theme and content to the replacement in the same change. The theme tests fail on an example that still styles or uses a deprecated hook.
4. Add a fixture test showing that the old hook still renders, and that deprecated content still builds with its warning.
5. Give the release notes a "Deprecated" section: each hook with its replacement, and what to change in a site's theme and content.

**The removing release** (`feat!:`) comes at least one release later, never in the same one. Several deprecations can share it.

1. Drop the old class from the markup, and its row from the Deprecated table.
2. For a removed variant, tone or section type, content that still uses it fails the build, naming the file, the field and the replacement.
3. Give the release notes a "Removed" section with the same steps.

## Releases

Releases are automated from `main`. The release workflow makes the version commit `chore(version): vX.Y.Z` and the tag `vX.Y.Z`, runs the tests on them, and only then pushes both to `main`, which otherwise only takes pull requests. A failing test leaves `main`, the tags and npm as they were: fix it in a pull request, whose merge starts the release again. The version commit sets the package's version and pins every example to it. It pushes as the release GitHub App, which needs:

- the App installed on this repository, with contents write access;
- the App in the bypass list of `main`'s ruleset;
- the repository secrets `RELEASE_APP_CLIENT_ID` (the App's client ID) and `RELEASE_APP_PRIVATE_KEY` (its private key).

The workflow then publishes the package from the tag to npm with provenance. npm authenticates the job through the package's trusted publisher, set on npmjs.com to this repository and `release.yml`, so there is no npm token. If publishing fails, re-run the job: the tag and the GitHub release stay.

## Reference sites

Every example is deployed to Hostsmith by `.github/workflows/reference-site.yml`: each branch of this repository to the example's preview site, each release tag to its production site. The repository's two environments hold the settings:

- `preview` and `production` each have the secret `HOSTSMITH_TOKEN`, a Hostsmith API token restricted to that target's reference sites, with "Custom" permissions `sites:read` and `files:write`. `production` only takes `v*` tags.
- Each has one variable per example, `HOSTSMITH_SITE_ID_<NAME>`: the example's site for that target, where `<NAME>` is the folder name in capitals with `-` as `_`, such as `HOSTSMITH_SITE_ID_BASICS`.

A new example needs its two sites, its variable in both environments, both tokens extended to its sites, and a row in the README's "Examples" table with its production site. Without its variable, a branch push only builds it, and a release fails its production deploy.

## Pull requests

- Open a pull request against `main`.
- `npm test` must pass.
- Keep pull requests focused.

## Reporting security issues

Please don't open public issues for security reports. See [SECURITY.md](./SECURITY.md).
