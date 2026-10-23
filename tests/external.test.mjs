// site-core, "Content in the repo or in an external CMS": content.source in
// hostsmith.json, the external fixture, and a repo site's collection from
// elsewhere (site-kit-core-split design D86).
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { parse } from "yaml";
import { assertBuilt, buildCoreSite, buildFixture, buildSite, CORE_SITE, coreSiteCopy, siteKit } from "./helpers.mjs";

const EXTERNAL = { fixture: "external-site" };
const EXPORT = ".hostsmith/schema.json";
const NAMES_SOURCE = /content\.source in hostsmith\.json is "external": the site's content lives in its CMS/;
const withContent = (change) => (text) => {
  const manifest = JSON.parse(text);
  manifest.content = change(manifest.content);
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

describe("an external site", () => {
  const copies = [];
  after(() => Promise.all(copies.map((dir) => rm(dir, { recursive: true, force: true }))));
  const copy = async (changes = {}) => {
    const dir = await coreSiteCopy({ ...EXTERNAL, ...changes });
    copies.push(dir);
    return dir;
  };

  it("builds its CMS's content, with no schema export and no warning about one", async () => {
    const dir = await copy();
    const build = await buildSite(dir);
    assertBuilt(build);
    assert.match(await build.read("index.html"), /<h2>New opening hours<\/h2>/);
    assert.doesNotMatch(build.output, /schema\.json|config\.yml/);
    assert.equal(build.exists("admin"), false);
  });

  for (const args of [["schema"], ["schema", "--check"], ["decap-config"], ["decap-config", "--check"]]) {
    it(`writes nothing for site-kit ${args.join(" ")}, exits 0 and names content.source`, async () => {
      const dir = await copy();
      const result = await siteKit(dir, args);
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, NAMES_SOURCE);
      assert.equal(existsSync(join(dir, EXPORT)), false);
      assert.equal(existsSync(join(dir, "public", "admin", "config.yml")), false);
    });
  }

  it("reports its text coverage, and doesn't gate on --min", async () => {
    const dir = await copy();
    assertBuilt(await buildSite(dir));
    const result = await siteKit(dir, ["check-fields", "--min", "90"]);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Field coverage: 0% of \d+ characters/);
    assert.match(result.output, /--min doesn't apply/);
  });

  it("still fails on server output", async () => {
    const build = await buildCoreSite({ ...EXTERNAL, edit: { "astro.config.mjs": (text) => text.replace("defineConfig({\n", 'defineConfig({\n  output: "server",\n') } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /Hostsmith serves static files only/);
  });

  it("fails on another key under content, naming it", async () => {
    const build = await buildCoreSite({ ...EXTERNAL, edit: { "hostsmith.json": withContent((content) => ({ ...content, root: "src/content" })) } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /content\.source to "external", so its content holds only "source" and "provider", not "root"/);
  });
});

describe("content.source", () => {
  it("means repo when it is absent, so the build checks the export", async () => {
    const build = await buildCoreSite({ remove: [EXPORT] });
    await build.cleanup();
    assertBuilt(build);
    assert.match(build.output, /\.hostsmith\/schema\.json is missing\. Run site-kit schema/);
  });

  it("fails on a value it doesn't know, naming it", async () => {
    const build = await buildCoreSite({ edit: { "hostsmith.json": withContent((content) => ({ ...content, source: "cms" })) } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /hostsmith\.json sets content\.source to "cms"\. It is "repo", the default, or "external"/);
  });

  it("fails in a kit site set to external, naming it", async () => {
    const build = await buildFixture(null, { edit: { "hostsmith.json": withContent(() => ({ source: "external" })) } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /hostsmith\.json sets content\.source to "external", but a kit site's content is in its repository/);
  });
});

describe("a repo site's collection from elsewhere", () => {
  const read = (file) => readFileSync(join(CORE_SITE, file), "utf8");

  it("is in the export as not editable, with its fields and no location", () => {
    const { events, news } = JSON.parse(read(EXPORT)).collections;
    assert.deepEqual(Object.keys(events), ["editable", "fields"]);
    assert.equal(events.editable, false);
    assert.deepEqual(Object.keys(events.fields.properties), ["id", "title", "date"]);
    assert.equal(news.editable, true);
  });

  it("has no Decap collection", () => {
    assert.deepEqual(parse(read("public/admin/config.yml")).collections.map((c) => c.name).sort(), ["copy", "news"]);
  });
});
