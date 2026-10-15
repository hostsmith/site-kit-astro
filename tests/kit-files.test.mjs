// site-kit-updates, "Every path has one owner" and "The lock records the installed release".
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { KIT, KIT_REPO_ONLY, kitLock, LOCK_FILE, matches, MERGED, ownerOf, parseLock, sha256 } from "../scripts/kit-files.mjs";
import { isTemplate, ROOT } from "./helpers.mjs";

const NOT_WALKED = new Set(["node_modules", "dist", ".astro", ".git"]);

// Every file in the repository, relative to its root.
function walk(dir = "") {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (NOT_WALKED.has(path)) return [];
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = walk();

describe("path ownership", () => {
  it("gives every file at most one owner list, apart from kit-repository files", () => {
    for (const path of files) {
      if (KIT_REPO_ONLY.some((p) => matches(p, path))) continue;
      const lists = [MERGED.includes(path) && "merged", path === LOCK_FILE && "lock", KIT.some((p) => matches(p, path)) && "kit"].filter(Boolean);
      assert.ok(lists.length <= 1, `${path} is in ${lists.join(" and ")}`);
    }
  });

  it("names only paths that exist", { skip: !isTemplate() && "not the template repository" }, () => {
    for (const pattern of [...KIT_REPO_ONLY, ...MERGED, ...KIT]) {
      assert.ok(files.some((path) => matches(pattern, path)), `${pattern} matches no file`);
    }
  });

  it("is by file, not by folder", () => {
    assert.equal(ownerOf("src/pages/about.astro"), "site");
    assert.equal(ownerOf("src/pages/menu.astro"), "site");
    assert.equal(ownerOf("src/pages/[...slug].astro"), "kit");
    assert.equal(ownerOf("src/components/sections/hero.astro"), "kit");
    assert.equal(ownerOf("src/components/sections/site/menu-board.astro"), "site");
    assert.equal(ownerOf("public/admin/config.kit.yml"), "kit");
    assert.equal(ownerOf("public/admin/config.site.yml"), "site");
    assert.equal(ownerOf("public/admin/config.yml"), "merged");
    assert.equal(ownerOf("scripts/decap-config.mjs"), "kit");
    assert.equal(ownerOf("scripts/set-kit-version.mjs"), "kit-repo");
    assert.equal(ownerOf(LOCK_FILE), "lock");
  });

  it("leaves the site's content, code and media to the site", () => {
    for (const path of [
      "src/content/pages/home.md",
      "src/site.config.ts",
      "src/site.schema.ts",
      "src/styles/tokens.css",
      "src/components/collections/news.astro",
      "public/assets/images/hero-loaves.svg",
      ".hostsmith/brief.md",
      "README.md",
    ]) {
      assert.equal(ownerOf(path), "site", path);
    }
  });
});

describe("kit.lock.json", () => {
  const lock = parseLock(readFileSync(join(ROOT, LOCK_FILE), "utf8"));

  it("names the installed kit version and the merged files", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "hostsmith.json"), "utf8"));
    assert.equal(lock.version, manifest.kit.version);
    assert.deepEqual(lock.mergedFiles, MERGED);
  });

  it("lists only kit-owned files", () => {
    for (const path of Object.keys(lock.kitFiles)) assert.equal(ownerOf(path), "kit", path);
  });

  it("never puts a hash on its path's line, where secret scanners flag it", () => {
    const text = readFileSync(join(ROOT, LOCK_FILE), "utf8");
    for (const line of text.split("\n")) {
      if (/[0-9a-f]{64}/.test(line)) assert.match(line, /^\s*"sha256": "[0-9a-f]{64}"$/);
    }
  });
});

describe("kitLock()", () => {
  it("hashes each kit-owned file and skips the others", () => {
    const content = { "src/lib/field.ts": "export {};\n", "src/content/pages/home.md": "---\n---\n", "cog.toml": "", "hostsmith.json": "{}" };
    const lock = kitLock("1.2.3", Object.keys(content), (path) => content[path]);
    assert.deepEqual(lock, { version: "1.2.3", kitFiles: { "src/lib/field.ts": { sha256: sha256("export {};\n") } }, mergedFiles: MERGED });
  });
});
