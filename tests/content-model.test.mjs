// site-kit-content-model: page shape, sections, ids, settings, collections, drafts.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture } from "./helpers.mjs";

const HOME = "src/content/pages/home.md";

// A home page with the given section YAML (list items at two spaces).
const homeWith = (sections, extra = "") => `---\ntitle: Home\n${extra}sections:\n${sections}---\n`;

async function expectFailure(files, ...expected) {
  const build = await buildFixture("base", { files });
  try {
    assert.equal(build.ok, false, "the build should fail");
    for (const text of expected) assert.ok(build.output.includes(text), `output doesn't mention ${JSON.stringify(text)}:\n${build.output}`);
  } finally {
    await build.cleanup();
  }
}

describe("valid content", () => {
  let build;
  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  it("builds and renders sections in list order", async () => {
    assert.ok(build.ok, build.output);
    const html = await build.read("index.html");
    const order = ["hero", "rich-text", "collection-list"].map((type) => html.indexOf(`data-section="${type}"`));
    assert.ok(order.every((i) => i > -1), "a section is missing");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("serves entry ids as paths", () => {
    for (const path of ["index.html", "about/index.html", "services/plumbing/index.html", "news/fresh-rye/index.html"]) {
      assert.ok(build.exists(path), `${path} is missing`);
    }
  });

  it("drops draft entries everywhere", async () => {
    assert.equal(build.exists("news/secret-draft/index.html"), false);
    for (const file of ["index.html", "news/index.html", "sitemap.xml"]) {
      const text = await build.read(file);
      assert.ok(!text.includes("secret-draft") && !text.includes("Secret draft"), `${file} mentions the draft`);
    }
  });
});

describe("invalid pages fail the build", () => {
  it("names a duplicate section id", () =>
    expectFailure(
      { [HOME]: homeWith("  - { id: s7k2, type: hero, title: One }\n  - { id: s7k2, type: hero, title: Two }\n") },
      "home.md",
      'duplicate section id "s7k2"',
    ));

  for (const id of ["hero1", "abcd", "1abc"]) {
    it(`names the invalid id ${id}`, () =>
      expectFailure({ [HOME]: homeWith(`  - { id: "${id}", type: hero, title: One }\n`) }, "home.md", `invalid section id "${id}"`));
  }

  it("names an unknown frontmatter key", () =>
    expectFailure({ [HOME]: homeWith("  - { id: s7k2, type: hero, title: One }\n", "subtitle: Nope\n") }, "home.md", 'unknown frontmatter key "subtitle"'));

  it("names an unknown section type", () =>
    expectFailure({ [HOME]: homeWith("  - { id: s7k2, type: pricing-table, title: One }\n") }, "home.md", 'unknown section type "pricing-table"'));

  it("names the section and a missing required prop", () =>
    expectFailure({ [HOME]: homeWith("  - { id: s7k2, type: hero }\n") }, "home.md", 'section "s7k2" (hero): missing required prop "title"'));

  it("rejects nested sections", () =>
    expectFailure(
      { [HOME]: homeWith("  - id: s7k2\n    type: rich-text\n    body: Hi\n    sections:\n      - { id: q1m9, type: hero, title: Inner }\n") },
      "home.md",
      'unknown prop "sections"',
    ));

  it("names an image without alt text", () =>
    expectFailure(
      { [HOME]: homeWith("  - { id: s7k2, type: hero, title: One, image: /assets/test/photo.svg }\n") },
      "home.md",
      'section "s7k2" (hero): image "/assets/test/photo.svg" has no alt text',
    ));

  it("names a missing media file", () =>
    expectFailure(
      { [HOME]: homeWith("  - { id: s7k2, type: hero, title: One, image: /assets/test/nope.jpg, imageAlt: Nope }\n") },
      "home.md",
      "media file public/assets/test/nope.jpg doesn't exist",
    ));

  it("rejects internal links with a trailing slash", () =>
    expectFailure(
      { [HOME]: homeWith("  - { id: s7k2, type: hero, title: One, cta: { label: Go, link: /about/ } }\n") },
      "home.md",
      'link "/about/" ends with "/"',
    ));

  it("rejects a page body", () =>
    expectFailure({ [HOME]: `${homeWith("  - { id: s7k2, type: hero, title: One }\n")}\nSome text.\n` }, "src/content/pages/home.md has text after its frontmatter"));
});

describe("settings", () => {
  const UI = "ui: { skipLink: S, menu: M, readMore: R, mainNav: N, footerNav: F, breadcrumb: B, home: H }\n";

  it("fail without a name", () =>
    expectFailure({ "src/content/settings/site.yml": `language: en\nnav: []\nseo: { description: D }\n${UI}` }, "site.yml", "name"));

  it("fail without a ui string, naming it", () =>
    expectFailure(
      { "src/content/settings/site.yml": `name: Test\nlanguage: en\nnav: []\nseo: { description: D }\n${UI.replace("breadcrumb: B, ", "")}` },
      "site.yml",
      "breadcrumb",
    ));

  it("fail on a business fact outside a block, such as the old contact setting", () =>
    expectFailure(
      { "src/content/settings/site.yml": `name: Test\nlanguage: en\nnav: []\ncontact: { phone: "+1 555 0100" }\nseo: { description: D }\n${UI}` },
      "site.yml",
      "contact",
    ));

  it("build without header actions and footer blocks", async () => {
    const build = await buildFixture("base", {
      files: { "src/content/settings/site.yml": `name: Test\nlanguage: en\nnav: []\nseo: { description: D }\n${UI}` },
    });
    try {
      assert.ok(build.ok, build.output);
    } finally {
      await build.cleanup();
    }
  });
});
