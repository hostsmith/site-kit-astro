# Contributing

Thanks for your interest in the Site Kit. Issues and pull requests are welcome. Please read this short guide first.

## Scope

This repository is the template itself: the content model, the shared section types, routing and SEO, and the kit's tests. Good fits:

- Bugs in the build, routing, field attributes or section types
- Accessibility fixes
- Documentation fixes
- Test coverage

New section types and new dependencies need a discussion in an issue first. The kit keeps a short dependency allowlist, listed in `AGENTS.md`.

## Development

```bash
git clone https://github.com/hostsmith/site-kit-astro
cd site-kit-astro
npm ci
git config core.hooksPath .githooks
```

```bash
npm run build   # build the example site
npm test        # run the kit's self-tests
```

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook enforces the format.

| Type | When | Releases? |
| --- | --- | --- |
| `feat:` | new functionality | minor |
| `fix:` | bug fix | patch |
| `feat!:` or `BREAKING CHANGE:` | breaking change to the content model or a section type | major |
| `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` | non-shipping | none |

### What makes a release major

Sites take minor and patch releases with `npm run kit:update`, which never touches their content. So a minor or patch release keeps valid content valid: a new prop or setting is optional or has a default. A change that makes content invalid that was valid under the previous release is a major release (`feat!:` or `BREAKING CHANGE:`), and its release notes give the steps to migrate a site's files. For example:

- a new required prop, settings field or page frontmatter key;
- a removed or renamed section type, prop, variant or collection field;
- a stricter format for an existing field, such as a narrower link rule;
- a change to the format of a site's part: `public/admin/config.site.yml`, `src/site.schema.ts`, `src/site.config.ts`, or the site's keys in a merged file.

Updates deliver only the paths that `scripts/kit-files.mjs` lists as kit-owned or merged. A new kit file outside those lists counts as the site's, and no update brings it to existing sites.

### Releases

Releases are automated from `main`. The release workflow pushes the version commit `chore(version): vX.Y.Z` and the tag `vX.Y.Z` to `main`, which otherwise only takes pull requests. The version commit sets `kit.version` in `hostsmith.json` and writes `kit.lock.json`, the hashes of the release's kit-owned files that `npm run kit:update` compares a site against. It pushes as the release GitHub App, which needs:

- the App installed on this repository, with contents write access;
- the App in the bypass list of `main`'s ruleset;
- the repository secrets `RELEASE_APP_CLIENT_ID` (the App's client ID) and `RELEASE_APP_PRIVATE_KEY` (its private key).

## Pull requests

- Open a pull request against `main`.
- `npm test` must pass.
- Keep pull requests focused.

## Reporting security issues

Please don't open public issues for security reports. See [SECURITY.md](./SECURITY.md).
