// Takes a kit release into this site (site-kit-updates design D20):
//
//   npm run kit:update -- <version>                  # such as 0.5.0
//   npm run kit:update -- <version> --force <path>   # also take one kept file
//
// It fetches the release's tag with git, so the site needs no shared history
// with the kit, and works on a new branch, kit-update/v<version>:
//
// - a kit file the site hasn't changed since its installed release is
//   replaced, and a file new in the release is added;
// - a kit file the site changed or deleted is kept as it is, and reported;
// - a kit file the release dropped is deleted, unless the site changed it;
// - hostsmith.json, package.json and package-lock.json are merged by key, and
//   public/admin/config.yml is assembled again;
// - site files are never touched.
//
// Then it runs the checks and commits. Pushing the branch deploys it to the
// preview site. KIT_REPOSITORY overrides the kit's repository URL.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { LOCK_FILE, parseLock, sha256 } from "./kit-files.mjs";

const KIT_REPOSITORY = "https://github.com/hostsmith/site-kit-astro.git";

export const CHECKS = [
  ["npm", "ci", "--no-audit", "--no-fund"],
  ["npm", "run", "decap-config"],
  ["npm", "run", "build"],
  ["npm", "run", "check:urls"],
  ["npm", "test"],
];

const REASONS = {
  changed: "changed in this site, kept",
  deleted: "deleted in this site, not restored",
  exists: "the release adds it, but the site has its own file there, kept",
  dropped: "dropped by the release, but changed in this site, kept",
};

/**
 * What an update does with each kit-owned file.
 * - siteLock, releaseLock: the installed and the new release's locks.
 * - inRelease(path): whether the release's tree has the path.
 * - localHash(path): the SHA-256 of the site's file, or undefined.
 * - force: paths to take from the release whatever their state.
 * Returns the paths to write from the release, the paths to delete, and the
 * reported paths with their reason.
 */
export function planUpdate({ siteLock, releaseLock, inRelease, localHash, force = [] }) {
  const writes = [];
  const deletes = [];
  const reports = [];
  for (const [path, { sha256: releaseHash }] of Object.entries(releaseLock.kitFiles)) {
    const local = localHash(path);
    if (local === releaseHash) continue;
    const installed = siteLock.kitFiles[path]?.sha256;
    let reason;
    if (installed === undefined) reason = local === undefined ? undefined : "exists";
    else if (local === undefined) reason = "deleted";
    else if (local !== installed) reason = "changed";
    if (reason && !force.includes(path)) reports.push({ path, reason });
    else writes.push(path);
  }
  for (const [path, { sha256: installed }] of Object.entries(siteLock.kitFiles)) {
    if (releaseLock.kitFiles[path] || inRelease(path)) continue;
    const local = localHash(path);
    if (local === undefined) continue;
    if (local === installed) deletes.push(path);
    else reports.push({ path, reason: "dropped" });
  }
  return { writes, deletes, reports };
}

// hostsmith.json: the release's, with the site's `site`.
export function mergeManifest(siteText, releaseText) {
  const site = JSON.parse(siteText);
  const release = JSON.parse(releaseText);
  const merged = { ...release, site: site.site };
  // Keeps the release's layout when its `site` object is flat, as in v0.
  const inline = (value) => (Object.keys(value).length === 0 ? "{}" : `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`);
  const text = releaseText.replace(/("site"\s*:\s*)\{[^{}]*\}/, (_, key) => `${key}${inline(site.site ?? {})}`);
  try {
    if (isDeepStrictEqual(JSON.parse(text), merged)) return text;
  } catch {}
  return `${JSON.stringify(merged, null, 2)}\n`;
}

const PACKAGE_KEYS = ["dependencies", "devDependencies", "scripts", "engines"];

// package.json: the site's, with the release's dependencies, scripts and engines.
export function mergePackage(siteText, releaseText) {
  const merged = JSON.parse(siteText);
  const release = JSON.parse(releaseText);
  for (const key of PACKAGE_KEYS) {
    if (key in release) merged[key] = release[key];
    else delete merged[key];
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

// package-lock.json: the release's, with the root name and version of the
// site's package.json, as `npm install` writes them.
export function mergePackageLock(packageText, releaseLockText) {
  const pkg = JSON.parse(packageText);
  const lock = JSON.parse(releaseLockText);
  for (const target of [lock, lock.packages?.[""]]) {
    if (!target) continue;
    for (const key of ["name", "version"]) {
      if (pkg[key] === undefined) delete target[key];
      else target[key] = pkg[key];
    }
  }
  return `${JSON.stringify(lock, null, 2)}\n`;
}

function git(args, options = {}) {
  return execFileSync("git", args, { stdio: "pipe", maxBuffer: 256 * 1024 * 1024, ...options });
}

function parseArgs(args) {
  const force = [];
  let version;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--force") {
      if (!args[i + 1]) throw new Error("--force needs a path, such as --force src/components/sections/hero.astro");
      force.push(args[++i]);
    } else if (!version) {
      version = args[i].replace(/^v/, "");
    } else {
      throw new Error(`Unknown argument "${args[i]}".`);
    }
  }
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
    throw new Error("Usage: npm run kit:update -- <version> [--force <path>]...\nThe version is a kit release, such as 0.5.0.");
  }
  return { version, force };
}

const localHash = (path) => (existsSync(path) ? sha256(readFileSync(path)) : undefined);

function writeFile(path, content, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, mode === "100755" ? 0o755 : 0o644);
}

