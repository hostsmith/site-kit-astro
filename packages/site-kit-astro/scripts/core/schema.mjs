// Writes the schema export, .hostsmith/schema.json, from the collections Astro
// loads for the site (site-kit-core-split design D74, D75):
//
//   npx site-kit schema            # writes .hostsmith/schema.json
//   npx site-kit schema --check    # fails when it is missing or stale
//
// It runs Astro's sync() first, in the site's root, which is the working
// directory. The build checks the file too, and only warns when it is missing.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { manifestLocales } from "./locales.mjs";
import { contentSource, externalSite, MANIFEST, readManifest, siteKind } from "./manifest.mjs";
import { computeExport, EXPORT_COMMAND, EXPORT_FILE, EXPORT_MESSAGES, exportState, readExportInputs, serializeExport } from "./schema-export.mjs";

// Syncs the site and computes its export, as { schema, warnings }. In a kit
// site, `kitLocales` are its locale codes, the default first, which the kit
// reads from src/site.config.ts.
export async function exportSite(root, { kitLocales } = {}) {
  const config = await sync(root);
  return syncedExport(root, { kitLocales, cacheDir: fileURLToPath(config.cacheDir), storage: config.experimental?.collectionStorage });
}

// The export of a site that Astro has synced, as the build has by its
// astro:build:start hook. `cacheDir` and `storage` are the Astro config's
// cacheDir and experimental.collectionStorage.
export function syncedExport(root, { kitLocales, cacheDir, storage }) {
  const manifest = readManifest(root);
  if (!manifest) throw new Error(`Missing ${MANIFEST}. ${EXPORT_COMMAND} reads the site's media folder and its content settings from it.`);
  const kind = siteKind(root);
  if (kind === "kit" && !kitLocales?.length) throw new Error(`${EXPORT_COMMAND} found no locales in src/site.config.ts.`);
  const locales = kind === "kit" ? { default: kitLocales[0], codes: kitLocales } : manifestLocales(manifest, kind);
  if (storage && storage !== "single-file") {
    throw new Error(`The Astro config sets experimental.collectionStorage to "${storage}". ${EXPORT_COMMAND} reads the content data store as one file: remove the option.`);
  }
  return computeExport(readExportInputs(root, { manifest, kind, locales, cacheDir }));
}

// Astro's sync(), with the site's own astro, and the config it resolved.
async function sync(root) {
  const astro = createRequire(join(root, "package.json")).resolve("astro");
  const { sync: astroSync } = await import(pathToFileURL(astro).href);
  let resolved;
  const capture = { name: "site-kit:schema", hooks: { "astro:config:done": ({ config }) => (resolved = config) } };
  await astroSync({ root, logLevel: "warn", integrations: [capture] });
  return resolved;
}

async function main(args, context) {
  const unknown = args.filter((arg) => arg !== "--check");
  if (unknown.length > 0) throw new Error(`Usage: site-kit schema [--check]. Unknown: ${unknown.join(" ")}.`);
  const root = process.cwd();
  const manifest = readManifest(root);
  if (manifest && contentSource(manifest, siteKind(root)) === "external") {
    console.log(externalSite(`${EXPORT_COMMAND} writes no ${EXPORT_FILE}`));
    return;
  }
  const { schema, warnings } = await exportSite(root, context);
  for (const warning of warnings) console.warn(warning);
  const text = serializeExport(schema);

  if (args.includes("--check")) {
    const state = exportState(root, text);
    if (state) throw new Error(EXPORT_MESSAGES[state]);
    console.log(`${EXPORT_FILE} is up to date.`);
    return;
  }
  mkdirSync(dirname(join(root, EXPORT_FILE)), { recursive: true });
  writeFileSync(join(root, EXPORT_FILE), text);
  console.log(`Wrote ${EXPORT_FILE}.`);
}

// `site-kit schema [--check]` (bin/site-kit.mjs), which gives a kit site's
// locales as `kitLocales`.
export async function cli(args, context = {}) {
  try {
    await main(args, context);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
