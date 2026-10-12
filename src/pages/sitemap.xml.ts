// /sitemap.xml, at the path Webflow used (design D6): every page and
// non-draft entry, except 404, from the same path list as the routes.
import type { APIRoute } from "astro";
import { getRoutes } from "../lib/routes.ts";
import { absoluteUrl } from "../lib/seo.ts";

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export const GET: APIRoute = async ({ site }) => {
  const paths = (await getRoutes()).map((route) => route.path).sort();
  const urls = paths.map((path) => `  <url><loc>${escapeXml(absoluteUrl(path, site))}</loc></url>`);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
