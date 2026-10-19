// Reads the site's src/site.config.ts, for the commands that need its
// locales: section-id (site-kit-locales design D56) and decap-config (D55).
// Node imports the file as it is, since it is plain TypeScript without
// imports. The integration checks the locales; the commands only read them.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SITE_CONFIG = "src/site.config.ts";

// The site's locale codes, the default first, or undefined for a root
// without a site config.
export async function localeCodes(root = process.cwd()) {
  const file = join(root, SITE_CONFIG);
  if (!existsSync(file)) return undefined;
  // Only the commands call this. The build reaches the file through
  // src/content.ts, so Vite is told not to resolve the import.
  const { siteConfig } = await import(/* @vite-ignore */ pathToFileURL(file).href);
  return siteConfig?.locales?.map((locale) => locale.code);
}
