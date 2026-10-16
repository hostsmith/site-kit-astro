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
| `tests/` | the kit's tests. They build every example, and copies of `basics` with the fixtures in `tests/fixtures/` |
| `scripts/` | the release's version hook, and the list of examples for the reference-site workflow |

The package's `exports` are part of its public API (see below). A module that sites may import needs an entry there, and a new one needs the same care as any other API change.

## Development

```bash
git clone https://github.com/hostsmith/site-kit-astro
cd site-kit-astro
npm ci
git config core.hooksPath .githooks
```

```bash
npm run build   # build the basics example with the package from the workspace
npm test        # run the kit's tests, including a build from the packed package
```

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
- keeps the public API working: the integration's options, the exports of a site's `src/site.schema.ts`, the paths the kit reads from a site, and the package's `exports` (see the README);
- needs no change to the files a site took from its example, and no new major version of `astro`.

Anything else is a major release: a required prop or setting, a removed or renamed section type, prop, export or path, a change a site has to make in its own files. Its release notes give the steps for a site's files. When a release needs a newer `astro` within the same major, its notes say which version.

## Releases

Releases are automated from `main`. The release workflow pushes the version commit `chore(version): vX.Y.Z` and the tag `vX.Y.Z` to `main`, which otherwise only takes pull requests. The version commit sets the package's version and pins every example to it. It pushes as the release GitHub App, which needs:

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
