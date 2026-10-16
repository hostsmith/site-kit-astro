// The kit's Astro integration (site-kit-updates design D19). A site adds it in
// astro.config.mjs with its settings from src/site.config.ts:
//
//   import siteKit from "@hostsmith/site-kit-astro";
//   import { siteConfig } from "./src/site.config.ts";
//   export default defineConfig({ integrations: [siteKit(siteConfig)] });
//
// It sets the build options every kit site shares, injects the kit's routes,
// and gives kit code the site's settings and schemas through two virtual
// modules. Kit code reads nothing else from the site except the fixed paths in
// design D20.
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";
import { staleness } from "./scripts/decap-config.mjs";
import { markdownOptions } from "./src/lib/markdown.ts";

export type SiteConfig = {
  // The production site URL, such as "https://www.example.com".
  url: string;
  // Each site collection's base path, such as { news: { basePath: "/news" } }.
  collections: Record<string, { basePath: string }>;
};

const CONFIG_MODULE = "virtual:site-kit/config";
const SITE_SCHEMA_MODULE = "virtual:site-kit/site-schema";

// The kit's routes. Hand-written pages in the site's src/pages/ sit next to them.
const ROUTES = {
  "/[...slug]": "./src/routes/page.astro",
  "/404": "./src/routes/404.astro",
  "/sitemap.xml": "./src/routes/sitemap.xml.ts",
  "/robots.txt": "./src/routes/robots.txt.ts",
};

export default function siteKit(siteConfig: SiteConfig): AstroIntegration {
  return {
    name: "@hostsmith/site-kit-astro",
    hooks: {
      "astro:config:setup": ({ config, command, updateConfig, injectRoute }) => {
        const root = fileURLToPath(config.root);
        const siteSchema = join(root, "src", "site.schema.ts");
        if (!existsSync(siteSchema)) {
          throw new Error("Missing src/site.schema.ts. Every kit site has one: it exports siteSectionSchemas and siteCollections.");
        }
        if (command === "build") {
          const problem = staleness(root);
          if (problem) throw new Error(problem);
        }

        updateConfig({
          site: siteConfig.url || undefined,
          // Webflow-style URLs without a trailing slash. Hostsmith serves /about
          // from about/index.html with status 200 and no redirect (design Q3).
          trailingSlash: "never",
          build: { format: "directory" },
          markdown: markdownOptions,
          vite: {
            plugins: [
              tailwindcss(),
              {
                name: "site-kit:virtual-modules",
                resolveId(id: string) {
                  if (id === CONFIG_MODULE) return `\0${CONFIG_MODULE}`;
                  if (id === SITE_SCHEMA_MODULE) return siteSchema;
                },
                load(id: string) {
                  if (id === `\0${CONFIG_MODULE}`) return `export const siteConfig = ${JSON.stringify(siteConfig)};`;
                },
              },
            ],
          },
        });

        for (const [pattern, file] of Object.entries(ROUTES)) {
          injectRoute({ pattern, entrypoint: new URL(file, import.meta.url) });
        }
      },

      // The Decap config ships in the repo, but /admin is never deployed (design
      // D7). Astro copies public/ into the output, so the copy is removed here.
      "astro:build:done": async ({ dir }) => {
        await rm(new URL("admin/", dir), { recursive: true, force: true });
      },
    },
  };
}
