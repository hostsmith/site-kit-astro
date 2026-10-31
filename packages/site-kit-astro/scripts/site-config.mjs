// Reads the site's src/site.config.ts, for the commands that need its
// settings: section-id its locales (site-kit-locales design D56), and
// decap-config its locales (D55) and its site variants (site-kit-site-variants
// design D159). Node imports the file as it is, since it is plain TypeScript
// without imports. The integration checks the settings; the commands only
// read them.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const SITE_CONFIG = "src/site.config.ts";

// The site's `siteConfig`, or undefined for a root without a site config.
export async function readSiteConfig(root = process.cwd()) {
  const file = join(root, SITE_CONFIG);
  if (!existsSync(file)) return undefined;
  // Only the commands call this. The build reaches the file through
  // src/content.ts, so Vite is told not to resolve the import.
  try {
    const { siteConfig } = await import(/* @vite-ignore */ pathToFileURL(file).href);
    return siteConfig;
  } catch (error) {
    throw new Error(`The kit's commands can't read ${SITE_CONFIG} (${error.message.split("\n")[0]}). It must be plain TypeScript without imports, since the commands read it outside the build.`);
  }
}

// The site's locale codes, the default first, or undefined for a root
// without a site config.
export async function localeCodes(root = process.cwd()) {
  return (await readSiteConfig(root))?.locales?.map((locale) => locale.code);
}
