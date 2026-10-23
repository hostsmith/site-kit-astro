// site-core: the core integration, siteKitCore(), in a site with its own
// pages, and in a kit site through siteKit() (site-kit-core-split design D71,
// D83). The core fails a build that isn't static, keeps /admin out of the
// output, and changes nothing else.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assertBuilt, buildCoreSite, buildFixture, CORE_SITE, coreSiteCopy, fileHashes, REPO, siteKit } from "./helpers.mjs";

const STATIC_ONLY = /Hostsmith serves static files only/;

// The core fixture as an Astro site is before it adds the core: its copy
// written in its pages, and no `copy` collection, which needs the core.
const PLAIN_SITE = {
  files: {
    "src/content.config.ts": [
      'import { defineCollection } from "astro:content";',
      'import { glob } from "astro/loaders";',
      'import { z } from "astro/zod";',
      "",
      "const news = defineCollection({",
      '  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),',
      '  schema: z.object({ title: z.string(), date: z.string(), summary: z.string(), category: z.string(), image: z.string().optional(), featured: z.boolean().optional() }),',
      "});",
      "",
      "export const collections = { news };",
      "",
    ].join("\n"),
    "src/layouts/BaseLayout.astro": '---\nconst { title } = Astro.props;\n---\n\n<!doctype html>\n<html lang="en"><head><title>{title} | Corner Bakery</title></head><body><main><slot /></main></body></html>\n',
    "src/pages/index.astro": '---\nimport BaseLayout from "../layouts/BaseLayout.astro";\n---\n\n<BaseLayout title="Home"><h1>Fresh bread every morning</h1></BaseLayout>\n',
    "src/pages/about.astro": '---\nimport BaseLayout from "../layouts/BaseLayout.astro";\n---\n\n<BaseLayout title="About"><h1>Our story</h1></BaseLayout>\n',
  },
  remove: ["src/content/copy", ".hostsmith/schema.json", "public/admin"],
};
const withOutput = (output) => (text) => text.replace("defineConfig({\n", `defineConfig({\n  output: "${output}",\n`);

describe("a core site", () => {
  it("builds without the kit's contract files", async () => {
    for (const file of ["src/site.schema.ts", "src/site.config.ts", "public/admin/config.site.yml"]) {
      assert.equal(existsSync(join(CORE_SITE, file)), false, `the core fixture has ${file}`);
    }
    const build = await buildCoreSite();
    await build.cleanup();
    assertBuilt(build);
  });

  it("builds byte for byte the same with and without the core", async () => {
    const withCore = await buildCoreSite(PLAIN_SITE);
    const without = await buildCoreSite({
      ...PLAIN_SITE,
      edit: {
        "astro.config.mjs": (text) =>
          text.replace('import siteKitCore from "@hostsmith/site-kit-astro/core";\n', "").replace("  integrations: [siteKitCore()],\n", ""),
      },
    });
    try {
      assertBuilt(withCore);
      assertBuilt(without);
      const hashes = await fileHashes(withCore.dist);
      for (const page of ["index.html", "about/index.html", "news/index.html", "news/new-oven/index.html"]) assert.ok(page in hashes, `no ${page}`);
      assert.deepEqual(hashes, await fileHashes(without.dist));
    } finally {
      await withCore.cleanup();
      await without.cleanup();
    }
  });

  it("deploys no admin folder", async () => {
    // The fixture has its generated public/admin/config.yml.
    const build = await buildCoreSite({ files: { "public/admin/index.html": "<!doctype html>\n" } });
    await build.cleanup();
    assertBuilt(build);
    assert.equal(build.exists("admin"), false);
  });

  it("fails with server output, naming output", async () => {
    const build = await buildCoreSite({ edit: { "astro.config.mjs": withOutput("server") } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /sets output to "server"/);
    assert.match(build.output, STATIC_ONLY);
  });

  it("fails on a route rendered on demand, naming it", async () => {
    const build = await buildCoreSite({
      files: { "src/pages/api/contact.ts": 'export const prerender = false;\nexport const POST = () => new Response("ok");\n' },
    });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /src\/pages\/api\/contact\.ts is rendered on demand/);
    assert.match(build.output, STATIC_ONLY);
  });
});

