#!/usr/bin/env node
// The kit's command line tool (site-kit-updates design D22). A site's
// package.json runs it under the script names its rules use:
//
//   site-kit section-id <page file>       npm run section-id -- <page file>
//   site-kit check-urls [--live <url>]    npm run check:urls
//   site-kit check-styles                 npm run check:styles
//   site-kit decap-config [--check]       npm run decap-config
//   site-kit schema [--check]             npx site-kit schema
//   site-kit deploy check|deploy          the deploy workflow
//
// Every command runs in the site's root. A site with src/site.schema.ts is a
// kit site, and any other is a core site (site-kit-core-split design D72).
// Each command names its module in each kind of site: one without a core
// module is for kit sites only.
import { siteKind } from "../scripts/core/manifest.mjs";

const COMMANDS = {
  "section-id": { kit: "../scripts/section-id.mjs" },
  "check-urls": { kit: "../scripts/core/check-urls.mjs", core: "../scripts/core/check-urls.mjs" },
  "check-styles": { kit: "../scripts/check-styles.mjs" },
  "decap-config": { kit: "../scripts/decap-config.mjs", core: "../scripts/core/decap-core.mjs" },
  schema: { kit: "../scripts/core/schema.mjs", core: "../scripts/core/schema.mjs" },
  "check-fields": { kit: "../scripts/core/check-fields.mjs", core: "../scripts/core/check-fields.mjs" },
  deploy: { kit: "../scripts/core/hostsmith-deploy.mjs", core: "../scripts/core/hostsmith-deploy.mjs" },
};

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(COMMANDS, command ?? "")) {
  console.error(`Usage: site-kit <command>, one of: ${Object.keys(COMMANDS).join(", ")}.`);
  process.exit(1);
}
const kind = siteKind(process.cwd());
const module = COMMANDS[command][kind];
if (!module) {
  console.error(`site-kit ${command} is for kit sites, which have src/site.schema.ts. This site has none.`);
  process.exit(1);
}

const { cli } = await import(new URL(module, import.meta.url).href);
if (command === "schema" && kind === "kit") {
  // The core's commands read a site only through its manifest, its
  // collections and its build output (site-kit-core-split design D69). A kit
  // site's locales are in src/site.config.ts, which kit code reads, so they
  // come from here.
  const { localeCodes } = await import(new URL("../scripts/site-config.mjs", import.meta.url).href);
  await cli(args, { kitLocales: await localeCodes() });
} else {
  await cli(args);
}
