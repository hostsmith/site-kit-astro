// /sitemap.xml, at the path Webflow used (design D6): every page and
// non-draft entry, except 404, from the same path list as the routes. In a
// localized site, every locale's URLs, and each URL with translations lists
// them all, itself included, and the default locale's as x-default, as
// Webflow writes them (site-kit-locales design D51).
import type { APIRoute } from "astro";
import { getRoutes, getTranslations } from "../lib/routes.ts";
import { absoluteUrl } from "../lib/seo.ts";
import { localized } from "../lib/site-locales.ts";

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export const GET: APIRoute = async ({ site }) => {
  const routes = (await getRoutes()).toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const url = (path: string) => escapeXml(absoluteUrl(path, site));
  const urls = await Promise.all(
    routes.map(async (route) => {
      const translations = await getTranslations(route);
      if (translations.length < 2) return `  <url><loc>${url(route.path)}</loc></url>`;
      const links = translations.map((translation) => `    <xhtml:link rel="alternate" hreflang="${translation.locale.tag}" href="${url(translation.path)}"/>`);
      const xDefault = translations.find((translation) => translation.locale.isDefault);
      if (xDefault) links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${url(xDefault.path)}"/>`);
      return ["  <url>", `    <loc>${url(route.path)}</loc>`, ...links, "  </url>"].join("\n");
    }),
  );
  const namespaces = localized ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : "";
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${namespaces}>`,
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
