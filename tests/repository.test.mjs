// site-kit-repository: layout, manifest, pinned dependencies, no Hostsmith
// runtime. Every example is a site, so the site checks run for each.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";
import { BASICS, buildFixture, EXAMPLES, PACKAGE, REPO } from "./helpers.mjs";

// Paths every site has, from its example.
const SITE_LAYOUT = [
  "hostsmith.json",
  "package.json",
  "astro.config.mjs",
  "AGENTS.md",
  "CLAUDE.md",
  ".hostsmith/brief.md",
  ".claude/skills/migrate-webflow/SKILL.md",
  "public/admin/config.site.yml",
  "public/admin/config.yml",
  "public/assets",
  "src/content.config.ts",
  "src/site.schema.ts",
  "src/site.config.ts",
  "src/content/pages",
  "src/content/settings/site.yml",
  "src/components/sections/site",
  "src/components/collections",
  "src/styles/global.css",
  "src/styles/site.css",
  "src/styles/theme/README.md",
  "src/styles/theme/tokens/colors.css",
  "src/styles/theme/tokens/type.css",
  "src/styles/theme/tokens/shape.css",
  "src/styles/theme/tokens/space.css",
  "src/styles/theme/presets/colors/navy.css",
  "src/styles/theme/fonts.css",
  "src/styles/theme/base.css",
  "src/styles/theme/layout.css",
  "src/styles/theme/sections.css",
  "src/styles/theme/prose.css",
  ".github/workflows/hostsmith.yml",
];

// Kit code that lives only in the package, never in a site.
const KIT_CODE = ["src/lib", "src/layouts", "src/components/Sections.astro", "src/pages/[...slug].astro", "src/pages/404.astro", "scripts"];

// Paths of the kit repository itself.
const KIT_REPO_LAYOUT = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "package-lock.json",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE",
  "packages/site-kit-astro/package.json",
  "packages/site-kit-astro/LICENSE",
];

const SITE_ALLOWLIST = ["@hostsmith/site-kit-astro", "astro", "tailwindcss", "@tailwindcss/vite", "@astrojs/react", "react", "react-dom"];

const kitPackage = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8"));
const kitAgents = readFileSync(join(PACKAGE, "AGENTS.md"), "utf8");

for (const example of readdirSync(EXAMPLES)) {
  const dir = join(EXAMPLES, example);
  const manifest = JSON.parse(readFileSync(join(dir, "hostsmith.json"), "utf8"));
  const sitePackage = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const { siteConfig } = await import(pathToFileURL(join(dir, "src", "site.config.ts")).href);

  describe(`example ${example}`, () => {
    describe("layout", () => {
      for (const path of SITE_LAYOUT) {
        it(`has ${path}`, () => assert.ok(existsSync(join(dir, path)), `${path} is missing`));
      }

      it("has a detail template per collection", () => {
        for (const name of Object.keys(siteConfig.collections)) {
          assert.ok(existsSync(join(dir, `src/components/collections/${name}.astro`)), `no detail template for ${name}`);
        }
      });

      it("has no copy of the kit's code", async () => {
        for (const path of KIT_CODE) assert.ok(!existsSync(join(dir, path)), `the example has ${path}`);
        const sections = await readdir(join(dir, "src/components/sections"));
        assert.deepEqual(sections, ["site"], "library sections belong in the package");
      });
    });

    describe("hostsmith.json", () => {
      it("has exactly the v0 keys", () => {
        assert.deepEqual(Object.keys(manifest).sort(), ["build", "content", "kit", "media", "site"]);
        assert.deepEqual(manifest.kit, { framework: "astro" }, "the kit's version is the package dependency, not a manifest field");
      });

      it("has an empty site.id", () => {
        assert.equal(manifest.site.id, "", "a site created from the example would deploy to that site");
      });

      it("names paths that exist", () => {
        for (const path of [manifest.content.schema.path, manifest.content.root, manifest.media.dir]) {
          assert.ok(existsSync(join(dir, path)), `${path} from hostsmith.json is missing`);
        }
        assert.equal(manifest.content.schema.source, "decap");
        assert.equal(manifest.media.publicPath, "/assets");
      });
    });

    describe("dependencies", () => {
      const siteDeps = { ...sitePackage.dependencies, ...sitePackage.devDependencies };

      it("are pinned to exact versions", () => {
        for (const [name, version] of Object.entries(siteDeps)) {
          assert.match(version, /^\d+\.\d+\.\d+$/, `${name}@${version} is not an exact version`);
        }
      });

      it("come from the allowlist in the kit's AGENTS.md", () => {
        for (const name of Object.keys(siteDeps)) {
          assert.ok(SITE_ALLOWLIST.includes(name), `${name} is not on the kit's allowlist`);
          assert.ok(kitAgents.includes(`\`${name}\``), `AGENTS.md doesn't list ${name}`);
        }
      });

      it("pin the package at its own version", () => {
        assert.equal(sitePackage.dependencies["@hostsmith/site-kit-astro"], kitPackage.version);
      });
    });
  });
}

