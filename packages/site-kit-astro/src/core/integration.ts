// The core's Astro hooks (site-kit-core-split design D71). siteKitCore() is
// these hooks alone, and the kit's integration calls each of them before its
// own, so every kit site has them too.
//
// They change no page: a build that isn't static fails, a stale schema export
// fails the build, and the CMS admin never reaches the output. They set none
// of the site's build options.
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { CONFIG_MESSAGES, CORE_CONFIG, configOf, configState } from "../../scripts/core/decap-core.mjs";
import { checkAstroLocales, manifestLocales } from "../../scripts/core/locales.mjs";
import { contentSource, readManifest, siteKind } from "../../scripts/core/manifest.mjs";
import { syncedExport } from "../../scripts/core/schema.mjs";
import { EXPORT_FILE, EXPORT_MESSAGES, exportState, serializeExport } from "../../scripts/core/schema-export.mjs";

export const CORE_INTEGRATION = "@hostsmith/site-kit-astro/core";

// The core's one virtual module: the manifest's locales, for the copy helper
// (D77). No page imports it.
const CORE_MODULE = "virtual:site-kit/core";

const STATIC_ONLY = "Hostsmith serves static files only";

export type CoreHooks = Required<
  Pick<AstroIntegration["hooks"], "astro:config:setup" | "astro:routes:resolved" | "astro:build:start" | "astro:build:done">
>;

export type CoreOptions = {
  // A kit site's locale codes, the default first. The kit gives them, since
  // they are in src/site.config.ts, which the core doesn't read.
  kitLocales?: () => string[];
};

export function coreHooks({ kitLocales }: CoreOptions = {}): CoreHooks {
  // What the build's checks need from the config, which astro:build:start doesn't get.
  let site: { root: string; kind: string; source: string; cacheDir: string; storage?: string } | undefined;

  return {
    // Hostsmith serves the build output as files (Q11). This runs before a
    // build resolves its routes, so server output is named as the cause
    // rather than every page it makes on demand.
    "astro:config:setup": ({ config, updateConfig }) => {
      if (config.output !== "static") {
        throw new Error(`The Astro config sets output to "${config.output}". ${STATIC_ONLY}: remove "output", or set it to "static".`);
      }
      // Where the content lives (D86), then the manifest's locales, which
      // agree with Astro's when the site sets both (D85).
      const root = fileURLToPath(config.root);
      const kind = siteKind(root);
      const manifest = readManifest(root);
      const source = contentSource(manifest, kind);
      const locales = manifestLocales(manifest, kind);
      checkAstroLocales(locales, config.i18n);
      site = { root, kind, source, cacheDir: fileURLToPath(config.cacheDir), storage: config.experimental?.collectionStorage };

      updateConfig({
        vite: {
          plugins: [
            {
              name: "site-kit:core",
              resolveId: (id: string) => (id === CORE_MODULE ? `\0${CORE_MODULE}` : undefined),
              load: (id: string) => (id === `\0${CORE_MODULE}` ? `export const locales = ${JSON.stringify(locales)};` : undefined),
            },
          ],
        },
      });
    },

    // A page or endpoint that opts out of prerendering. Astro's own routes,
    // such as the image endpoint in dev, are left alone.
    "astro:routes:resolved": ({ routes }) => {
      const onDemand = routes.filter((route) => route.origin !== "internal" && !route.isPrerendered);
      if (onDemand.length > 0) {
        const names = onDemand.map((route) => route.entrypoint).join(", ");
        throw new Error(`${names} ${onDemand.length === 1 ? "is" : "are"} rendered on demand. ${STATIC_ONLY}: remove "export const prerender = false".`);
      }
    },

    // The schema export against the content Astro has just synced, before any
    // page renders (D75). A stale export fails. A missing one only warns in
    // 0.7.x, so a kit site takes the release with no new file. A site whose
    // content is in an external CMS has neither an export nor a Decap config
    // (D86).
    "astro:build:start": ({ logger }) => {
      if (!site || site.source === "external") return;
      if (!existsSync(join(site.root, EXPORT_FILE))) {
        logger.warn(EXPORT_MESSAGES.missing);
        return;
      }
      const { schema, warnings } = syncedExport(site.root, { kitLocales: kitLocales?.(), cacheDir: site.cacheDir, storage: site.storage });
      for (const warning of warnings) logger.warn(warning);
      if (exportState(site.root, serializeExport(schema))) throw new Error(EXPORT_MESSAGES.stale);

      // A core site's Decap config, against a fresh generation from the
      // export (D78). A kit site's assembled config has its own check (D21).
      if (site.kind === "core") {
        if (!existsSync(join(site.root, CORE_CONFIG))) logger.warn(CONFIG_MESSAGES.missing);
        else if (configState(site.root, configOf(site.root))) throw new Error(CONFIG_MESSAGES.stale);
      }
    },

    // A site's Decap config ships in its repo, but /admin is never deployed
    // (site-kit-core D7). Astro copies public/ into the output, so the copy is
    // removed here.
    "astro:build:done": async ({ dir }) => {
      await rm(new URL("admin/", dir), { recursive: true, force: true });
    },
  };
}
