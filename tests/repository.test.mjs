// site-kit-repository: layout, manifest, pinned dependencies, no Hostsmith runtime.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { buildFixture, ROOT } from "./helpers.mjs";

const LAYOUT = [
  "hostsmith.json",
  "AGENTS.md",
  "CLAUDE.md",
  ".hostsmith/brief.md",
  ".claude/skills/migrate-webflow/SKILL.md",
  "public/admin/config.yml",
  "public/assets",
  "src/content.config.ts",
  "src/content/pages",
  "src/content/settings/site.yml",
  "src/components/sections",
  "src/components/sections/site",
  "src/components/collections",
  "src/lib/field.ts",
  "src/styles/tokens.css",
  "src/site.config.ts",
  "src/pages/[...slug].astro",
  ".github/workflows/hostsmith.yml",
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE",
];

const ALLOWLIST = ["astro", "@astrojs/markdown-satteri", "tailwindcss", "@tailwindcss/vite", "@hostsmith/sdk", "@astrojs/react", "react", "react-dom"];

const manifest = JSON.parse(readFileSync(join(ROOT, "hostsmith.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("repository layout", () => {
  for (const path of LAYOUT) {
    it(`has ${path}`, () => assert.ok(existsSync(join(ROOT, path)), `${path} is missing`));
  }

  it("has a page file and a detail template per collection", () => {
    assert.ok(existsSync(join(ROOT, "src/content/pages")));
    assert.ok(existsSync(join(ROOT, "src/components/collections/news.astro")));
  });
});

describe("hostsmith.json", () => {
  it("has exactly the v0 keys", () => {
    assert.deepEqual(Object.keys(manifest).sort(), ["build", "content", "kit", "media", "site"]);
    assert.equal(manifest.kit.framework, "astro");
    assert.match(manifest.kit.version, /^\d+\.\d+\.\d+/);
  });

  it("names paths that exist", () => {
    for (const path of [manifest.content.schema.path, manifest.content.root, manifest.media.dir]) {
      assert.ok(existsSync(join(ROOT, path)), `${path} from hostsmith.json is missing`);
    }
    assert.equal(manifest.content.schema.source, "decap");
    assert.equal(manifest.media.publicPath, "/assets");
  });
});

describe("dependencies", () => {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  it("are pinned to exact versions", () => {
    for (const [name, version] of Object.entries(deps)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${name}@${version} is not an exact version`);
    }
    assert.ok(existsSync(join(ROOT, "package-lock.json")), "package-lock.json is missing");
  });

  it("come from the allowlist in AGENTS.md", () => {
    const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
    for (const name of Object.keys(deps)) {
      assert.ok(ALLOWLIST.includes(name), `${name} is not on the kit's allowlist`);
      assert.ok(agents.includes(`\`${name}\``), `AGENTS.md doesn't list ${name}`);
    }
  });
});

describe("build output", () => {
  let build;
  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  it("is written to build.output", () => {
    assert.ok(build.ok, build.output);
    assert.equal(manifest.build.output, "dist");
    assert.ok(build.exists("index.html"));
  });

  it("contains no hostsmith.json", async () => {
    const files = await readdir(build.dist, { recursive: true });
    assert.deepEqual(files.filter((file) => file.endsWith("hostsmith.json")), []);
  });

  it("contains no admin/ folder", () => {
    assert.equal(build.exists("admin"), false);
  });

  it("loads nothing from a Hostsmith host", async () => {
    const files = (await readdir(build.dist, { recursive: true })).filter((file) => /\.(html|css|js)$/.test(file));
    for (const file of files) {
      const text = await build.read(file);
      assert.doesNotMatch(text, /(src|href)=["']?https?:\/\/[^"'\s>]*hostsmith/i, `${file} references a Hostsmith host`);
      assert.doesNotMatch(text, /url\(["']?https?:\/\/[^)]*hostsmith/i, `${file} references a Hostsmith host`);
    }
  });
});
