// Sets the kit's version for a release: the package's version, every
// example's dependency on the package, and both in the workspace's
// package-lock.json. The release workflow runs it through cog's pre-bump hook,
// so the bump commit records the released version (site-kit-updates design
// D26).
//
//   node scripts/set-kit-version.mjs 0.4.0
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const PACKAGE = "packages/site-kit-astro";
const NAME = "@hostsmith/site-kit-astro";
const EXAMPLES = readdirSync("examples", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `examples/${entry.name}`);

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("Usage: node scripts/set-kit-version.mjs <semver>");
  process.exit(1);
}

// Rewrites a JSON file the way npm writes it.
function update(file, change) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  change(json);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

update(`${PACKAGE}/package.json`, (pkg) => {
  pkg.version = version;
});
for (const example of EXAMPLES) {
  update(`${example}/package.json`, (pkg) => {
    pkg.dependencies[NAME] = version;
  });
}
update("package-lock.json", (lock) => {
  lock.packages[PACKAGE].version = version;
  for (const example of EXAMPLES) lock.packages[example].dependencies[NAME] = version;
});
console.log(`${NAME} = ${version}, in ${EXAMPLES.join(", ")}`);
