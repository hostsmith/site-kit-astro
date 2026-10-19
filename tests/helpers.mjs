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
// the failure message.
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSEMBLED, assembleFiles } from "../packages/site-kit-astro/scripts/decap-config.mjs";
import { localeCodes } from "../packages/site-kit-astro/scripts/site-config.mjs";
import { readHooks } from "../packages/site-kit-astro/scripts/hooks-reference.mjs";

// The kit repository, the package and the examples.
export const REPO = fileURLToPath(new URL("..", import.meta.url));
export const PACKAGE = join(REPO, "packages", "site-kit-astro");
export const EXAMPLES = join(REPO, "examples");
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
 * would with `npm run decap-config`, unless the test sets it itself.
 */
export async function buildFixture(fixture, { example = "basics", files = {}, edit = {}, remove = [], env = {} } = {}) {
  const source = join(EXAMPLES, example);
  const dir = await mkdtemp(join(tmpdir(), "site-kit-test-"));
  await cp(source, dir, { recursive: true, filter: (src) => !NOT_COPIED.has(relative(source, src).split(/[\\/]/)[0]) });

  // Each package is linked on its own, so Astro and Vite caches stay per build.
  await mkdir(join(dir, "node_modules"));
  for (const name of await readdir(join(REPO, "node_modules"))) {
    if (!name.startsWith(".")) await symlink(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  }

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
    await writeFile(join(dir, ASSEMBLED), assembleFiles(dir, await localeCodes(dir)));
  }
  for (const path of remove) await rm(join(dir, path));

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

// Fails with the build output when a build that should pass doesn't.
export function assertBuilt(build) {
  if (!build.ok) throw new Error(`Build failed:\n${build.output}`);
}
