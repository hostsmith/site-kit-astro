// Which paths of a kit site the kit owns, and the lock that records them
// (site-kit-updates design D18).
//
// - kit: replaced by an update when the site hasn't changed it;
// - merged: rebuilt by an update from the release's part and the site's part;
// - lock: kit.lock.json, replaced by the release's lock;
// - kit-repo: kit repository only, never added to or updated in a site;
// - site: everything else, which no update touches.
//
// Ownership is by file, not by folder: src/pages/ and public/ hold both. A
// release writes kit.lock.json from these lists; an update reads ownership
// from the locks, never from this module.
import { createHash } from "node:crypto";

export const LOCK_FILE = "kit.lock.json";

export const KIT_REPO_ONLY = [
  "cog.toml",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/ISSUE_TEMPLATE/**",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "scripts/set-kit-version.mjs",
];

export const MERGED = ["hostsmith.json", "package.json", "package-lock.json", "public/admin/config.yml"];

export const KIT = [
  "astro.config.mjs",
  "tsconfig.json",
  ".tool-versions",
  "src/content.config.ts",
  "src/layouts/**",
  "src/lib/**",
  "src/components/Sections.astro",
  "src/components/sections/*.astro",
  "src/components/sections/registry.ts",
  "src/pages/[...slug].astro",
  "src/pages/404.astro",
  "src/pages/sitemap.xml.ts",
  "src/pages/robots.txt.ts",
  "src/styles/global.css",
  "public/admin/config.kit.yml",
  "scripts/**",
  "tests/**",
  "AGENTS.md",
  "CLAUDE.md",
  ".claude/skills/**",
  ".github/workflows/hostsmith.yml",
  ".githooks/**",
  "LICENSE",
];

// "dir/**" matches everything under dir/, "*" matches within one path
// segment, and anything else matches itself.
export function matches(pattern, path) {
  if (pattern.endsWith("/**")) return path.startsWith(pattern.slice(0, -2));
  if (!pattern.includes("*")) return path === pattern;
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${source}$`).test(path);
}

// The owner of a repository path. Kit-repository paths come first, since
// some of them sit in kit-owned folders, such as scripts/.
export function ownerOf(path) {
  if (KIT_REPO_ONLY.some((p) => matches(p, path))) return "kit-repo";
  if (path === LOCK_FILE) return "lock";
  if (MERGED.includes(path)) return "merged";
  if (KIT.some((p) => matches(p, path))) return "kit";
  return "site";
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * The lock of a release: its version, each kit-owned file with the SHA-256
 * of its content, and the merged files. Each hash sits in an object of its
 * own, `{ "sha256": ... }`, rather than as the value of its path: secret
 * scanners such as gitleaks read a path like `tokens.css` next to a long hex
 * value as a leaked token.
 * - files: the repository's tracked paths.
 * - read: returns a path's content.
 */
export function kitLock(version, files, read) {
  const kitFiles = {};
  for (const path of [...files].sort()) {
    if (ownerOf(path) === "kit") kitFiles[path] = { sha256: sha256(read(path)) };
  }
  return { version, kitFiles, mergedFiles: [...MERGED] };
}

export function formatLock(lock) {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

// Reads a lock, checking its shape.
export function parseLock(text, source = LOCK_FILE) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source} isn't valid JSON: ${error.message}`);
  }
  const valid =
    typeof lock?.version === "string" &&
    lock.kitFiles !== null &&
    typeof lock.kitFiles === "object" &&
    Object.values(lock.kitFiles).every((file) => /^[0-9a-f]{64}$/.test(file?.sha256)) &&
    Array.isArray(lock.mergedFiles);
  if (!valid) throw new Error(`${source} needs "version", "kitFiles" (each path to { "sha256": ... }) and "mergedFiles".`);
  return lock;
}
