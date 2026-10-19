// The locale helpers for site code, the package's `locales` export
// (site-kit-locales design D50): the site's locales, the locale of a URL
// path, and a link's path in a locale. The kit's middleware localizes every
// link in the rendered HTML with the same table, so site code needs
// localizedPath only for a link the HTML doesn't hold as an `a`, such as one
// a script builds in the browser from data the page renders.
//
// In the default locale, and so in a site with one locale, localizedPath
// returns the link as written.
/// <reference path="../../virtual.d.ts" />
import type { Locale } from "./locales.ts";
import { getRoutes } from "./routes.ts";
import { localeOfCode, localeOfPath, locales, localized } from "./site-locales.ts";

export type { Locale };
export { localeOfPath, locales, localized };

// A link written as its target's default-locale path, with any query and
// fragment, as its path in `locale`, a locale code such as "de".
export async function localizedPath(href: string, locale: string | undefined): Promise<string> {
  const target = localeOfCode(locale);
  if (!target) {
    throw new Error(`localizedPath: unknown locale "${locale}". The site's locales are ${locales.map((l) => l.code).join(", ")}.`);
  }
  if (target.isDefault) return href;
  return localize(href, await localizedPaths(target));
}

// Left as written: a link to a page without a translation, a link that
// already starts with a locale's path, and any link that doesn't start with
// "/".
export function localize(href: string, paths: Map<string, string>): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [, path, rest] = href.match(/^([^?#]*)(.*)$/)!;
  if (locales.some((locale) => !locale.isDefault && (path === locale.path || path.startsWith(`${locale.path}/`)))) return href;
  const translated = paths.get(path);
  return translated === undefined ? href : `${translated}${rest}`;
}

// For each route that has a translation in `locale`: its default-locale path,
// and its path in `locale`.
const cache = new Map<string, Promise<Map<string, string>>>();

export function localizedPaths(locale: Locale): Promise<Map<string, string>> {
  let paths = cache.get(locale.code);
  if (!paths) {
    paths = getRoutes().then((routes) => {
      const map = new Map<string, string>();
      const translated = (key: string, collection: string | undefined) =>
        routes.find((route) => route.locale.code === locale.code && route.key === key && (route.kind === "entry" ? route.collection : undefined) === collection);
      for (const route of routes) {
        if (!route.locale.isDefault) continue;
        const translation = translated(route.key, route.kind === "entry" ? route.collection : undefined);
        if (translation) map.set(route.path, translation.path);
      }
      return map;
    });
    cache.set(locale.code, paths);
  }
  return paths;
}
