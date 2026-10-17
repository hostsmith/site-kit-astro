#!/usr/bin/env node
// The kit's command line tool (site-kit-updates design D22). A site's
// package.json runs it under the script names its rules use:
//
//   site-kit section-id <page file>       npm run section-id -- <page file>
//   site-kit check-urls [--live <url>]    npm run check:urls
//   site-kit check-styles                 npm run check:styles
//   site-kit decap-config [--check]       npm run decap-config
//   site-kit deploy check|deploy          the deploy workflow
//
// Every command runs in the site's root.
const COMMANDS = {
  "section-id": "../scripts/section-id.mjs",
  "check-urls": "../scripts/check-urls.mjs",
  "check-styles": "../scripts/check-styles.mjs",
  "decap-config": "../scripts/decap-config.mjs",
  deploy: "../scripts/hostsmith-deploy.mjs",
};

const [command, ...args] = process.argv.slice(2);
if (!Object.hasOwn(COMMANDS, command ?? "")) {
  console.error(`Usage: site-kit <command>, one of: ${Object.keys(COMMANDS).join(", ")}.`);
  process.exit(1);
}
const { cli } = await import(new URL(COMMANDS[command], import.meta.url).href);
await cli(args);
