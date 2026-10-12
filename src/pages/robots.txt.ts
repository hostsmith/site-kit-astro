// /robots.txt (design D6). A no-index build disallows everything.
import type { APIRoute } from "astro";
import { absoluteUrl, isNoindexBuild } from "../lib/seo.ts";

export const GET: APIRoute = ({ site }) => {
  const body = isNoindexBuild()
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl("/sitemap.xml", site)}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
