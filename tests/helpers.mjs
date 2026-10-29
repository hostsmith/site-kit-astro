// Fixture builds for the kit's self-tests (design D12).
//
// The tests build the `basics` example (examples/basics/) with the package
// from the workspace (site-kit-updates design D25). A fixture is a folder
// under tests/fixtures/ with a `content/` tree, which replaces src/content, an
// optional `assets/` folder, which is copied to public/assets/test/, and a
// `site/` tree with the site code the fixture builds with (site config, site
// schema, collection templates, tokens, the site's Decap part), copied over
// the example's own. buildFixture() builds a temporary copy of the example
// with the fixture and returns the result, so tests can check the output or
// the failure message. A core fixture (tests/fixtures/core-site*/) is a whole
// site of its own, which buildCoreSite() builds.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { EXPORT_FILE } from "../packages/site-kit-astro/scripts/core/schema-export.mjs";
import { ASSEMBLED, assembleFiles } from "../packages/site-kit-astro/scripts/decap-config.mjs";
import { readSiteConfig } from "../packages/site-kit-astro/scripts/site-config.mjs";
import { readHooks } from "../packages/site-kit-astro/scripts/hooks-reference.mjs";

// The kit repository, the package and the examples.
export const REPO = fileURLToPath(new URL("..", import.meta.url));
export const PACKAGE = join(REPO, "packages", "site-kit-astro");
export const EXAMPLES = join(REPO, "examples");
// Each example's folder name. The examples' LICENSE sits beside them.
export const EXAMPLE_NAMES = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(EXAMPLES, entry.name, "package.json")))
  .map((entry) => entry.name)
  .sort();
// The example the fixtures build on.
export const BASICS = join(EXAMPLES, "basics");

const NOT_COPIED = new Set(["node_modules", "dist", ".astro"]);
// Site code that a fixture build leaves out, in favor of the fixture's site/.
const SITE_CODE_FOLDERS = ["src/components/sections/site", "src/components/collections", "src/components/pages"];

/**
 * Builds a copy of an example, `basics` unless `example` names another.
 * - fixture: a folder name under tests/fixtures/, or null to keep the example's content.
 * - files: extra or replaced files, relative to the site root.
 * - edit: functions that rewrite a file, keyed by its path.
 * - remove: files to delete, relative to the site root.
 * - env: extra environment variables for the build.
 * With a fixture, the example's hand-written pages are left out, so the
 * fixture doesn't need their page entries, and the fixture's site code
 * replaces the example's. The Decap config is then assembled again, as a site
 * would with `npm run decap-config`, unless the test sets it itself. The
 * example's schema export, which a fixture or an edit makes stale, is left
 * out unless the test sets it, and the build only warns without it.
 */