describe("kit repository layout", () => {
  for (const path of KIT_REPO_LAYOUT) {
    it(`has ${path}`, () => assert.ok(existsSync(join(REPO, path)), `${path} is missing`));
  }

  it("has the same LICENSE in the package", () => {
    assert.equal(readFileSync(join(PACKAGE, "LICENSE"), "utf8"), readFileSync(join(REPO, "LICENSE"), "utf8"));
  });

  // create-astro writes its own AGENTS.md over the example's unless it gets
  // --no-ai, and the example's is the one that points to the kit's rules.
  it("creates sites in the README with --no-ai", () => {
    const commands = readFileSync(join(REPO, "README.md"), "utf8").match(/^.*npm create astro.*$/gm) ?? [];
    assert.ok(commands.length > 0, "README.md has no npm create astro command");
    for (const command of commands) assert.match(command, / --no-ai\b/, `no --no-ai in: ${command.trim()}`);
  });

  // The bump hook (scripts/set-kit-version.mjs) keeps the README's example
  // commands at the released version, so they name a release that exists.
  it("name the package's version in the README's example commands", async () => {
    const { withReleaseVersion } = await import(pathToFileURL(join(REPO, "scripts", "readme-versions.mjs")).href);
    const readme = readFileSync(join(REPO, "README.md"), "utf8");
    const { version } = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8"));
    assert.equal(withReleaseVersion(readme, version), readme, `the README's example commands don't all name ${version}`);
    const bumped = withReleaseVersion(readme, "9.8.7");
    for (const text of ["examples/basics#v9.8.7", "`v9.8.7` the release", "kit release `9.8.7`", "kit-update/v9.8.7", "@hostsmith/site-kit-astro@9.8.7"]) {
      assert.ok(bumped.includes(text), `a bump doesn't write ${text}`);
    }
    assert.ok(!bumped.includes(version.replace(/^/, "@hostsmith/site-kit-astro@")), "a bump leaves an old version");
    assert.ok(bumped.includes("tailwindcss@4.3.3"), "a bump changes other packages' versions");
  });

  it("give the steps from 0.4 to 0.5 in the README", () => {
    const readme = readFileSync(join(REPO, "README.md"), "utf8");
    const checklist = readme.slice(readme.indexOf("### From 0.4 to 0.5"));
    assert.ok(readme.includes("### From 0.4 to 0.5"), "no checklist");
    for (const step of ["tailwindcss@4.3.3", '"check:styles": "site-kit check-styles"', "Check built styles", "src/styles/tokens.css", "one untitled `links` block", "sk-prose"]) {
      assert.ok(checklist.includes(step), `the checklist misses ${step}`);
    }
  });
});

describe("kit docs", () => {
  const readme = readFileSync(join(REPO, "README.md"), "utf8");
  const agents = readFileSync(join(PACKAGE, "AGENTS.md"), "utf8");
  const hooks = readFileSync(join(PACKAGE, "HOOKS.md"), "utf8");
  const libraryTypes = readdirSync(join(PACKAGE, "src", "components", "sections"))
    .filter((file) => file.endsWith(".astro"))
    .map((file) => file.slice(0, -".astro".length));

  it("name every library section type in the README and AGENTS.md", () => {
    for (const type of libraryTypes) {
      assert.ok(readme.includes(`| \`${type}\` |`), `README.md's section types miss ${type}`);
      assert.ok(agents.includes(`\`${type}\``), `AGENTS.md misses ${type}`);
    }
  });

  // site-kit-themes, "A theme is one folder": the README's tree is the example's.
  it("show the example's style files in the README's theme tree", () => {
    // Each line is a file or a folder/, indented two spaces per level.
    const tree = readme.slice(readme.indexOf("## Themes")).match(/```\n(src\/styles\/[\s\S]*?)```/)[1];
    const folders = [];
    const named = [];
    for (const [, indent, name] of tree.matchAll(/^( *)(\S+)/gm)) {
      folders.length = indent.length / 2;
      if (name.endsWith("/")) folders.push(name);
      else named.push(folders.join("") + name);
    }
    const files = readdirSync(join(BASICS, "src", "styles"), { recursive: true })
      .filter((file) => /\.(css|md)$/.test(file))
      .map((file) => `src/styles/${file.split("\\").join("/")}`);
    assert.deepEqual(named.sort(), files.sort());
  });

  it("name every section type HOOKS.md describes in the README", () => {
    for (const [, block] of hooks.matchAll(/^### ([a-z-]+)$/gm)) {
      assert.ok(libraryTypes.includes(block), `HOOKS.md describes ${block}, which is no library type`);
      assert.ok(readme.includes(`\`${block}\``), `README.md misses ${block}`);
    }
    for (const type of libraryTypes) assert.match(hooks, new RegExp(`^### ${type}$`, "m"), `HOOKS.md has no table for ${type}`);
  });
});

describe("package dependencies", () => {
  it("are pinned to exact versions, apart from the astro peer", () => {
    for (const [name, version] of Object.entries(kitPackage.dependencies)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${name}@${version} is not an exact version`);
    }
    assert.deepEqual(Object.keys(kitPackage.peerDependencies), ["astro"]);
    assert.ok(!kitPackage.dependencies.astro, "astro is a peer dependency, not a dependency");
  });

  // site-kit-sections, "The kit ships no styles": Tailwind is each site's.
  it("include no CSS framework", () => {
    for (const name of Object.keys(kitPackage.dependencies)) assert.doesNotMatch(name, /tailwind|postcss|sass|less|styl/, name);
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
    assert.equal(JSON.parse(readFileSync(join(BASICS, "hostsmith.json"), "utf8")).build.output, "dist");
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
