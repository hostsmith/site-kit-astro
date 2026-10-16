// Lists the examples for the reference-site workflow's matrix (site-kit-updates
// design D28): each example's folder name, and the suffix of its site variable
// in the "production" and "preview" environments. Example "basics" reads
// HOSTSMITH_SITE_ID_BASICS, example "menu-board" HOSTSMITH_SITE_ID_MENU_BOARD.
//
//   node scripts/list-examples.mjs >> "$GITHUB_OUTPUT"   # list=[{"name":"basics","key":"BASICS"}]
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function listExamples(dir = "examples") {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ name, key: name.toUpperCase().replaceAll("-", "_") }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`list=${JSON.stringify(listExamples())}`);
}
