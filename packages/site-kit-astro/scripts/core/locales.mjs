// Locales in a core site (site-kit-core-split design D85). A core site may
// declare them in hostsmith.json:
//
//   "content": { "locales": { "default": "en", "codes": ["en", "de"] } }
//
// A code is the text the site's file paths use. Without `content.locales`, a
// core site is in one language. A kit site's locales are in
// src/site.config.ts, so its manifest has none.
import { MANIFEST } from "./manifest.mjs";

// One path segment of lowercase letters, digits and hyphens, such as "pt-br".
const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const WHERE = `content.locales in ${MANIFEST}`;

// The manifest's locales, checked, as { default, codes }, or null for a site
// in one language.
export function manifestLocales(manifest, kind) {
  const value = manifest?.content?.locales;
  if (value === undefined) return null;
  if (kind === "kit") {
    throw new Error(`${MANIFEST} sets content.locales, but a kit site's locales are in src/site.config.ts. Remove content.locales.`);
  }
  const shape = `${WHERE} must be { "default": "en", "codes": ["en", "de"] }`;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${shape}.`);
  const { default: defaultCode, codes, ...extra } = value;
  if (Object.keys(extra).length > 0) throw new Error(`${shape}, with no "${Object.keys(extra)[0]}".`);
  if (!Array.isArray(codes) || codes.length === 0) throw new Error(`${shape}: "codes" lists the site's locale codes.`);
  for (const code of codes) {
    if (typeof code !== "string" || !CODE.test(code)) {
      throw new Error(`${WHERE} has the code ${JSON.stringify(code)}. A code is one path segment of lowercase letters, digits and hyphens, such as "de" or "pt-br".`);
    }
  }
  const duplicate = codes.find((code, index) => codes.indexOf(code) !== index);
  if (duplicate) throw new Error(`${WHERE} lists "${duplicate}" twice.`);
  if (typeof defaultCode !== "string" || !codes.includes(defaultCode)) {
    throw new Error(`${WHERE} has the default ${JSON.stringify(defaultCode)}, which isn't one of its codes (${codes.join(", ")}).`);
  }
  return { default: defaultCode, codes };
}

// The core reads no locale from Astro. When the site sets both, they agree:
// the same default, and Astro's locales, each a string or an object's path,
// the same set as the codes.
export function checkAstroLocales(locales, i18n) {
  if (!locales || !i18n) return;
  const astroCodes = i18n.locales.map((locale) => (typeof locale === "string" ? locale : locale.path));
  const sameCodes = astroCodes.length === locales.codes.length && astroCodes.every((code) => locales.codes.includes(code));
  if (i18n.defaultLocale === locales.default && sameCodes) return;
  throw new Error(
    `${WHERE} (default ${locales.default}, codes ${locales.codes.join(", ")}) doesn't match i18n in the Astro config ` +
      `(defaultLocale ${i18n.defaultLocale}, locales ${astroCodes.join(", ")}). Make them the same.`,
  );
}
