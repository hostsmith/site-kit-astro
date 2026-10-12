import { rm } from "node:fs/promises";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { markdownOptions } from "./src/lib/markdown.ts";

// The Decap config ships in the repo, but /admin is never deployed (design D7).
// Astro copies public/ into the output, so the copy is removed after the build.
const excludeAdmin = {
  name: "site-kit:exclude-admin",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      await rm(new URL("admin/", dir), { recursive: true, force: true });
    },
  },
};

export default defineConfig({
  // The production site URL. Canonical links, Open Graph URLs, the sitemap
  // and robots.txt are built from it.
  site: "https://www.example.com",
  // Webflow-style URLs without a trailing slash. Hostsmith serves /about from
  // about/index.html with status 200 and no redirect (design Q3).
  trailingSlash: "never",
  build: { format: "directory" },
  markdown: markdownOptions,
  integrations: [excludeAdmin],
  vite: { plugins: [tailwindcss()] },
});
