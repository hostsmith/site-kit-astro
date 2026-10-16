// site-kit-package, "New sites start from an example": every example builds
// as is. site-kit-repository, "Example content covers the whole kit": the
// `basics` example's content.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { defineKitContent } from "../packages/site-kit-astro/src/kit-content.ts";
import { siteConfig } from "../examples/basics/src/site.config.ts";
import * as siteSchema from "../examples/basics/src/site.schema.ts";
import { buildFixture, EXAMPLES, htmlFiles } from "./helpers.mjs";

// The nine library section types (site-kit-section-library).
const LIBRARY_TYPES = ["hero", "rich-text", "collection-list", "services-grid", "gallery", "testimonials", "faq", "cta", "hours-location"];
const { sectionSchemas } = defineKitContent(siteConfig, siteSchema);

describe("examples", () => {
  for (const example of readdirSync(EXAMPLES)) {
    it(`${example} builds as is`, async () => {
      const build = await buildFixture(null, { example });
      await build.cleanup();
      assert.ok(build.ok, build.output);
    });
  }
});

describe("basics example content", () => {
  let build;
  let html;
  before(async () => {
    build = await buildFixture(null);
    html = (await Promise.all((await htmlFiles(build.dist)).map((f) => build.read(f)))).join("\n");
  });
  after(() => build.cleanup());

  it("renders every library section type", () => {
    assert.ok(build.ok, build.output);
    assert.deepEqual(Object.keys(sectionSchemas).sort(), [...LIBRARY_TYPES].sort(), "the example registers exactly the library types");
    for (const type of LIBRARY_TYPES) assert.ok(html.includes(`data-section="${type}"`), `no ${type} section`);
  });

  it("renders every hero variant", () => {
    assert.match(html, /md:order-2/);
    assert.match(html, /md:grid-cols-2/);
    assert.match(html, /absolute inset-0 h-full w-full object-cover/);
    assert.match(html, /max-w-3xl text-center/);
  });

  it("has the news list, a custom page and the 404 page", () => {
    assert.ok(build.exists("news/index.html"));
    assert.ok(build.exists("about/index.html"));
    assert.ok(build.exists("404.html"));
    assert.equal(build.exists("news/winter-menu/index.html"), false);
  });
});
