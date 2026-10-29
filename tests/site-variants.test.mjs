// site-kit-section-library, "Site variants": a site's own looks for library
// section types, declared in src/site.config.ts (site-kit-site-variants design
// D159).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { parse } from "yaml";
import { ASSEMBLED, assemble } from "../packages/site-kit-astro/scripts/decap-config.mjs";
import { readSiteVariants } from "../packages/site-kit-astro/scripts/site-variants.mjs";
import { BASICS, buildFixture, htmlFiles, PACKAGE, REPO, siteKit } from "./helpers.mjs";

// The README's example.
const VARIANTS = {
  faq: { boxed: { label: "Boxed, with a border" } },
  "services-grid": { "on-blue": { label: "On a blue band", variants: ["cards"] } },
};
const KIT_VARIANTS = { faq: [], "services-grid": ["cards", "list"], steps: [], cta: ["banner", "card"] };

// The site config with `siteVariants`, as a site writes it.
const declaring = (variants) => ({
  "src/site.config.ts": (text) => text.replace("  collections: {", `  siteVariants: ${JSON.stringify(variants)},\n  collections: {`),
});
const page = (sections) => `---\ntitle: Looks\nsections:\n${sections.join("\n")}\n---\n`;
const FAQ_ITEMS = "    items:\n      - { question: Do you deliver?, answer: Yes. }";

// Each library section of a page, from its opening tag to its end, by id.
function sectionsOf(html) {
  const out = {};
  for (const [whole, id] of html.matchAll(/<section [^>]*data-section="[^"]+"[\s\S]*?<\/section>/g).map((match) => [match[0], match[0].match(/sections\[([a-z0-9]{4})\]/)?.[1]])) {
    if (id) out[id] = whole;
  }
  return out;
}

describe("site variants' declaration", () => {
  it("is read with its labels, and the kit variants each one goes with", () => {
    assert.deepEqual(readSiteVariants(VARIANTS, KIT_VARIANTS), {
      faq: { boxed: { label: "Boxed, with a border", variants: undefined } },
      "services-grid": { "on-blue": { label: "On a blue band", variants: ["cards"] } },
    });
  });

  it("is optional", () => {
    assert.deepEqual(readSiteVariants(undefined, KIT_VARIANTS), {});
  });

  it("fails on every broken rule at once, naming the type and the name", () => {
    assert.throws(
      () =>
        readSiteVariants(
          {
            "menu-board": { tall: { label: "Tall" } },
            faq: { Boxed: { label: "Boxed" } },
            "services-grid": { list: { label: "List" }, plain: {}, wide: { label: "Wide", variants: ["masonry"] }, dark: { label: "Dark", tone: "dark" } },
            steps: { numbered: { label: "Numbered", variants: ["cards"] } },
          },
          KIT_VARIANTS,
        ),
      (error) => {
        for (const line of [
          'siteVariants in src/site.config.ts:',
          '"menu-board" isn\'t a library section type. The library types are faq, services-grid, steps, cta. A site-local type sets its own variants in its schema.',
          'faq "Boxed" isn\'t kebab-case',
          'services-grid "list" has the name of one of services-grid\'s kit variants, "cards", "list". Rename it.',
          'services-grid "plain" needs a "label"',
          'services-grid "wide" lists "masonry" in "variants", which isn\'t a kit variant of services-grid. Its kit variants are "cards", "list".',
          'services-grid "dark" has "tone". A site variant has a "label" and, optionally, "variants".',
          'steps "numbered" sets "variants", but steps has no kit variants. Leave "variants" out.',
        ]) {
          assert.ok(error.message.includes(line), `the message doesn't say ${JSON.stringify(line)}:\n${error.message}`);
        }
        return true;
      },
    );
  });
});

