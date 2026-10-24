// site-kit-section-library, "Kit icon set": the site's own icons in src/icons/
// (site-kit-webflow-example design D107).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parse } from "yaml";
import { buildFixture } from "./helpers.mjs";

const svg = (inner, attributes = 'viewBox="0 0 24 24" fill="none" stroke="currentColor"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${inner}</svg>\n`;
const BOOTH = svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>');
const page = (icon) => `---\ntitle: Icons\nsections:\n  - id: v3p8\n    type: services-grid\n    items:\n      - { title: Phone booths, icon: ${icon} }\n      - { title: Repairs, icon: wrench }\n---\n`;

describe("site icons", () => {
  let build;
  before(async () => {
    build = await buildFixture("base", { files: { "src/icons/phone-booth.svg": BOOTH, "src/content/pages/icons.en.md": page("phone-booth") } });
  });
  after(() => build.cleanup());

  it("render inline in the current text color, like the kit's", async () => {
    assert.ok(build.ok, build.output);
    const html = await build.read("icons/index.html");
    assert.match(
      html,
      /<span class="sk-card__icon">\s*<svg class="sk-icon" data-icon="phone-booth" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false"><rect x="4" y="2" width="16" height="20" rx="2" \/><path d="M12 18h\.01" \/><\/svg>/,
    );
    assert.match(html, /data-icon="wrench"/, "the kit's icons still work");
  });

  it("are offered in the Decap select after the kit's names", async () => {
    const { readFile } = await import("node:fs/promises");
    const config = parse(await readFile(`${build.dir}/public/admin/config.yml`, "utf8"));
    const grid = config.collections[0].fields.find((field) => field.name === "sections").types.find((type) => type.name === "services-grid");
    const options = grid.fields.find((field) => field.name === "items").fields.find((field) => field.name === "icon").options;
    assert.equal(options.at(-1), "phone-booth");
    assert.equal(options[0], "calendar");
  });

  it("fill in the current text color without a fill of their own", async () => {
    const filled = await buildFixture("base", {
      files: { "src/icons/desk.svg": svg('<path d="M2 2h20v4H2z"/>', 'viewBox="0 0 24 24"'), "src/content/pages/icons.en.md": page("desk") },
    });
    try {
      assert.ok(filled.ok, filled.output);
      assert.match(await filled.read("icons/index.html"), /data-icon="desk"[^>]*viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"/);
    } finally {
      await filled.cleanup();
    }
  });

  it("fail the build on an unknown name, naming the allowed ones, the site's too", async () => {
    const bad = await buildFixture("base", { files: { "src/icons/phone-booth.svg": BOOTH, "src/content/pages/icons.en.md": page("phone-boot") } });
    await bad.cleanup();
    assert.equal(bad.ok, false);
    assert.match(bad.output, /prop "items\[0\]\.icon" has the value "phone-boot", expected one of "calendar"[^\n]*"phone-booth"/);
  });

  it("fail the build on each broken rule, naming the file and the reason", async () => {
    const bad = await buildFixture("base", {
      files: {
        "src/icons/phone.svg": BOOTH,
        "src/icons/Desk_2.svg": BOOTH,
        "src/icons/no-viewbox.svg": svg('<path d="M1 1"/>', 'fill="none" stroke="currentColor"'),
        "src/icons/kitchen.svg": svg('<path d="M1 1" stroke="#2e5a45"/>'),
        "src/icons/desk.svg": svg('<path d="M1 1"/>', 'viewBox="0 0 24 24" onload="alert(1)"'),
        "src/icons/styled.svg": svg('<style>path{fill:red}</style><path d="M1 1" style="fill:red"/>'),
        "src/icons/scripted.svg": svg('<script>alert(1)</script><path d="M1 1"/>'),
        "src/icons/foreign.svg": svg('<foreignObject width="10" height="10"></foreignObject>'),
        "src/icons/linked.svg": svg('<image href="https://example.com/a.png"/><use href="#a"/><path id="a" d="M1 1"/>'),
      },
    });
    await bad.cleanup();
    assert.equal(bad.ok, false);
    for (const line of [
      "src/icons/phone.svg has the name of one of the kit's icons",
      "src/icons/Desk_2.svg has a name that isn't lowercase letters, digits and hyphens",
      "src/icons/no-viewbox.svg has no viewBox",
      'src/icons/kitchen.svg sets the color "#2e5a45" in stroke',
      "src/icons/desk.svg has the event handler attribute onload",
      "src/icons/styled.svg contains a style element",
      "src/icons/styled.svg has a style attribute",
      "src/icons/scripted.svg contains a script element",
      "src/icons/foreign.svg contains a foreignObject element",
      'src/icons/linked.svg links to "https://example.com/a.png" in href',
    ]) {
      assert.ok(bad.output.includes(line), `output doesn't mention ${JSON.stringify(line)}:\n${bad.output}`);
    }
    assert.ok(!bad.output.includes('links to "#a"'), "a link to an element in the same file is allowed");
  });
});
