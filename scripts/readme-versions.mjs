// Keeps the README's example commands at the released version, so "Start a
// site" and "Kit updates" name a release that exists. The release's bump hook,
// set-kit-version.mjs, runs it on README.md.
//
// Each pattern holds the text around a version: a create command's
// `examples/<name>#v1.2.3`, "`v1.2.3` the release", "kit release `1.2.3`",
// `kit-update/v1.2.3` and `@hostsmith/site-kit-astro@1.2.3`.
const PATTERNS = [
  /(examples\/[a-z0-9-]+#v)\d+\.\d+\.\d+()/g,
  /(`v)\d+\.\d+\.\d+(` the release)/g,
  /(kit release `)\d+\.\d+\.\d+(`)/g,
  /(kit-update\/v)\d+\.\d+\.\d+()/g,
  /(@hostsmith\/site-kit-astro@)\d+\.\d+\.\d+()/g,
];

export function withReleaseVersion(readme, version) {
  return PATTERNS.reduce((text, pattern) => text.replace(pattern, (_, before, after) => `${before}${version}${after}`), readme);
}
