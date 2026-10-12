// Sets `kit.version` in hostsmith.json. The release workflow runs it through
// cog's pre-bump hook, so the bump commit records the released version.
//
//   node scripts/set-kit-version.mjs 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("Usage: node scripts/set-kit-version.mjs <semver>");
  process.exit(1);
}

const text = readFileSync("hostsmith.json", "utf8");
const kitVersion = /("kit"\s*:\s*\{[^}]*"version"\s*:\s*")[^"]*(")/;
if (!kitVersion.test(text)) {
  console.error("hostsmith.json has no kit.version");
  process.exit(1);
}
writeFileSync("hostsmith.json", text.replace(kitVersion, `$1${version}$2`));
console.log(`kit.version = ${version}`);
