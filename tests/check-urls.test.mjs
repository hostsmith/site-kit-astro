// site-kit-routing, "Webflow URLs are preserved": npm run check:urls.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { servedFile } from "../scripts/check-urls.mjs";
import { buildFixture, ROOT, run } from "./helpers.mjs";

describe("check:urls", () => {
  let build;
  const checkUrls = async (list) => {
    await writeFile(join(build.dir, ".hostsmith", "old-urls.txt"), list);
    return run(process.execPath, [join(ROOT, "scripts", "check-urls.mjs")], { cwd: build.dir });
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
