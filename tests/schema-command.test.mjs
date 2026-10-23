// site-core, "The schema export": `site-kit schema [--check]` in the core
// fixture and in the `basics` example (site-kit-core-split design D74, D75).
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { assertBuilt, BASICS, buildCoreSite, buildFixture, copySite, coreSiteCopy, siteKit } from "./helpers.mjs";

const EXPORT = ".hostsmith/schema.json";

describe("site-kit schema in a core site", () => {
  let dir;
  let text;
  before(async () => {
    dir = await coreSiteCopy();
    const result = await siteKit(dir, ["schema"]);
    assert.equal(result.code, 0, result.output);
    text = await readFile(join(dir, EXPORT), "utf8");
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("writes the export with kind core and news as a Markdown folder in one language", () => {
    const schema = JSON.parse(text);
    assert.equal(schema.kind, "core");
    const { news } = schema.collections;
    assert.equal(news.type, "folder");
    assert.equal(news.path, "src/content/news");
    assert.equal(news.format, "markdown");
    assert.equal(news.locales, null);
    assert.deepEqual(Object.keys(news.fields.properties), ["title", "date", "summary", "category", "image", "featured"]);
    assert.equal(news.fields.properties.image["x-widget"], "image");
    assert.equal(news.fields.properties.category["x-widget"], "select");
  });

  it("writes the same bytes on a second run, and passes --check", async () => {
    const again = await siteKit(dir, ["schema"]);
    assert.equal(again.code, 0, again.output);
    assert.equal(await readFile(join(dir, EXPORT), "utf8"), text);
    const check = await siteKit(dir, ["schema", "--check"]);
    assert.equal(check.code, 0, check.output);
    assert.match(check.output, /\.hostsmith\/schema\.json is up to date/);
  });

  it("fails --check on a stale file, naming site-kit schema", async () => {
    const stale = await coreSiteCopy({ files: { [EXPORT]: text.replace('"summary"', '"teaser"') } });
    try {
      const check = await siteKit(stale, ["schema", "--check"]);
      assert.notEqual(check.code, 0);
      assert.match(check.output, /\.hostsmith\/schema\.json doesn't match the site's collections\. Run site-kit schema/);
    } finally {
      await rm(stale, { recursive: true, force: true });
    }
  });

  it("fails --check without the file", async () => {
    const check = await siteKit(await keep(coreSiteCopy({ remove: [EXPORT] })), ["schema", "--check"]);
    assert.notEqual(check.code, 0);
    assert.match(check.output, /\.hostsmith\/schema\.json is missing\. Run site-kit schema/);
  });

  it("fails without hostsmith.json, naming it", async () => {
    const result = await siteKit(await keep(coreSiteCopy({ remove: ["hostsmith.json"] })), ["schema"]);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /Missing hostsmith\.json/);
  });
});

// Copies removed after the suite.
const copies = [];
async function keep(copy) {
  copies.push(await copy);
  return copies.at(-1);
}
after(() => Promise.all(copies.map((copy) => rm(copy, { recursive: true, force: true }))));

describe("site-kit schema in a kit site", () => {
  let schema;
  before(async () => {
    const dir = await keep(copySite(BASICS));
    const result = await siteKit(dir, ["schema"]);
    assert.equal(result.code, 0, result.output);
    schema = JSON.parse(await readFile(join(dir, EXPORT), "utf8"));
  });

  it("has kind kit and the kit's collections with the site's, each with its locales", () => {
    assert.equal(schema.kind, "kit");
    assert.deepEqual(Object.keys(schema.collections), ["news", "pages", "settings"]);
    for (const collection of Object.values(schema.collections)) {
      assert.deepEqual(collection.locales, { default: "en", codes: ["en"], structure: "multiple_files" });
    }
    assert.equal(schema.collections.pages.pattern, "**/*.md");
    assert.equal(schema.collections.settings.format, "yaml");
  });

  it("lists every section type with its fields and hints", () => {
    assert.ok(schema.collections.pages.fields.properties.sections.items.oneOf.length > 1);
  });

  it("keeps the hints inside a section", () => {
    const types = schema.collections.pages.fields.properties.sections.items.oneOf;
    const hero = types.find((type) => type.properties.type.const === "hero");
    assert.equal(hero.properties.image["x-widget"], "image");
    assert.equal(hero.properties.cta.properties.link["x-widget"], "link");
  });
});

// A site copy's fresh export, from `site-kit schema`.
async function freshExport(dir) {
  const result = await siteKit(dir, ["schema"]);
  assert.equal(result.code, 0, result.output);
  return readFile(join(dir, EXPORT), "utf8");
}

describe("the build's export check", () => {
  const addField = (marker) => (text) => text.replace(marker, `${marker}\n        teaser: z.string().optional(),`);

  it("passes a core site with a fresh export, and fails one whose schema changed, naming site-kit schema", async () => {
    const text = await freshExport(await keep(coreSiteCopy()));
    const fresh = await buildCoreSite({ files: { [EXPORT]: text } });
    const stale = await buildCoreSite({ files: { [EXPORT]: text }, edit: { "src/content.config.ts": addField('category: z.enum(["Bakery", "Events"]),') } });
    await fresh.cleanup();
    await stale.cleanup();
    assertBuilt(fresh);
    assert.equal(stale.ok, false);
    assert.match(stale.output, /\.hostsmith\/schema\.json doesn't match the site's collections\. Run site-kit schema/);
  });

  it("passes a kit site with a fresh export, and fails one whose schema changed, naming site-kit schema", async () => {
    const text = await freshExport(await keep(copySite(BASICS)));
    const fresh = await buildFixture(null, { files: { [EXPORT]: text } });
    const stale = await buildFixture(null, { files: { [EXPORT]: text }, edit: { "src/site.schema.ts": addField("title: z.string().min(1),") } });
    await fresh.cleanup();
    await stale.cleanup();
    assertBuilt(fresh);
    assert.equal(stale.ok, false);
    assert.match(stale.output, /\.hostsmith\/schema\.json doesn't match the site's collections\. Run site-kit schema/);
  });

  it("only warns without the export, naming site-kit schema", async () => {
    const build = await buildFixture(null);
    await build.cleanup();
    assertBuilt(build);
    assert.match(build.output, /\.hostsmith\/schema\.json is missing\. Run site-kit schema/);
  });
});
