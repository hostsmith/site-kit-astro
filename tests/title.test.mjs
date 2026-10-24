// site-kit-content-model, "Highlighted words in titles" (site-kit-webflow-example
// design D106).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { plainTitle, titleHtml, titleParts } from "../packages/site-kit-astro/src/lib/title.ts";
import { buildFixture } from "./helpers.mjs";

describe("title marks", () => {
  it("highlight a marked run", () => {
    assert.deepEqual(titleParts("Work ==together== by the river"), [
      { text: "Work ", highlight: false },
      { text: "together", highlight: true },
      { text: " by the river", highlight: false },
    ]);
  });

  it("pair from the left", () => {
    assert.deepEqual(titleParts("==One== and ==two=="), [
      { text: "One", highlight: true },
      { text: " and ", highlight: false },
      { text: "two", highlight: true },
    ]);
  });

  it("leave an unpaired mark as written", () => {
    assert.deepEqual(titleParts("Rates == from $149"), [{ text: "Rates == from $149", highlight: false }]);
    assert.deepEqual(titleParts("==Desks== then == alone"), [
      { text: "Desks", highlight: true },
      { text: " then == alone", highlight: false },
    ]);
  });

  it("don't nest", () => {
    // The second mark closes the first pair, so "inner" isn't highlighted twice.
    assert.deepEqual(titleParts("==outer ==inner== rest=="), [
      { text: "outer ", highlight: true },
      { text: "inner", highlight: false },
      { text: " rest", highlight: true },
    ]);
  });

  it("leave a pair with nothing between as written", () => {
    assert.deepEqual(titleParts("A ==== B"), [{ text: "A ==== B", highlight: false }]);
    assert.deepEqual(titleParts("== == x=="), [
      { text: "== ", highlight: false },
      { text: " x", highlight: true },
    ]);
  });

  it("strip the marks for plain text", () => {
    assert.equal(plainTitle("Six ==amenities==, one key fob"), "Six amenities, one key fob");
    assert.equal(plainTitle("Rates == from $149"), "Rates == from $149");
  });

  it("render escaped HTML with spans", () => {
    assert.equal(titleHtml("Tom's ==<desk>== & more"), 'Tom&#39;s <span class="sk-highlight">&lt;desk&gt;</span> &amp; more');
  });
});

describe("highlighted titles in a build", () => {
  let build;
  let html;
  before(async () => {
    const page = [
      "---",
      "title: Work ==together== by the river",
      "sections:",
      "  - { id: h1r3, type: hero, title: Work ==together== by the river }",
      "  - id: s2c4",
      "    type: services-grid",
      "    title: Six ==amenities==, one key fob",
      "    items:",
      "      - { title: Rates == from $149 }",
      "---",
      "",
    ].join("\n");
    // A site-local section that renders its title with the package's exports.
    const component = [
      "---",
      'import Title from "@hostsmith/site-kit-astro/components/Title.astro";',
      'import { sectionFields } from "@hostsmith/site-kit-astro/field";',
      'import { titleHtml } from "@hostsmith/site-kit-astro/title";',
      "const { section, entry } = Astro.props;",
      "const f = sectionFields(entry, section);",
      "---",
      '<section {...f.root}><h2 id="own" {...f.field("title")}><Title text={section.title} /></h2><p id="html" set:html={titleHtml(section.title)} /></section>',
      "",
    ].join("\n");
    build = await buildFixture("base", {
      edit: {
        "src/site.schema.ts": (text) =>
          text.replace(
            "export const siteSectionSchemas = {};",
            'import { section } from "@hostsmith/site-kit-astro/schema";\nexport const siteSectionSchemas = { note: section("note", { title: z.string() }) };',
          ),
        "public/admin/config.site.yml": (text) =>
          text.replace("section_types: []", "section_types:\n  - name: note\n    label: Note\n    widget: object\n    fields:\n      - { name: title, label: Title, widget: string }"),
      },
      files: {
        "src/content/pages/together.en.md": page,
        "src/content/pages/services/together.en.md": "---\ntitle: The ==mill== floor\nsections:\n  - { id: n0t3, type: note, title: Our ==own== part }\n---\n",
        "src/content/pages/services.en.md": "---\ntitle: Services\nsections: []\n---\n",
        "src/components/sections/site/note.astro": component,
      },
    });
    if (build.ok) html = await build.read("together/index.html");
  });
  after(() => build.cleanup());

  it("builds", () => assert.ok(build.ok, build.output));

  it("renders the hero's h1 with its highlight, and the head without marks", () => {
    assert.match(html, /<h1 class="sk-hero__title" data-field="pages\/together\.en#sections\[h1r3\]\.title">Work <span class="sk-highlight">together<\/span> by the river<\/h1>/);
    assert.match(html, /<title>Work together by the river<\/title>/);
    assert.match(html, /<meta property="og:title" content="Work together by the river">/);
  });

  it("renders a section title's h2, whose name has no marks", () => {
    assert.match(html, /<h2 class="sk-section__title" data-field="pages\/together\.en#sections\[s2c4\]\.title">\s*Six <span class="sk-highlight">amenities<\/span>, one key fob\s*<\/h2>/);
  });

  it("renders an unpaired mark as written", () => {
    assert.match(html, /<h3 class="sk-card__title"[^>]*>\s*Rates == from \$149\s*<\/h3>/);
  });

  it("renders site-owned markup the same way through the package's exports", async () => {
    const own = await build.read("services/together/index.html");
    assert.match(own, /<h2 id="own" data-field="pages\/services\/together\.en#sections\[n0t3\]\.title">Our <span class="sk-highlight">own<\/span> part<\/h2>/);
    assert.match(own, /<p id="html">Our <span class="sk-highlight">own<\/span> part<\/p>/);
  });

  it("strips the marks in the breadcrumb", async () => {
    const own = await build.read("services/together/index.html");
    assert.match(own, /<span aria-current="page" class="sk-breadcrumb__current"[^>]*>\s*The mill floor\s*<\/span>/);
  });
});