describe("site variants in the Decap config", () => {
  const kitPart = readFileSync(join(PACKAGE, "decap", "config.kit.yml"), "utf8");
  const sitePart = readFileSync(join(BASICS, "public", "admin", "config.site.yml"), "utf8");
  const typesOf = (text) => parse(text).collections.find((collection) => collection.name === "pages").fields.find((field) => field.name === "sections").types;

  it("give each type with site variants a select after its fields, offering them by their labels", () => {
    const types = typesOf(assemble(kitPart, sitePart, ["en"], [], VARIANTS));
    const select = types.find((type) => type.name === "faq").fields.at(-1);
    assert.equal(select.name, "siteVariant");
    assert.equal(select.widget, "select");
    assert.equal(select.required, false);
    assert.deepEqual(select.options, [{ label: "Boxed, with a border", value: "boxed" }]);
    assert.deepEqual(types.find((type) => type.name === "services-grid").fields.at(-1).options, [{ label: "On a blue band", value: "on-blue" }]);
  });

  it("leave every other type without the field, and a site without them as before", () => {
    const types = typesOf(assemble(kitPart, sitePart, ["en"], [], VARIANTS));
    for (const type of types.filter((type) => !Object.hasOwn(VARIANTS, type.name))) {
      assert.ok(!type.fields.some((field) => field.name === "siteVariant"), `${type.name} has a siteVariant field`);
    }
    assert.equal(assemble(kitPart, sitePart, ["en"], [], {}), assemble(kitPart, sitePart, ["en"]));
  });

  it("fail the assembly on a broken declaration, as the build does", () => {
    assert.throws(() => assemble(kitPart, sitePart, ["en"], [], { faq: { list: {} } }), /siteVariants in src\/site\.config\.ts:\n- faq "list" needs a "label"/);
  });
});

describe("site variants in a site", () => {
  let build;
  before(async () => {
    build = await buildFixture("base", {
      edit: declaring(VARIANTS),
      files: {
        "src/content/pages/looks.en.md": page([
          `  - id: f1a2\n    type: faq\n    siteVariant: boxed\n${FAQ_ITEMS}`,
          `  - id: f3b4\n    type: faq\n${FAQ_ITEMS}`,
          "  - id: s5c6\n    type: services-grid\n    siteVariant: on-blue\n    items:\n      - { title: Repairs }",
        ]),
      },
    });
  });
  after(() => build.cleanup());

  it("put data-site-variant on the section's root, with the markup otherwise the same", async () => {
    assert.ok(build.ok, build.output);
    const sections = sectionsOf(await build.read("looks/index.html"));
    assert.match(sections.f1a2, /^<section data-section="faq" data-site-variant="boxed" class="sk-section sk-faq">/);
    assert.equal(sections.f1a2.replace(' data-site-variant="boxed"', "").replaceAll("[f1a2]", "[f3b4]"), sections.f3b4);
    assert.match(sections.s5c6, /^<section data-section="services-grid" data-site-variant="on-blue" class="sk-section sk-services-grid sk-services-grid--cards sk-tone-plain">/);
  });

  it("offer them in the site's Decap config", async () => {
    const config = parse(await readFile(join(build.dir, ASSEMBLED), "utf8"));
    const faq = config.collections[0].fields.find((field) => field.name === "sections").types.find((type) => type.name === "faq");
    assert.deepEqual(faq.fields.at(-1).options, [{ label: "Boxed, with a border", value: "boxed" }]);
  });

  it("are listed with their labels in the schema export", async () => {
    const result = await siteKit(build.dir, ["schema"]);
    assert.equal(result.code, 0, result.output);
    const schema = JSON.parse(await readFile(join(build.dir, ".hostsmith", "schema.json"), "utf8"));
    const branches = schema.collections.pages.fields.properties.sections.items.oneOf;
    const of = (type) => branches.find((branch) => branch.properties.type.const === type).properties;
    assert.deepEqual(of("faq").siteVariant, { type: "string", enum: ["boxed"], "x-labels": { boxed: "Boxed, with a border" }, "x-widget": "select" });
    assert.equal(of("cta").siteVariant, undefined);
  });
});

// The library's types, by their components, and a site variant for each.
const LIBRARY = readdirSync(join(PACKAGE, "src", "components", "sections"))
  .filter((file) => file.endsWith(".astro"))
  .map((file) => file.slice(0, -".astro".length));
const QUIET = Object.fromEntries(LIBRARY.map((type) => [type, { quiet: { label: "Quiet" } }]));

