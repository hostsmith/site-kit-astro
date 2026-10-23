// site-core, "Page copy in adopted sites": pageCopy() from
// @hostsmith/site-kit-astro/copy in the core fixture, whose home and about
// pages read their copy from src/content/copy/ (site-kit-core-split design
// D77).
import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as devalue from "devalue";
import { assertBuilt, buildCoreSite, buildSite, coreSiteCopy, fileHashes, siteKit } from "./helpers.mjs";

const EXPORT = ".hostsmith/schema.json";
const HOME = "src/content/copy/home.yml";

const fails = async (changes, ...patterns) => {
  const build = await buildCoreSite(changes);
  await build.cleanup();
  assert.equal(build.ok, false, "the build passed");
  for (const pattern of patterns) assert.match(build.output, pattern);
};

describe("page copy", () => {
  it("renders each page's copy, bound to its file", async () => {
    const build = await buildCoreSite();
    try {
      assertBuilt(build);
      assert.match(await build.read("index.html"), /<h1 data-field="copy\/home#hero\.title">Fresh bread every morning<\/h1>/);
      assert.match(await build.read("about/index.html"), /<li data-field="copy\/about#bakes\.items\[1\]">Rye, on weekdays<\/li>/);
    } finally {
      await build.cleanup();
    }
  });

  it("shows a changed title on its element", async () => {
    const build = await buildCoreSite({ edit: { [HOME]: (text) => text.replace("title: Fresh bread every morning", "title: Warm bread at seven") } });
    try {
      assertBuilt(build);
      assert.match(await build.read("index.html"), /<h1 data-field="copy\/home#hero\.title">Warm bread at seven<\/h1>/);
    } finally {
      await build.cleanup();
    }
  });

  it("is a files collection in the export, each page with its path and fields", async () => {
    const dir = await coreSiteCopy();
    try {
      const result = await siteKit(dir, ["schema", "--check"]);
      assert.equal(result.code, 0, result.output);
      const { copy } = JSON.parse(await readFile(join(dir, EXPORT), "utf8")).collections;
      assert.equal(copy.type, "files");
      assert.deepEqual(Object.keys(copy.files), ["about", "home", "site"]);
      assert.equal(copy.files.home.path, HOME);
      assert.deepEqual(Object.keys(copy.files.home.fields.properties), ["hero", "latestTitle"]);
      assert.deepEqual(Object.keys(copy.files.about.fields.properties), ["title", "intro", "bakes"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails on a file without a declared page, naming the file", () =>
    fails({ files: { "src/content/copy/team.yml": "title: Our team\n" } }, /src\/content\/copy\/team\.yml: no page "team" is declared in pageCopy\(\)/));

  it("fails on a declared page without a file, naming the page and its path", () =>
    fails({ remove: ["src/content/copy/about.yml"] }, /Page "about" is declared in pageCopy\(\), but src\/content\/copy\/about\.yml doesn't exist/));

  it("fails on a file that breaks its page's schema, naming the file and the field", () =>
    fails({ edit: { [HOME]: (text) => text.replace("  title: Fresh bread every morning\n", "") } }, /src\/content\/copy\/home\.yml: hero\.title: /));

  it("fails in copy.get() when the collection has another name, naming copy", () =>
    fails(
      { edit: { "src/content.config.ts": (text) => text.replace("copy: copy.collection", "pageCopy: copy.collection") }, remove: [EXPORT] },
      /No copy for page "(home|about)"\. Register the collection as "copy"/,
    ));

  it("fails without the core's integration, naming siteKitCore()", () =>
    fails(
      { edit: { "astro.config.mjs": (text) => text.replace("integrations: [siteKitCore()]", "integrations: []") } },
      /pageCopy\(\) needs the core's integration: add siteKitCore\(\)/,
    ));
});

describe("page copy after a kit update", () => {
  // The copy stored in the copy's data store, edited as the build left it.
  async function editStore(dir, change) {
    const file = join(dir, "node_modules", ".astro", "data-store.json");
    const store = devalue.parse(await readFile(file, "utf8"));
    change(store);
    await writeFile(file, devalue.stringify(store));
  }
  const staleTitle = (store) => {
    store.get("copy").get("home").data.hero.title = "Stored title";
  };

  it("is read again from its files when the package's version changes", async () => {
    const dir = await coreSiteCopy();
    try {
      assertBuilt(await buildSite(dir));
      await editStore(dir, (store) => {
        staleTitle(store);
        store.get("meta:copy").set("version", "0.0.0");
      });
      assertBuilt(await buildSite(dir));
      assert.match(await readFile(join(dir, "dist", "index.html"), "utf8"), /Fresh bread every morning/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is kept from the store for an unchanged file on the same version", async () => {
    const dir = await coreSiteCopy();
    try {
      assertBuilt(await buildSite(dir));
      await editStore(dir, staleTitle);
      assertBuilt(await buildSite(dir));
      assert.match(await readFile(join(dir, "dist", "index.html"), "utf8"), /Stored title/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// The core fixture in English and German (site-kit-core-split design D85).
const LOCALES = "core-site-locales";
const localized = (changes = {}) => ({ fixture: LOCALES, ...changes });

describe("page copy with locales", () => {
  it("renders each locale's copy, bound with the locale first", async () => {
    const build = await buildCoreSite(localized());
    try {
      assertBuilt(build);
      assert.match(await build.read("index.html"), /<h1 data-field="copy\/home#en\.hero\.title">Fresh bread every morning<\/h1>/);
      assert.match(await build.read("de/index.html"), /<h1 data-field="copy\/home#de\.hero\.title">Jeden Morgen frisches Brot<\/h1>/);
      assert.match(await build.read("de/news/new-oven/index.html"), /<h1 data-field="news\/de\/new-oven#title">Ein neuer Steinofen<\/h1>/);
    } finally {
      await build.cleanup();
    }
  });

  it("are a folder per locale and one file per page in the export", async () => {
    const dir = await coreSiteCopy(localized());
    try {
      const result = await siteKit(dir, ["schema", "--check"]);
      assert.equal(result.code, 0, result.output);
      const { news, copy } = JSON.parse(await readFile(join(dir, EXPORT), "utf8")).collections;
      const locales = { default: "en", codes: ["en", "de"] };
      assert.deepEqual(news.locales, { ...locales, structure: "multiple_folders" });
      assert.equal(news.path, "src/content/news");
      assert.deepEqual(copy.locales, { ...locales, structure: "single_file" });
      assert.deepEqual(Object.keys(copy.files.home.fields.properties), ["hero"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails on a file without a locale's copy, naming the file and the locale", () =>
    fails(localized({ edit: { [HOME]: (text) => text.split("de:")[0] } }), /src\/content\/copy\/home\.yml: no copy for the locale "de"/));

  it("fails on a key that isn't one of the locales", () =>
    fails(localized({ edit: { [HOME]: (text) => `${text}fr:\n  hero:\n    title: Pain frais\n    text: Du levain.\n` } }), /src\/content\/copy\/home\.yml: "fr" isn't one of the site's locales \(en, de\)/));

  it("fails on a locale's copy that breaks the page's schema, naming the file, the locale and the field", () =>
    fails(localized({ edit: { [HOME]: (text) => text.replace("    title: Jeden Morgen frisches Brot\n", "") } }), /src\/content\/copy\/home\.yml: de\.hero\.title: /));

  it("fails on a locale the site doesn't have, naming its locales", () =>
    fails(
      localized({ edit: { "src/components/HomePage.astro": (text) => text.replace('copy.get("home", locale)', 'copy.get("home", "fr")') } }),
      /copy\.get\("home"\) got the locale "fr"\. The site's locales are en, de/,
    ));

  it("builds byte for byte the same with and without the core, before the site takes page copy", async () => {
    // The site with its copy in its pages, as it is before it adds the core.
    const plain = {
      files: {
        "src/content.config.ts": 'import { defineCollection } from "astro:content";\nimport { glob } from "astro/loaders";\nimport { z } from "astro/zod";\n\nexport const collections = { news: defineCollection({ loader: glob({ pattern: "**/*.md", base: "./src/content/news" }), schema: z.object({ title: z.string(), date: z.string(), summary: z.string() }) }) };\n',
        "src/components/HomePage.astro": '---\nimport BaseLayout from "../layouts/BaseLayout.astro";\n---\n\n<BaseLayout title="Home"><h1>{Astro.currentLocale === "de" ? "Jeden Morgen frisches Brot" : "Fresh bread every morning"}</h1></BaseLayout>\n',
        "src/components/AboutPage.astro": '---\nimport BaseLayout from "../layouts/BaseLayout.astro";\n---\n\n<BaseLayout title="About"><h1>{Astro.currentLocale === "de" ? "Unsere Geschichte" : "Our story"}</h1></BaseLayout>\n',
      },
      remove: ["src/content/copy", EXPORT, "public/admin"],
    };
    const withCore = await buildCoreSite(localized(plain));
    const without = await buildCoreSite(
      localized({ ...plain, edit: { "astro.config.mjs": (text) => text.replace('import siteKitCore from "@hostsmith/site-kit-astro/core";\n', "").replace("  integrations: [siteKitCore()],\n", "") } }),
    );
    try {
      assertBuilt(withCore);
      assertBuilt(without);
      const hashes = await fileHashes(withCore.dist);
      assert.ok("de/index.html" in hashes, "no de/index.html");
      assert.deepEqual(hashes, await fileHashes(without.dist));
    } finally {
      await withCore.cleanup();
      await without.cleanup();
    }
  });
});
