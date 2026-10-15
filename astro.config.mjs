import { rm } from "node:fs/promises";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { markdownOptions } from "./src/lib/markdown.ts";
import { siteConfig } from "./src/site.config.ts";

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
  // The production site URL, set by the site in src/site.config.ts.
  site: siteConfig.url || undefined,
  // Webflow-style URLs without a trailing slash. Hostsmith serves /about from
  // about/index.html with status 200 and no redirect (design Q3).
  trailingSlash: "never",
  build: { format: "directory" },
  markdown: markdownOptions,
  integrations: [excludeAdmin],
  vite: { plugins: [tailwindcss()] },
});