// A fixture's pages with `siteVariant: quiet` on every library section, written
// in block style or in flow style.
function quietPages(fixture) {
  const pages = join(REPO, "tests", "fixtures", fixture, "content", "pages");
  const types = LIBRARY.join("|");
  const quiet = (text) =>
    text
      .replace(new RegExp(`^( +)type: (${types})$`, "gm"), "$1type: $2\n$1siteVariant: quiet")
      .replace(new RegExp(`\\btype: (${types}),`, "g"), "type: $1, siteVariant: quiet,");
  return Object.fromEntries(
    readdirSync(pages, { recursive: true })
      .filter((file) => file.endsWith(".md"))
      .map((file) => [join("src", "content", "pages", file), quiet]),
  );
}

describe("a site variant on every library type", () => {
  const builds = {};
  before(async () => {
    for (const [fixture, example] of [["base", "basics"], ["interactive", "webflow"]]) {
      const [plain, quiet] = await Promise.all([buildFixture(fixture, { example }), buildFixture(fixture, { example, edit: { ...declaring(QUIET), ...quietPages(fixture) } })]);
      builds[fixture] = { plain, quiet };
    }
  });
  after(() => Promise.all(Object.values(builds).flatMap(({ plain, quiet }) => [plain.cleanup(), quiet.cleanup()])));

  it("changes each page only by the root's data-site-variant", async () => {
    const seen = new Set();
    for (const [fixture, { plain, quiet }] of Object.entries(builds)) {
      assert.ok(plain.ok, plain.output);
      assert.ok(quiet.ok, quiet.output);
      const files = (await htmlFiles(plain.dist)).sort();
      assert.deepEqual((await htmlFiles(quiet.dist)).sort(), files);
      for (const file of files) {
        const html = await quiet.read(file);
        for (const match of html.matchAll(/<section data-section="([a-z-]+)"(?: data-reveal="[a-z-]+")? data-site-variant="quiet"/g)) seen.add(match[1]);
        assert.equal(html.replaceAll(' data-site-variant="quiet"', ""), await plain.read(file), `${fixture}: ${file}`);
      }
    }
    assert.deepEqual([...seen].sort(), [...LIBRARY].sort(), "every library type carried it");
  });
});

describe("site variants that fail the build", () => {
  it("name the file, the section and what's allowed, for an undeclared name, an unsupported kit variant and a type without site variants", async () => {
    const bad = await buildFixture("base", {
      edit: declaring(VARIANTS),
      files: {
        "src/content/pages/looks.en.md": page([
          `  - id: f7d8\n    type: faq\n    siteVariant: numbered\n${FAQ_ITEMS}`,
          "  - id: s9e1\n    type: services-grid\n    variant: list\n    siteVariant: on-blue\n    items:\n      - { title: Repairs }",
          "  - id: c2f3\n    type: cta\n    title: Call us\n    button: { label: Call, link: /contact }\n    siteVariant: boxed",
        ]),
      },
    });
    await bad.cleanup();
    assert.equal(bad.ok, false);
    assert.match(bad.output, /looks/);
    for (const line of [
      'section "f7d8" (faq): prop "siteVariant" has the value "numbered", expected one of "boxed"',
      'section "s9e1" (services-grid): site variant "on-blue" goes only with the variant "cards", not "list"',
      'section "c2f3" (cta): unknown prop "siteVariant"',
    ]) {
      assert.ok(bad.output.includes(line), `output doesn't mention ${JSON.stringify(line)}:\n${bad.output}`);
    }
  });

  it("list every problem of the declaration", async () => {
    // The fixture keeps the example's config.yml: the build assembles its own, and fails there.
    const bad = await buildFixture("base", {
      edit: declaring({ "menu-board": { tall: { label: "Tall" } }, "services-grid": { list: { label: "List" } } }),
      files: { [ASSEMBLED]: readFileSync(join(BASICS, ASSEMBLED), "utf8") },
    });
    await bad.cleanup();
    assert.equal(bad.ok, false);
    assert.match(bad.output, /"menu-board" isn't a library section type/);
    assert.match(bad.output, /services-grid "list" has the name of one of services-grid's kit variants/);
  });
});
