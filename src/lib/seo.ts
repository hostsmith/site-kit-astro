// Preview builds, and production builds before the DNS switch, run with
// SITE_NOINDEX=true: every page gets a noindex robots meta and robots.txt
// disallows everything.
export function isNoindexBuild(): boolean {
  return process.env.SITE_NOINDEX === "true";
}

// An absolute URL on the production site, set once as `site` in astro.config.mjs.
export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) throw new Error('Set `site` in astro.config.mjs to the production site URL, such as "https://www.example.com".');
  return new URL(path, site).href;
}
