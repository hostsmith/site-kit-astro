// site-kit-sections, "Section registry".
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleFiles } from "../packages/site-kit-astro/scripts/decap-config.mjs";
import { buildFixture } from "./helpers.mjs";

const component = `---\nconst { section } = Astro.props;\n---\n<section data-section={section.type}><h2>{section.title}</h2></section>\n`;
// Adds a site-local schema to src/site.schema.ts.
const addSchema = (type) => ({
  "src/site.schema.ts": (text) =>
    text.replace(
      "export const siteSectionSchemas = {};",
      `import { section as testSection } from "@hostsmith/site-kit-astro/schema";\nexport const siteSectionSchemas = {\n  "${type}": testSection("${type}", { title: z.string() }),\n};`,
    ),
});

async function build(options) {
  const result = await buildFixture("base", options);
  await result.cleanup();
  return result;
}

describe("section registry", () => {
  it("fails on a component without a schema", async () => {
    const result = await build({ files: { "src/components/sections/site/promo.astro": component } });
    assert.equal(result.ok, false);
    assert.match(result.output, /Section type "promo" has a component .* but no schema/);
  });

  it("fails on a schema without a component", async () => {
    const result = await build({ edit: addSchema("promo") });
    assert.equal(result.ok, false);
    assert.match(result.output, /Section type "promo" has a schema in src\/site\.schema\.ts but no component\. Add src\/components\/sections\/site\/promo\.astro/);
  });

  it("fails on a site-local type named like a library type", async () => {
    const result = await build({ files: { "src/components/sections/site/hero.astro": component } });
    assert.equal(result.ok, false);
    assert.match(result.output, /Site-local section type "hero" .* has the same name as a library type/);
  });

  it("fails on a site-local schema named like a library type", async () => {
    const result = await build({ edit: addSchema("hero") });
    assert.equal(result.ok, false);
    assert.match(result.output, /Site-local section type "hero" in src\/site\.schema\.ts has the same name as a library type/);
  });

  it("renders a site-local type defined in the site's schema and Decap part", async () => {
    const decapType = "section_types:\n  - name: menu-board\n    label: Menu board\n    widget: object\n    fields:\n      - { name: title, label: Title, widget: string }";
    const result = await buildFixture("base", {
      edit: { ...addSchema("menu-board"), "public/admin/config.site.yml": (text) => text.replace("section_types: []", decapType) },
      files: {
        "src/components/sections/site/menu-board.astro": component,
        "src/content/pages/menu.en.md": "---\ntitle: Menu\nsections:\n  - { id: m3n4, type: menu-board, title: Today }\n---\n",
      },
    });
    try {
      assert.ok(result.ok, result.output);
      assert.match(await result.read("menu/index.html"), /data-section="menu-board"><h2>Today<\/h2>/);
      assert.match(assembleFiles(result.dir, ["en"]), /^ {10}- name: menu-board\n(?: {12}.*\n)*? {12}fields:\n {14}- \*section_id\n {14}- \{ name: title/m);
    } finally {
      await result.cleanup();
    }
  });
});