export async function buildFixture(fixture, { example = "basics", files = {}, edit = {}, remove = [], env = {} } = {}) {
  const source = join(EXAMPLES, example);
  const dir = await copySite(source, "site-kit-test-");

  if (fixture) {
    const fixtureDir = join(REPO, "tests", "fixtures", fixture);
    await rm(join(dir, "src", "content"), { recursive: true, force: true });
    await cp(join(fixtureDir, "content"), join(dir, "src", "content"), { recursive: true });
    if (existsSync(join(fixtureDir, "assets"))) await cp(join(fixtureDir, "assets"), join(dir, "public", "assets", "test"), { recursive: true });
    await rm(join(dir, "src", "pages"), { recursive: true, force: true });
    for (const folder of SITE_CODE_FOLDERS) {
      await rm(join(dir, folder), { recursive: true, force: true });
      await mkdir(join(dir, folder), { recursive: true });
    }
    await cp(join(fixtureDir, "site"), dir, { recursive: true });
  }

  for (const [path, rewrite] of Object.entries(edit)) {
    await writeFile(join(dir, path), rewrite(await readFile(join(dir, path), "utf8")));
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  if (!Object.hasOwn(files, ASSEMBLED) && !Object.hasOwn(edit, ASSEMBLED)) {
    const siteConfig = await readSiteConfig(dir);
    await writeFile(join(dir, ASSEMBLED), assembleFiles(dir, siteConfig.locales.map((locale) => locale.code), siteConfig.siteVariants));
  }
  if (!Object.hasOwn(files, EXPORT_FILE) && !Object.hasOwn(edit, EXPORT_FILE)) {
    await rm(join(dir, EXPORT_FILE), { force: true });
  }
  for (const path of remove) await rm(join(dir, path));

  return buildSite(dir, env);
}

// The core fixture sites (site-kit-core-split design D83): plain Astro sites
// with their own layout and pages, which use only the kit's core.
export const CORE_SITE = join(REPO, "tests", "fixtures", "core-site");

/**
 * Builds a copy of a core fixture site, `core-site` unless `fixture` names
 * another folder under tests/fixtures/. `files`, `edit`, `remove` and `env`
 * work as in buildFixture().
 */
export async function buildCoreSite({ env = {}, ...changes } = {}) {
  return buildSite(await coreSiteCopy(changes), env);
}

// A copy of a core fixture site with the changes buildCoreSite() takes, not
// built. The caller removes it.
export async function coreSiteCopy({ fixture = "core-site", files = {}, edit = {}, remove = [] } = {}) {
  const dir = await copySite(join(REPO, "tests", "fixtures", fixture), "site-kit-core-");
  for (const [path, rewrite] of Object.entries(edit)) {
    await writeFile(join(dir, path), rewrite(await readFile(join(dir, path), "utf8")));
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  for (const path of remove) await rm(join(dir, path), { recursive: true });
  return dir;
}

// The workspace's `site-kit` command in a site's root.
export function siteKit(dir, args, env = {}) {
  return run(process.execPath, [join(PACKAGE, "bin", "site-kit.mjs"), ...args], { cwd: dir, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1", ...env } });
}

// A temporary copy of a site, with the workspace's packages linked. The
// caller removes it.
export async function copySite(source, prefix = "site-kit-copy-") {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  await cp(source, dir, { recursive: true, filter: (src) => !NOT_COPIED.has(relative(source, src).split(/[\\/]/)[0]) });

  // Each package is linked on its own, so Astro and Vite caches stay per build.
  await mkdir(join(dir, "node_modules"));
  for (const name of await readdir(join(REPO, "node_modules"))) {
    if (!name.startsWith(".")) await symlink(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  }
  return dir;
}

// `astro build` in a site's copy, without SITE_NOINDEX unless `env` sets it.
// The copy keeps Astro's caches between two builds.
export async function buildSite(dir, env = {}) {
  const { SITE_NOINDEX, ...baseEnv } = process.env;
  const result = await run(process.execPath, [join(REPO, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
    cwd: dir,
    env: { ...baseEnv, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1", ...env },
  });

  return {
    dir,
    ok: result.code === 0,
    output: result.output,
    dist: join(dir, "dist"),
    read: (path) => readFile(join(dir, "dist", path), "utf8"),
    exists: (path) => existsSync(join(dir, "dist", path)),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
  });
}

// Every built HTML file, relative to dist/.
export async function htmlFiles(dist) {
  return (await readdir(dist, { recursive: true })).filter((file) => file.endsWith(".html"));
}

// Every file of a build, relative to dist/, by its SHA-256, hashed asset names
// and all.
export async function fileHashes(dist) {
  const hashes = [];
  for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    hashes.push([relative(dist, path), createHash("sha256").update(await readFile(path)).digest("hex")]);
  }
  return Object.fromEntries(hashes.sort(([a], [b]) => a.localeCompare(b)));
}

// The inner HTML of the first element whose opening tag contains `marker`.
// Good enough for the kit's own markup, which never nests the same tag.
export function innerHtml(html, tag, marker) {
  const start = html.indexOf(marker);
  if (start === -1) return undefined;
  const open = html.lastIndexOf(`<${tag}`, start);
  const contentStart = html.indexOf(">", start) + 1;
  const end = html.indexOf(`</${tag}>`, contentStart);
  return open === -1 || end === -1 ? undefined : html.slice(contentStart, end);
}

export function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

// The hooks HOOKS.md lists, deprecated ones included: the `sk-` classes or,
// with `states`, the state attributes. deprecatedHooks() has the deprecated
// ones with their replacements.
export async function documentedHooks({ states = false } = {}) {
  const reference = readHooks(join(PACKAGE, "HOOKS.md"));
  return states ? reference.states : reference.classes;
}

export async function deprecatedHooks() {
  return readHooks(join(PACKAGE, "HOOKS.md")).deprecated;
}

// The whole hook reference, with its base hooks and its groups.
export function hookReference() {
  return readHooks(join(PACKAGE, "HOOKS.md"));
}

// What an example's theme covers, from the "Coverage" table of its
// src/styles/theme/README.md (site-kit-webflow-example design D109): the
// library section types and the parts it supports, and the breakpoint from
// which its header shows its nav, such as "md".
export function themeCoverage(example) {
  const readme = readFileSync(join(EXAMPLES, example, "src", "styles", "theme", "README.md"), "utf8");
  const row = (label) => readme.match(new RegExp(`^\\| ${label} \\| ([^\\n]*) \\|$`, "m"))?.[1];
  const names = (label) => [...(row(label) ?? "").matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
  return { types: names("Section types"), parts: names("Parts"), headerNav: names("Header nav from")[0], found: row("Section types") !== undefined };
}

// Fails with the build output when a build that should pass doesn't.
export function assertBuilt(build) {
  if (!build.ok) throw new Error(`Build failed:\n${build.output}`);
}
