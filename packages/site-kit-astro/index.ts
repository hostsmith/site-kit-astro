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
// design D20. It runs the core's hooks before its own (site-kit-core-split
// design D71), so a kit site has everything a core site has.
import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { passthroughImageService } from "astro/config";
import { staleness } from "./scripts/decap-config.mjs";
import { coreHooks } from "./src/core/integration.ts";
import { setEmbedLoad } from "./src/lib/embed.ts";
import { type LocaleConfig, resolveLocales } from "./src/lib/locales.ts";
import { markdownOptions, markdownProcessor } from "./src/lib/markdown.ts";

export type SiteConfig = {
  // The production site URL, such as "https://www.example.com".
  url: string;
  // The site's locales, the default first (src/lib/locales.ts). A site in one
  // language lists one.
  locales: readonly LocaleConfig[];
  // Each site collection's base path, such as { news: { basePath: "/news" } },
  // or an object with a base path per locale code, and its own `breadcrumb`
  // switch, which wins over the site's.
  collections: Record<string, { basePath: string | Record<string, string>; breadcrumb?: boolean }>;
  // Whether pages whose path has more than one segment show the breadcrumb:
  // on unless false (site-kit-webflow-migration design D132).
  breadcrumb?: boolean;
  // The site's own looks for library section types, by type and name, each
  // with its label and the kit variants it goes with, such as
  // { faq: { boxed: { label: "Boxed, with a border" } } }
  // (site-kit-site-variants design D159, scripts/site-variants.mjs).
  siteVariants?: Record<string, Record<string, { label: string; variants?: readonly string[] }>>;
  // Whether the site's motion follows a visitor's reduced motion setting:
  // "respect", the default, or "ignore", for a site migrated from one that
  // played its motion for every visitor (site-kit-motion design D164).
  reducedMotion?: "respect" | "ignore";
  // How the site's embeds load when they set no `load` of their own, and its
  // video links in Markdown bodies, which can't: "click", the default, or
  // "direct", for a site migrated from one whose frames loaded with the page
  // (site-kit-webflow-migration design D196).
  embedLoad?: "click" | "direct";
};

const REDUCED_MOTION = ["respect", "ignore"];
const EMBED_LOAD = ["click", "direct"];

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
  // The site's locale codes, the default first, for the schema export's check.
  const core = coreHooks({ kitLocales: () => resolveLocales(siteConfig.locales).map((locale) => locale.code) });
  return {
    name: "@hostsmith/site-kit-astro",
    hooks: {
      "astro:routes:resolved": core["astro:routes:resolved"],
      "astro:build:start": core["astro:build:start"],

      "astro:config:setup": async (params) => {
        await core["astro:config:setup"](params);
        const { config, command, updateConfig, injectRoute, addMiddleware } = params;
        const root = fileURLToPath(config.root);
        const siteSchema = join(root, "src", "site.schema.ts");
        if (!existsSync(siteSchema)) {
          throw new Error("Missing src/site.schema.ts. Every kit site has one: it exports siteSectionSchemas and siteCollections.");
        }
        // Fails early, naming what to fix, on locales the kit can't serve.
        const locales = resolveLocales(siteConfig.locales);
        if (siteConfig.reducedMotion !== undefined && !REDUCED_MOTION.includes(siteConfig.reducedMotion)) {
          throw new Error(`reducedMotion in src/site.config.ts is ${JSON.stringify(siteConfig.reducedMotion)}. It is "respect", the default, or "ignore".`);
        }
        if (siteConfig.embedLoad !== undefined && !EMBED_LOAD.includes(siteConfig.embedLoad)) {
          throw new Error(`embedLoad in src/site.config.ts is ${JSON.stringify(siteConfig.embedLoad)}. It is "click", the default, or "direct".`);
        }
        setEmbedLoad(siteConfig.embedLoad ?? "click");
        if (command === "build") {
          const problem = staleness(root, locales.map((locale) => locale.code), siteConfig.siteVariants);
          if (problem) throw new Error(problem);
        }

        updateConfig({
          site: siteConfig.url || undefined,
          // Webflow-style URLs without a trailing slash. Hostsmith serves /about
          // from about/index.html with status 200 and no redirect (design Q3).
          trailingSlash: "never",
          build: { format: "directory" },
          // Images are served as their files are. Astro's default service
          // loads sharp, whose prebuilt libvips is LGPL (site-kit-licenses D66).
          image: { service: passthroughImageService() },
          markdown: { ...markdownOptions, processor: markdownProcessor },
          vite: {
            plugins: [
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
        // A localized site's links point to the page's own locale (site-kit-locales design D50).
        if (locales.length > 1) addMiddleware({ entrypoint: new URL("./src/middleware.ts", import.meta.url), order: "post" });
      },

      // The core removes /admin from the output (design D7). Then each locale's
      // 404 page, built as <path>/404/index.html, becomes <path>/404.html,
      // where hosts look for it (site-kit-locales design D57).
      "astro:build:done": async (params) => {
        await core["astro:build:done"](params);
        const { dir } = params;
        for (const locale of resolveLocales(siteConfig.locales)) {
          if (locale.isDefault) continue;
          const built = new URL(`.${locale.path}/404/index.html`, dir);
          if (!existsSync(built)) continue;
          await rename(built, new URL(`.${locale.path}/404.html`, dir));
          await rm(new URL(`.${locale.path}/404/`, dir), { recursive: true, force: true });
        }
      },
    },
  };
}
