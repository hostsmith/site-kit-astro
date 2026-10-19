// The site's locales, resolved from src/site.config.ts, and the locale of an
// entry or a URL (site-kit-locales design D47).
/// <reference path="../../virtual.d.ts" />
import { siteConfig } from "virtual:site-kit/config";
import { type Locale, localeOfId, resolveLocales } from "./locales.ts";

export const locales = resolveLocales(siteConfig.locales);

// A site with more than one locale: only it gets locale prefixes, the link
// rewrite, alternates and a language switcher.
export const localized = locales.length > 1;

// The locale of a field-attribute entry name, such as "pages/home.de".
export function localeOfRef(ref: string): Locale | undefined {
  return localeOfId(ref.split("/").slice(1).join("/"), locales);
}

// The locale of a locale code, or the default locale without one.
export function localeOfCode(code: string | undefined): Locale | undefined {
  return code === undefined ? locales[0] : locales.find((locale) => locale.code === code);
}

// The locale whose path starts a URL path, or the default locale.
export function localeOfPath(path: string): Locale {
  return locales.find((locale) => !locale.isDefault && (path === locale.path || path.startsWith(`${locale.path}/`))) ?? locales[0];
}
