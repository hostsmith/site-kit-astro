// Localizes links (site-kit-locales design D50). Content writes an internal
// link as its target's path in the default locale, in every locale. On a page
// in another locale, a link to a page or entry with a translation in that
// locale becomes the translation's path, wherever the link comes from: a
// section, the settings, a Markdown body or the site's own markup. Astro runs
// this for every prerendered page in the build, and every page in dev.
//
// Left as written: a link to a page without a translation, a link that
// already starts with a locale's path, an `a` with `hreflang` (the language
// switcher), and any link that doesn't start with "/".
/// <reference path="../virtual.d.ts" />
import { defineMiddleware } from "astro:middleware";
import { localize, localizedPaths } from "./lib/localize.ts";
import { localeOfPath, localized } from "./lib/site-locales.ts";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!localized) return response;
  const locale = localeOfPath(context.url.pathname);
  if (locale.isDefault) return response;
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const paths = await localizedPaths(locale);
  const html = (await response.text()).replace(/<a\s[^>]*>/g, (tag) => {
    if (/\shreflang=/i.test(tag)) return tag;
    return tag.replace(/(\shref=")(\/[^"]*)"/, (attribute, start: string, href: string) => `${start}${localize(href, paths)}"`);
  });
  return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
});
