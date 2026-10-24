// site-kit-sections, "The kit ships no styles" and "Styling hooks".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { HOOKS_FILE, parseHooks, readHooks } from "../packages/site-kit-astro/scripts/hooks-reference.mjs";
import { VISUALLY_HIDDEN } from "../packages/site-kit-astro/src/lib/hooks.ts";
import { buildFixture, documentedHooks, EXAMPLE_NAMES, htmlFiles } from "./helpers.mjs";

async function pages(build) {
  return Promise.all((await htmlFiles(build.dist)).map(async (file) => ({ file, html: await build.read(file) })));
}

const classesOf = (html) => [...html.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean));

describe("styling hooks", () => {
  // The base fixture uses every variant. Its site markup (the news detail
  // template) carries no classes, and the stylesheet is empty, so every class
  // in the output is the kit's. A second build with a logo covers the header's
  // logo, which replaces the site name, and a localized build covers the
  // language switcher. Every example is built too, the `webflow` example with
  // every part, and the interactive fixture adds an embed that loads at once
  // (site-kit-webflow-example design D109).
  let unstyled;
  let withLogo;
  let localized;
  let interactive;
  let examples;
  before(async () => {
    [unstyled, withLogo, localized, interactive, ...examples] = await Promise.all([
      buildFixture("base", { files: { "src/styles/global.css": "" } }),
      buildFixture("base", {
        edit: { "src/content/settings/site.en.yml": (text) => `${text}logo:\n  image: /assets/test/photo.svg\n  alt: Test logo\n` },
      }),
      buildFixture("locales", { files: { "src/styles/global.css": "" } }),
      buildFixture("interactive", { example: "webflow" }),
      ...EXAMPLE_NAMES.map((example) => buildFixture(null, { example })),
    ]);
  });
  after(() => Promise.all([unstyled, withLogo, localized, interactive, ...examples].map((build) => build.cleanup())));

  it("builds without any styles", () => {
    for (const build of [unstyled, withLogo, localized, interactive, ...examples]) assert.ok(build.ok, build.output);
  });

  it("renders only sk- classes", async () => {
    for (const { file, html } of await pages(unstyled)) {
      for (const name of classesOf(html)) assert.ok(name.startsWith("sk-"), `${file}: class "${name}" is not a hook`);
    }
  });

  it("uses inline styles only to hide text visually", async () => {
    for (const { file, html } of await pages(unstyled)) {
      for (const [, style] of html.matchAll(/\sstyle="([^"]*)"/g)) assert.equal(style, VISUALLY_HIDDEN, `${file}: unexpected style "${style}"`);
    }
  });

  // The examples' own markup carries Tailwind utilities, so only `sk-` classes count.
  it("renders exactly the hooks HOOKS.md lists", async () => {
    const rendered = new Set();
    for (const build of [unstyled, withLogo, localized, interactive, ...examples]) {
      for (const { html } of await pages(build)) for (const name of classesOf(html)) if (name.startsWith("sk-")) rendered.add(name);
    }
    const documented = await documentedHooks();
    const undocumented = [...rendered].filter((name) => !documented.has(name));
    const unrendered = [...documented].filter((name) => !rendered.has(name));
    assert.deepEqual(undocumented, [], "rendered hooks missing from HOOKS.md");
    assert.deepEqual(unrendered, [], "HOOKS.md hooks that no fixture renders");
  });
});

// Design D42: deprecated hooks sit in their own table, and still count as hooks.
describe("hook reference", () => {
  const reference = [
    "## Layout",
    "",
    "| Hook | Element | Marks |",
    "| --- | --- | --- |",
    "| `sk-header` | `header` | The site header |",
    "",
    "## States",
    "",
    "| State | Element | Means |",
    "| --- | --- | --- |",
    "| `data-open` | `sk-menu` | Open |",
    "",
    "## Other attributes",
    "",
    "| Attribute | Element | Holds |",
    "| --- | --- | --- |",
    "| `data-icon` | `sk-icon` | The icon's name |",
    "",
    "## Sections",
    "",
    "### hero",
    "",
    "| Hook | Element | Marks |",
    "| --- | --- | --- |",
    "| `sk-hero__title` | `h1` | The title |",
    "",
    "## Deprecated",
    "",
    "| Hook | Use instead | Deprecated in | Note |",
    "| --- | --- | --- | --- |",
    "| `sk-hero__heading` | `sk-hero__title` | 0.6.0 | renamed |",
    "| `sk-hero__kicker` | no replacement | 0.6.0 | removed |",
    "| `data-shown` | `data-open` | 0.6.0 | renamed |",
    "",
  ].join("\n");

  it("counts deprecated rows as hooks", () => {
    const { classes, states } = parseHooks(reference);
    assert.deepEqual([...classes].sort(), ["sk-header", "sk-hero__heading", "sk-hero__kicker", "sk-hero__title"]);
    assert.deepEqual([...states].sort(), ["data-open", "data-shown"]);
  });

  it("keeps attributes that aren't states apart", () => {
    assert.deepEqual([...parseHooks(reference).attributes], ["data-icon"]);
    const { states, attributes } = readHooks();
    assert.deepEqual([...attributes].sort(), ["data-icon", "data-section"]);
    assert.ok(!states.has("data-icon"), "data-icon is no state");
  });

  it("returns deprecated hooks with their replacements", () => {
    const { deprecated } = parseHooks(reference);
    assert.deepEqual(Object.fromEntries(deprecated), {
      "sk-hero__heading": { replacement: "sk-hero__title", since: "0.6.0", note: "renamed" },
      "sk-hero__kicker": { replacement: null, since: "0.6.0", note: "removed" },
      "data-shown": { replacement: "data-open", since: "0.6.0", note: "renamed" },
    });
  });

  it("has a Deprecated table in the package's HOOKS.md", async () => {
    assert.match(readFileSync(HOOKS_FILE, "utf8"), /^## Deprecated\n[\s\S]*^\| Hook \| Use instead \| Deprecated in \| Note \|$/m);
    const { classes, deprecated } = readHooks();
    assert.ok(classes.has("sk-hero__title"));
    for (const [hook, { replacement }] of deprecated) {
      if (replacement) assert.ok(classes.has(replacement) || (await documentedHooks({ states: true })).has(replacement), `${hook}'s replacement ${replacement} isn't a hook`);
    }
  });
});
