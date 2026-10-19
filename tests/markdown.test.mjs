// site-kit-section-library, "Markdown body"; design D5.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, innerHtml } from "./helpers.mjs";

describe("markdown props", () => {
  let build;
  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  it("render the same HTML as an entry body", async () => {
    assert.ok(build.ok, build.output);
    // The fixture's home rich-text body and the fresh-rye entry body are the same markdown.
    const section = innerHtml(await build.read("index.html"), "div", 'data-field="pages/home.en#sections[r4t8].body"');
    const entry = innerHtml(await build.read("news/fresh-rye/index.html"), "div", 'data-field="news/fresh-rye.en#body"');
    assert.ok(section && entry, "a markdown block is missing");
    assert.match(section, /<h2[^>]*>Our breads<\/h2>/);
    assert.match(section, /<ul>/);
    assert.match(section, /<table>/);
    assert.equal(section.trim(), entry.trim());
  });

  it("reject a level-1 heading", async () => {
    const result = await buildFixture("base", {
      files: { "src/content/pages/about.en.md": "---\ntitle: About\nsections:\n  - { id: a1b2, type: rich-text, body: '# Big title' }\n---\n" },
    });
    await result.cleanup();
    assert.equal(result.ok, false);
    assert.match(result.output, /pages\/about\.en section "a1b2" \(rich-text\) body: the markdown heading "# Big title" is a page title/);
  });
});
