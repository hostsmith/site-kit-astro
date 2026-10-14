// site-kit-repository, "Example content covers the whole kit". Runs only in
// the template repository: a site repo replaces the example content.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { sectionSchemas } from "../src/content.config.ts";
import { buildFixture, htmlFiles, isTemplate } from "./helpers.mjs";

// The nine library section types (site-kit-section-library).
const LIBRARY_TYPES = ["hero", "rich-text", "collection-list", "services-grid", "gallery", "testimonials", "faq", "cta", "hours-location"];

describe("template example content", { skip: !isTemplate() && "not the template repository" }, () => {
  let build;
  let html;
  before(async () => {
    build = await buildFixture(null);
    html = (await Promise.all((await htmlFiles(build.dist)).map((f) => build.read(f)))).join("\n");
  });
  after(() => build.cleanup());

  it("builds as is", () => assert.ok(build.ok, build.output));

  it("renders every library section type", () => {
    assert.deepEqual(Object.keys(sectionSchemas).sort(), [...LIBRARY_TYPES].sort(), "the template registers exactly the library types");
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
