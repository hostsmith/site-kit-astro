// site-kit-sections, "Section registry".
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFixture } from "./helpers.mjs";

const component = `---\nconst { section } = Astro.props;\n---\n<section data-section={section.type}><h2>{section.title}</h2></section>\n`;
const addSchema = (type) => (text) =>
  text.replace("export const sectionSchemas = {", `export const sectionSchemas = {\n  "${type}": section("${type}", { title: z.string() }),`);

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
    const result = await build({ edit: { "src/content.config.ts": addSchema("promo") } });
    assert.equal(result.ok, false);
    assert.match(result.output, /Section type "promo" has a schema .* but no component/);
  });

  it("fails on a site-local type named like a library type", async () => {
    const result = await build({ files: { "src/components/sections/site/hero.astro": component } });
    assert.equal(result.ok, false);
    assert.match(result.output, /Site-local section type "hero" .* has the same name as a library type/);
  });

  it("renders a registered site-local type", async () => {
    const result = await buildFixture("base", {
      edit: { "src/content.config.ts": addSchema("menu-board") },
      files: {
        "src/components/sections/site/menu-board.astro": component,
        "src/content/pages/menu.md": "---\ntitle: Menu\nsections:\n  - { id: m3n4, type: menu-board, title: Today }\n---\n",
      },
    });
    try {
      assert.ok(result.ok, result.output);
      assert.match(await result.read("menu/index.html"), /data-section="menu-board"><h2>Today<\/h2>/);
    } finally {
      await result.cleanup();
    }
  });
});
