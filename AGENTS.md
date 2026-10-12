# Agent rules

> Placeholder. The full rules for agents working in a kit site (content edits, section types, the owner request workflow) come in a later kit release.

## Dependencies

Every dependency is pinned to an exact version, and `package-lock.json` is committed. Use only these packages:

- `astro`
- `@astrojs/markdown-satteri`
- `tailwindcss`
- `@tailwindcss/vite`
- `@hostsmith/sdk` (development dependency only)
- `@astrojs/react`, `react` and `react-dom`, only for the DevLink experiment

Don't add a package that isn't on this list. If a change seems to need one, stop and raise it with the freelancer instead.
