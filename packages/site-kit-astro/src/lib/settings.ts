// The site's settings, one file per locale, src/content/settings/site.<code>.yml
// (site-kit-locales design D54). Without a locale, the default locale's.
/// <reference path="../../virtual.d.ts" />
import { getEntry } from "astro:content";
import { siteConfig } from "virtual:site-kit/config";
import { resolveLocales } from "./locales.ts";

const locales = resolveLocales(siteConfig.locales);

// Field-attribute entry name of a locale's settings, such as "settings/site.de".
export function settingsRef(locale?: string): string {
  return `settings/site.${locale ?? locales[0].code}`;
}

// Field-attribute entry name of the default locale's settings.
export const SETTINGS = settingsRef();

// A locale's settings. Their `language` is the locale's tag, which the
// settings schema fills in.
export async function getSettings(locale?: string) {
  const id = `site.${locale ?? locales[0].code}`;
  const entry = await getEntry("settings", id);
  if (!entry) throw new Error(`Missing src/content/settings/${id}.yml. Every locale has its settings.`);
  return entry.data;
}