function commitMessage(version, reports, force) {
  const lines = [`chore: update the kit to v${version}`];
  for (const [reason, text] of Object.entries(REASONS)) {
    const paths = reports.filter((r) => r.reason === reason).map((r) => r.path);
    if (paths.length > 0) lines.push("", `Kit files ${text}:`, ...paths.map((path) => `- ${path}`));
  }
  if (force.length > 0) lines.push("", "Taken from the release with --force:", ...force.map((path) => `- ${path}`));
  return `${lines.join("\n")}\n`;
}

function printReports(version, reports) {
  if (reports.length === 0) return;
  console.log(`\n${reports.length} kit file${reports.length === 1 ? "" : "s"} kept as they are in this site:`);
  for (const { path, reason } of reports) console.log(`  ${path}: ${REASONS[reason]}`);
  console.log(`To take the release's version of one, run: npm run kit:update -- ${version} --force <path>`);
}

function main(args) {
  const { version, force } = parseArgs(args);
  const repository = process.env.KIT_REPOSITORY || KIT_REPOSITORY;

  if (git(["status", "--porcelain"], { encoding: "utf8" }).trim() !== "") {
    throw new Error("The working tree has uncommitted changes. Commit or stash them, then run the update again.");
  }
  if (!existsSync(LOCK_FILE)) {
    throw new Error(`${LOCK_FILE} is missing, so the update can't tell which kit files this site changed. It comes with sites created from kit release 0.4.0 or later.`);
  }
  const siteLock = parseLock(readFileSync(LOCK_FILE, "utf8"));

  // Named apart from the update branch, so neither name is ambiguous.
  const ref = `refs/kit-release/v${version}`;
  try {
    git(["fetch", "--quiet", "--depth", "1", "--no-tags", repository, `+refs/tags/v${version}:${ref}`]);
  } catch (error) {
    throw new Error(`Couldn't fetch kit release v${version} from ${repository}. Check the version and your access to the repository.\n${error.stderr ?? ""}`.trim());
  }

  try {
    const show = (path) => git(["cat-file", "blob", `${ref}:${path}`]);
    const modes = new Map();
    for (const entry of git(["ls-tree", "-r", "-z", ref], { encoding: "utf8" }).split("\0").filter(Boolean)) {
      const [info, path] = entry.split("\t");
      modes.set(path, info.split(" ")[0]);
    }
    const releaseLockText = show(LOCK_FILE).toString("utf8");
    const releaseLock = parseLock(releaseLockText, `${LOCK_FILE} of v${version}`);
    if (releaseLock.version !== version) throw new Error(`The lock of tag v${version} names version ${releaseLock.version}.`);

    for (const path of force) {
      if (!releaseLock.kitFiles[path]) throw new Error(`--force ${path}: the release has no kit-owned file at that path.`);
    }

    const { writes, deletes, reports } = planUpdate({ siteLock, releaseLock, inRelease: (path) => modes.has(path), localHash, force });

    const merged = new Map();
    for (const path of releaseLock.mergedFiles) {
      if (path === "public/admin/config.yml") continue; // assembled by the decap-config check below
      if (path === "package-lock.json") continue; // needs the merged package.json, below
      const release = show(path).toString("utf8");
      const site = existsSync(path) ? readFileSync(path, "utf8") : release;
      if (path === "hostsmith.json") merged.set(path, mergeManifest(site, release));
      else if (path === "package.json") merged.set(path, mergePackage(site, release));
      else throw new Error(`Kit release v${version} merges ${path}, which this version of kit:update can't merge. Run the release's own script: git show v${version}:scripts/kit-update.mjs`);
    }
    if (releaseLock.mergedFiles.includes("package-lock.json")) {
      const pkg = merged.get("package.json") ?? readFileSync("package.json", "utf8");
      merged.set("package-lock.json", mergePackageLock(pkg, show("package-lock.json").toString("utf8")));
    }
    merged.set(LOCK_FILE, releaseLockText);

    const changes = writes.length + deletes.length + [...merged].filter(([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text).length;
    if (changes === 0) {
      console.log(`This site already has kit v${version}.`);
      printReports(version, reports);
      return;
    }

    const branch = `kit-update/v${version}`;
    let current;
    try {
      current = git(["symbolic-ref", "--quiet", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      current = "a detached HEAD";
    }
    if (current !== `refs/heads/${branch}`) {
      try {
        git(["switch", "--quiet", "-c", branch]);
      } catch (error) {
        throw new Error(`Couldn't create branch ${branch}. If it already exists, switch to it to run the update again there, or delete it.\n${error.stderr ?? ""}`.trim());
      }
    }

    for (const path of writes) writeFile(path, show(path), modes.get(path));
    for (const path of deletes) rmSync(path);
    for (const [path, text] of merged) writeFile(path, text, modes.get(path));
    console.log(`Kit v${version} on branch ${branch}: ${writes.length} kit files replaced or added, ${deletes.length} deleted.`);
    printReports(version, reports);

    for (const [command, ...commandArgs] of CHECKS) {
      const step = [command, ...commandArgs].join(" ");
      console.log(`\n> ${step}`);
      const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: process.platform === "win32" });
      if (result.status !== 0) {
        throw new Error(`The update stopped: "${step}" failed. Nothing was committed. The release's changes are on branch ${branch}, to fix or to discard.`);
      }
    }

    git(["add", "--all"]);
    git(["commit", "--quiet", "--file", "-"], { input: commitMessage(version, reports, force) });
    console.log(`\nCommitted on ${branch}. Push the branch to deploy it to the preview site, check it there, then merge it into main.`);
  } finally {
    try {
      git(["update-ref", "-d", ref]);
    } catch {}
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
