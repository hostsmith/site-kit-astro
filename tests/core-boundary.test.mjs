// site-core, "The core doesn't depend on the kit layer" (site-kit-core-split
// design D69): every module of the core, `core.ts`, `src/core/**` and
// `scripts/core/**`, imports only other core modules, npm packages, Node's
// built-ins and virtual modules, and may read the package's `package.json`.
// Relative imports and the package's own `@hostsmith/site-kit-astro/*` names
// both count. Any other file of the package fails, naming the importer and
// the import.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { PACKAGE } from "./helpers.mjs";

const PACKAGE_NAME = "@hostsmith/site-kit-astro";
const CORE_ENTRY = "core.ts";
const CORE_DIRS = ["src/core", "scripts/core"];

const posix = (path) => path.split(sep).join("/");
const isCore = (path) => path === CORE_ENTRY || path === "package.json" || CORE_DIRS.some((dir) => path.startsWith(`${dir}/`));

// The core's modules, relative to the package.
function coreFiles(pkg) {
  const files = existsSync(join(pkg, CORE_ENTRY)) ? [CORE_ENTRY] : [];
  for (const dir of CORE_DIRS) {
    if (!existsSync(join(pkg, dir))) continue;
    for (const file of readdirSync(join(pkg, dir), { recursive: true })) {
      if (/\.(ts|mjs|js|astro)$/.test(file)) files.push(posix(join(dir, file)));
    }
  }
  return files.sort();
}

// Static and dynamic imports, re-exports, and files loaded by URL.
const SPECIFIERS = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bnew URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g,
];
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

// The package file an import names, relative to the package, or null for an
// npm package, a built-in or a virtual module.
function target(pkg, file, specifier, exportsMap) {
  if (specifier.startsWith(".")) return posix(relative(pkg, resolve(pkg, dirname(file), specifier)));
  if (specifier === PACKAGE_NAME || specifier.startsWith(`${PACKAGE_NAME}/`)) {
    const subpath = `.${specifier.slice(PACKAGE_NAME.length)}`;
    return Object.hasOwn(exportsMap, subpath) ? posix(join(exportsMap[subpath])) : `${subpath} (not exported)`;
  }
  return null;
}

function boundaryProblems(pkg) {
  const exportsMap = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).exports ?? {};
  const problems = [];
  for (const file of coreFiles(pkg)) {
    const text = withoutComments(readFileSync(join(pkg, file), "utf8"));
    for (const pattern of SPECIFIERS) {
      for (const [, specifier] of text.matchAll(pattern)) {
        const path = target(pkg, file, specifier, exportsMap);
        if (path !== null && !isCore(path)) problems.push(`${file} imports "${specifier}" (${path}), which is outside the core`);
      }
    }
  }
  return problems;
}

describe("the core's imports", () => {
  it("cover the core's modules", () => {
    const files = coreFiles(PACKAGE);
    for (const file of ["src/core/field.ts", "src/core/cms-values.ts", "src/core/schema.ts"]) assert.ok(files.includes(file), `${file} isn't checked`);
  });

  it("stay inside the core", () => {
    assert.deepEqual(boundaryProblems(PACKAGE), []);
  });

  it("fail on a core module that imports the kit's settings, naming both", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-boundary-"));
    try {
      await cp(join(PACKAGE, "package.json"), join(dir, "package.json"));
      await cp(join(PACKAGE, "src", "core"), join(dir, "src", "core"), { recursive: true });
      await mkdir(join(dir, "src", "lib"), { recursive: true });
      await writeFile(join(dir, "src", "lib", "settings.ts"), "export const getSettings = () => ({});\n");
      await writeFile(join(dir, "src", "core", "leak.ts"), 'import { getSettings } from "../lib/settings.ts";\nimport "@hostsmith/site-kit-astro/settings";\nexport const leak = getSettings;\n');
      assert.deepEqual(boundaryProblems(dir), [
        'src/core/leak.ts imports "../lib/settings.ts" (src/lib/settings.ts), which is outside the core',
        'src/core/leak.ts imports "@hostsmith/site-kit-astro/settings" (src/lib/settings.ts), which is outside the core',
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
