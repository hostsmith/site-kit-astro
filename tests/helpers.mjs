// Fixture builds for the kit's self-tests (design D12).
//
// A fixture is a folder under tests/fixtures/ with a `content/` tree, which
// replaces src/content, and an optional `assets/` folder, which is copied to
// public/assets/test/. buildFixture() builds a temporary copy of the repo with
// the fixture and returns the result, so tests can check the output or the
// failure message. Fixtures use only library section types.
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

const NOT_COPIED = new Set(["node_modules", "dist", ".astro", ".git", "tests"]);
const KIT_PAGES = new Set(["[...slug].astro", "404.astro"]);

// True in the template repository itself; a site repo sets `site.id`.
export function isTemplate() {
  return JSON.parse(readFileSync(join(ROOT, "hostsmith.json"), "utf8")).site.id === "";
}

/**
 * Builds a copy of the repo.
 * - fixture: a folder name under tests/fixtures/, or null to keep the repo's content.
 * - files: extra or replaced files, relative to the repo root.
 * - edit: functions that rewrite a file, keyed by its path.
 * - env: extra environment variables for the build.
 * With a fixture, the repo's hand-written pages are left out, so the fixture
 * doesn't need their page entries.
 */
export async function buildFixture(fixture, { files = {}, edit = {}, env = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "site-kit-test-"));
  await cp(ROOT, dir, { recursive: true, filter: (src) => !NOT_COPIED.has(relative(ROOT, src).split(/[\\/]/)[0]) });

  // Each package is linked on its own, so Astro and Vite caches stay per build.
  await mkdir(join(dir, "node_modules"));
  for (const name of await readdir(join(ROOT, "node_modules"))) {
    if (!name.startsWith(".")) await symlink(join(ROOT, "node_modules", name), join(dir, "node_modules", name));
  }

  if (fixture) {
    const source = join(ROOT, "tests", "fixtures", fixture);
    await rm(join(dir, "src", "content"), { recursive: true, force: true });
    await cp(join(source, "content"), join(dir, "src", "content"), { recursive: true });
    if (existsSync(join(source, "assets"))) await cp(join(source, "assets"), join(dir, "public", "assets", "test"), { recursive: true });
    for (const file of await readdir(join(dir, "src", "pages"), { recursive: true })) {
      if (file.endsWith(".astro") && !KIT_PAGES.has(file)) await rm(join(dir, "src", "pages", file));
    }
  }

  for (const [path, rewrite] of Object.entries(edit)) {
    await writeFile(join(dir, path), rewrite(await readFile(join(dir, path), "utf8")));
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), content);
  }

  const { SITE_NOINDEX, ...baseEnv } = process.env;
  const result = await run(process.execPath, [join(ROOT, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
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

// Fails with the build output when a build that should pass doesn't.
export function assertBuilt(build) {
  if (!build.ok) throw new Error(`Build failed:\n${build.output}`);
}