// The manifest with `content.locales`, and the Astro config with `i18n`.
const withLocales = (locales) => (text) => {
  const manifest = JSON.parse(text);
  manifest.content.locales = locales;
  return `${JSON.stringify(manifest, null, 2)}\n`;
};
const withI18n = (i18n) => (text) => text.replace("defineConfig({\n", `defineConfig({\n  i18n: ${i18n},\n`);
const EN_DE = { default: "en", codes: ["en", "de"] };

describe("locales in a core site", () => {
  it("fail when Astro's locales differ, naming both", async () => {
    const build = await buildCoreSite({
      edit: { "hostsmith.json": withLocales(EN_DE), "astro.config.mjs": withI18n('{ defaultLocale: "en", locales: ["en", "fr"] }') },
    });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /content\.locales in hostsmith\.json \(default en, codes en, de\) doesn't match i18n in the Astro config/);
  });

  it("compare an Astro locale object by its path", async () => {
    const build = await buildCoreSite({
      ...PLAIN_SITE,
      edit: {
        "hostsmith.json": withLocales(EN_DE),
        "astro.config.mjs": withI18n('{ defaultLocale: "en", locales: ["en", { path: "de", codes: ["de", "de-DE"] }] }'),
      },
    });
    await build.cleanup();
    assertBuilt(build);
  });

  it("fail on a default that isn't one of the codes", async () => {
    const build = await buildCoreSite({ edit: { "hostsmith.json": withLocales({ default: "fr", codes: ["en", "de"] }) } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /content\.locales in hostsmith\.json has the default "fr", which isn't one of its codes \(en, de\)/);
  });

  it("fail in a kit site's manifest, naming src/site.config.ts", async () => {
    const build = await buildFixture(null, { edit: { "hostsmith.json": withLocales(EN_DE) } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /hostsmith\.json sets content\.locales, but a kit site's locales are in src\/site\.config\.ts/);
  });
});

// The README's section "Core for existing Astro sites", and a code block of
// it by its language, without the list's indent.
const coreSection = () => readFileSync(join(REPO, "README.md"), "utf8").split("\n## Core for existing Astro sites\n")[1].split("\n## ")[0];
const codeBlock = (section, language) => {
  const match = new RegExp("^( *)```" + language + "\\n([\\s\\S]*?)^\\1```$", "m").exec(section);
  assert.ok(match, `no ${language} block`);
  return match[2].replace(new RegExp(`^${match[1]}`, "gm"), "");
};

describe("the README's core section", () => {
  it("wires the core as the core fixture does", () => {
    const config = readFileSync(join(CORE_SITE, "astro.config.mjs"), "utf8").replace(/^\/\/.*\n/gm, "");
    assert.equal(codeBlock(coreSection(), "js"), config);
  });

  it("shows the core fixture's hostsmith.json", () => {
    const manifest = JSON.parse(readFileSync(join(CORE_SITE, "hostsmith.json"), "utf8"));
    assert.deepEqual(JSON.parse(codeBlock(coreSection(), "json")), manifest);
  });

  it("shows the external fixture's content", () => {
    const manifest = JSON.parse(readFileSync(join(REPO, "tests", "fixtures", "external-site", "hostsmith.json"), "utf8"));
    const external = coreSection().split("\n### Content in an external CMS\n")[1];
    assert.deepEqual(JSON.parse(`{${codeBlock(external, "json")}}`).content, manifest.content);
  });

  it("shows the locales fixture's content.locales", () => {
    const manifest = JSON.parse(readFileSync(join(REPO, "tests", "fixtures", "core-site-locales", "hostsmith.json"), "utf8"));
    const locales = coreSection().split("\n### Locales\n")[1];
    assert.deepEqual(JSON.parse(`{${codeBlock(locales, "json")}}`).content.locales, manifest.content.locales);
  });
});

// site-core, "Commands tell core sites from kit sites" (design D72).
describe("kit-only commands in a core site", () => {
  for (const args of [["section-id", "src/content/news/new-oven.md"], ["check-styles"]]) {
    it(`${args[0]} fails, saying that it is for kit sites`, async () => {
      const dir = await coreSiteCopy();
      try {
        const result = await siteKit(dir, args);
        assert.notEqual(result.code, 0);
        assert.match(result.output, new RegExp(`site-kit ${args[0]} is for kit sites, which have src/site\\.schema\\.ts`));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("a kit site", () => {
  it("has the core's static-output check", async () => {
    const build = await buildFixture(null, { edit: { "astro.config.mjs": withOutput("server") } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /sets output to "server"/);
    assert.match(build.output, STATIC_ONLY);
  });
});
