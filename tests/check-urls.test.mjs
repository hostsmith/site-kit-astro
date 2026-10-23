// site-kit-routing, "Webflow URLs are preserved": npm run check:urls.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { servedFile } from "../packages/site-kit-astro/scripts/core/check-urls.mjs";
import { buildCoreSite, buildFixture, PACKAGE, run } from "./helpers.mjs";

describe("check:urls", () => {
  let build;
  const checkUrls = async (list) => {
    await writeFile(join(build.dir, ".hostsmith", "old-urls.txt"), list);
    return run(process.execPath, [join(PACKAGE, "bin", "site-kit.mjs"), "check-urls"], { cwd: build.dir });
  };

  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  it("passes when every old URL has a page", async () => {
    assert.ok(build.ok, build.output);
    const result = await checkUrls("# old site\n/\n/about\n/services/plumbing\n/news/fresh-rye\n");
    assert.equal(result.code, 0, result.output);
  });

  it("fails and names a lost page", async () => {
    const result = await checkUrls("/about\n/team\n");
    assert.equal(result.code, 1);
    assert.match(result.output, /\/team: no page in the build output/);
    assert.doesNotMatch(result.output, /\/about:/);
  });

  it("maps paths the way Hostsmith serves them", () => {
    assert.equal(servedFile(build.dist, "/"), "index.html");
    assert.equal(servedFile(build.dist, "/about"), "about/index.html");
    assert.equal(servedFile(build.dist, "/about/"), "about/index.html");
    assert.equal(servedFile(build.dist, "/sitemap.xml"), "sitemap.xml");
    assert.equal(servedFile(build.dist, "/about.html"), undefined);
  });
});

// site-core, "The URL check finds what Hostsmith serves": a site built with
// build.format "file" (site-kit-core-split design D81).
describe("check:urls with flat HTML files", () => {
  let dist;
  before(async () => {
    dist = await mkdtemp(join(tmpdir(), "site-kit-flat-"));
    for (const file of ["index.html", "about.html", "contact.htm", "team/index.html"]) {
      await mkdir(dirname(join(dist, file)), { recursive: true });
      await writeFile(join(dist, file), "<!doctype html>\n");
    }
  });
  after(() => rm(dist, { recursive: true, force: true }));

  it("finds <path>.html and <path>.htm, after the folder's index", () => {
    assert.equal(servedFile(dist, "/about"), "about.html");
    assert.equal(servedFile(dist, "/contact"), "contact.htm");
    assert.equal(servedFile(dist, "/team"), "team/index.html");
  });

  it("doesn't add an extension to a path that has one, or to a folder's path", () => {
    assert.equal(servedFile(dist, "/about.html"), "about.html");
    assert.equal(servedFile(dist, "/about/"), undefined);
  });

  it("passes a core site built with build.format file", async () => {
    const build = await buildCoreSite({
      edit: { "astro.config.mjs": (text) => text.replace("defineConfig({\n", 'defineConfig({\n  build: { format: "file" },\n') },
      files: { ".hostsmith/old-urls.txt": "/\n/about\n/news\n/news/new-oven\n" },
    });
    try {
      assert.ok(build.ok, build.output);
      assert.ok(build.exists("about.html"), "the build has no about.html");
      const result = await run(process.execPath, [join(PACKAGE, "bin", "site-kit.mjs"), "check-urls"], { cwd: build.dir });
      assert.equal(result.code, 0, result.output);
    } finally {
      await build.cleanup();
    }
  });
});
