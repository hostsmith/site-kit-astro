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

Releases are automated from `main`.

## Pull requests

- Open a pull request against `main`.
- `npm test` must pass.
- Keep pull requests focused.

## Reporting security issues

Please don't open public issues for security reports. See [SECURITY.md](./SECURITY.md).
