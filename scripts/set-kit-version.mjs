// Sets `kit.version` in hostsmith.json and writes kit.lock.json for that
// version. The release workflow runs it through cog's pre-bump hook, so the
// bump commit records the released version and the hashes of its kit-owned
// files (site-kit-updates design D18).
//
//   node scripts/set-kit-version.mjs 0.2.0
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { formatLock, kitLock, LOCK_FILE } from "./kit-files.mjs";

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

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const lock = kitLock(version, tracked, (path) => readFileSync(path));
writeFileSync(LOCK_FILE, formatLock(lock));
console.log(`${LOCK_FILE}: ${Object.keys(lock.kitFiles).length} kit-owned files`);
