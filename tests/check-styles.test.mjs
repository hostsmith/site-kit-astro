// site-kit-themes, "Style check": npm run check:styles.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { checkStyles as check, contrastRatio } from "../packages/site-kit-astro/scripts/check-styles.mjs";
import { parseHooks } from "../packages/site-kit-astro/scripts/hooks-reference.mjs";
import { PACKAGE, run } from "./helpers.mjs";

// A site holding only the given files, passed to `fn` and then removed.
async function withSite(files, fn) {
  const root = await mkdtemp(join(tmpdir(), "site-kit-styles-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

// Runs the command in a kit site holding only the given files, and the
// src/site.schema.ts every kit site has (site-kit-core-split design D72).
function checkStyles(files, args = []) {
  return withSite({ "src/site.schema.ts": "", ...files }, (root) => run(process.execPath, [join(PACKAGE, "bin", "site-kit.mjs"), "check-styles", ...args], { cwd: root }));
}

const NAVY = "@theme static {\n  --color-*: initial;\n  --color-bg: #f3f4f7;\n  --color-fg: #14233c;\n  --color-tint: #dee4ee;\n}\n";
const CONTRAST_TABLE = "## Contrast pairs\n\n| Text | Background | Minimum |\n| --- | --- | --- |\n| `--color-fg` | `--color-bg` | 4.5 |\n| `--color-fg` | `--color-tint` | 4.5 |\n";
// A theme with one preset that passes its contrast pairs.
const THEME = {
  "src/styles/theme/README.md": CONTRAST_TABLE,
  "src/styles/theme/tokens/colors.css": '@import "../presets/colors/navy.css";\n',
  "src/styles/theme/presets/colors/navy.css": NAVY,
};

describe("check:styles", () => {
  it("passes raw values in the color presets, the type tokens and fonts.css", async () => {
    const result = await checkStyles({
      ...THEME,
      "src/styles/theme/tokens/type.css": '@theme static {\n  --font-*: initial;\n  --font-body: "Figtree", sans-serif;\n}\n',
      "src/styles/theme/tokens/shape.css": "@theme static {\n  --shadow-raised: 0 1px 2px color-mix(in oklch, var(--color-fg) 6%, transparent);\n}\n",
      "src/styles/theme/fonts.css": '@font-face {\n  font-family: "Figtree";\n  src: url("/assets/fonts/figtree.woff2");\n}\n',
      "src/styles/theme/layout.css": ".sk-header {\n  background: var(--color-bg);\n  border-color: transparent;\n  color: currentColor;\n}\n",
    });
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /No problems in 6 style files\./);
  });

  it("names a raw color, its file and line", async () => {
    const result = await checkStyles({ "src/styles/site.css": ".promo {\n  padding: 1rem;\n  color: #ff0000;\n  background: rgb(0 0 0 / 0.5);\n  border-color: red;\n}\n" });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/styles\/site\.css:3: raw color "#ff0000"/);
    assert.match(result.output, /src\/styles\/site\.css:4: raw color "rgb\(…\)"/);
    assert.match(result.output, /src\/styles\/site\.css:5: raw color "red"/);
  });

  // Scenario "Raw color in a token file".
  it("names a raw color in a token file, and passes it in a preset", async () => {
    const result = await checkStyles({
      ...THEME,
      "src/styles/theme/presets/colors/navy.css": `${NAVY}:root {\n  --kestrel-shadow: rgb(20 35 60 / 0.06);\n}\n`,
      "src/styles/theme/tokens/shape.css": "@theme static {\n  --shadow-raised: 0 1px 2px rgb(20 35 60 / 0.06);\n}\n",
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/styles\/theme\/tokens\/shape\.css:2: raw color "rgb\(…\)"/);
    assert.ok(!result.output.includes("navy.css"), result.output);
  });

  it("names a font family outside fonts.css and the type tokens", async () => {
    const result = await checkStyles({ "src/styles/theme/sections.css": '.sk-hero__title {\n  font-family: "Comic Sans MS", cursive;\n}\n.sk-eyebrow {\n  font-family: var(--font-body);\n}\n' });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/styles\/theme\/sections\.css:2: font name "\\"Comic Sans MS\\", cursive"/);
    assert.ok(!result.output.includes(":5:"), "a font from a variable is fine");
  });

  // Scenario "Raw color in a site section".
  it("names an arbitrary Tailwind value in a site section's classes", async () => {
    const result = await checkStyles({
      "src/components/sections/site/promo.astro":
        '---\nconst x = 1;\n---\n<section class="py-section">\n  <h2 class="text-[44px] text-fg">Promo</h2>\n  <p class:list={["md:bg-[#fff]", "text-muted"]}>Text</p>\n  <p class="text-[#ff0000] bg-(--kestrel-shadow)">Text</p>\n</section>\n',
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/components\/sections\/site\/promo\.astro:5: arbitrary value "text-\[44px\]"/);
    assert.match(result.output, /src\/components\/sections\/site\/promo\.astro:6: arbitrary value "md:bg-\[#fff\]"/);
    assert.match(result.output, /src\/components\/sections\/site\/promo\.astro:7: arbitrary value "text-\[#ff0000\]"/);
    assert.match(result.output, /src\/components\/sections\/site\/promo\.astro:7: arbitrary value "bg-\(--kestrel-shadow\)"/);
    assert.ok(!result.output.includes("py-section"), "token utilities are fine");
  });

  it("checks an .astro file's style block and style attribute", async () => {
    const result = await checkStyles({
      "src/pages/about.astro": '<div style="color: #123456">Hi</div>\n<style>\n  .card {\n    box-shadow: 0 1px 2px hsl(0 0% 0% / 0.1);\n  }\n</style>\n',
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/pages\/about\.astro:1: raw color "#123456"/);
    assert.match(result.output, /src\/pages\/about\.astro:4: raw color "hsl\(…\)"/);
  });
});

describe("check:styles, hooks", () => {
  // Scenario "Hook the installed kit doesn't list".
  it("names an sk- class or attribute that the installed kit doesn't list", async () => {
    const result = await checkStyles({
      "src/styles/theme/sections.css": ".sk-hero__title {\n  margin: 0;\n}\n\n.sk-hero__kicker {\n  margin: 0;\n}\n",
      "src/styles/theme/layout.css": ".sk-menu {\n  &[data-shown] {\n    display: block;\n  }\n}\n\n.sk-faq__item[open] .sk-header__menu-button:not([hidden])[aria-expanded] {\n  margin: 0;\n}\n",
      "src/styles/site.css": ".promo[data-variant] {\n  margin: 0;\n}\n",
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/styles\/theme\/sections\.css:5: unknown hook "sk-hero__kicker"/);
    assert.match(result.output, /src\/styles\/theme\/layout\.css:2: unknown hook "data-shown"/);
    assert.ok(!/sk-hero__title|data-variant|"open"|"hidden"|aria-expanded/.test(result.output), result.output);
  });

  // Scenario "Deprecated hook".
  it("warns about a deprecated hook, naming its replacement", async () => {
    const hooks = parseHooks(
      [
        "## Sections",
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
        "",
      ].join("\n"),
    );
    const result = await withSite({ "src/styles/theme/sections.css": ".sk-hero__heading {\n  margin: 0;\n}\n" }, (root) => check(root, { hooks }));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, [
      { file: "src/styles/theme/sections.css", line: 1, kind: "deprecated hook", value: "sk-hero__heading", detail: "use sk-hero__title" },
    ]);
  });
});

describe("check:styles, color presets", () => {
  // Scenario "Presets disagree".
  it("names a preset that lacks or adds a color name", async () => {
    const result = await checkStyles({
      ...THEME,
      "src/styles/theme/presets/colors/pine.css": "@theme static {\n  --color-*: initial;\n  --color-bg: #f1f4f1;\n  --color-fg: #14271f;\n  --color-needle: #2c6147;\n}\n",
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/styles\/theme\/presets\/colors\/pine\.css: missing color "--color-tint" \(navy\.css defines it\)/);
    assert.match(result.output, /src\/styles\/theme\/presets\/colors\/pine\.css: extra color "--color-needle" \(navy\.css doesn't define it\)/);
  });

  it("names a preset that fails a contrast pair", async () => {
    const result = await checkStyles({
      ...THEME,
      "src/styles/theme/presets/colors/pine.css": "@theme static {\n  --color-bg: #f1f4f1;\n  --color-fg: #14271f;\n  --color-tint: oklch(40% 0.05 160);\n}\n",
    });
    assert.equal(result.code, 1);
    assert.match(result.output, /pine\.css: contrast "--color-fg on --color-tint" \(\d\.\d\d:1, below 4\.5:1\)/);
    assert.ok(!result.output.includes("navy.css"), result.output);
  });

  it("asks for a contrast table when the theme has presets", async () => {
    const result = await checkStyles({ ...THEME, "src/styles/theme/README.md": "# Theme\n" });
    assert.equal(result.code, 1);
    assert.match(result.output, /src\/styles\/theme\/README\.md: no contrast table/);
  });

  it("computes contrast from hex, rgb(), hsl() and oklch()", () => {
    assert.equal(contrastRatio("#000", "#fff").toFixed(2), "21.00");
    assert.equal(contrastRatio("rgb(0 0 0)", "rgb(255, 255, 255)").toFixed(2), "21.00");
    assert.equal(contrastRatio("hsl(0 0% 0%)", "hsl(0 0% 100%)").toFixed(2), "21.00");
    assert.equal(contrastRatio("oklch(0% 0 0)", "oklch(100% 0 0)").toFixed(2), "21.00");
    assert.equal(contrastRatio("var(--color-fg)", "#fff", new Map([["--color-fg", "#14233c"]])).toFixed(2), contrastRatio("#14233c", "#fff").toFixed(2));
    assert.equal(contrastRatio("color-mix(in oklch, red, blue)", "#fff"), null);
  });
});

describe("check:styles --built", () => {
  // Scenario "Unstyled hook after the build".
  it("warns about a hook in the built pages that no rule styles", async () => {
    const result = await checkStyles(
      {
        "src/styles/theme/sections.css": ".sk-section {\n  margin: 0;\n}\n\n.sk-stats .sk-stat {\n  margin: 0;\n}\n",
        "src/styles/site.css": ".sk-stat__value {\n  margin: 0;\n}\n",
        "dist/index.html": '<section class="sk-section sk-stats sk-tone-dark"><ul><li class="sk-stat"><p class="sk-stat__value">20</p></li></ul></section>',
        "dist/about/index.html": '<section class="sk-section sk-stats sk-tone-dark"></section>',
      },
      ["--built"],
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /dist\/(about\/)?index\.html: unstyled hook "sk-tone-dark"/);
    assert.equal(result.output.match(/unstyled hook/g).length, 1, result.output);
    assert.match(result.output, /Checked the classes in 2 built pages\./);
  });

  // Scenario "Utility the theme resets".
  it("warns about a class that no rule in the built CSS matches", async () => {
    const result = await checkStyles(
      {
        "src/styles/theme/sections.css": ".sk-section {\n  margin: 0;\n}\n",
        "dist/_astro/site.css": ".sk-section{margin:0}.text-h1{font-size:3rem}.md\\:grid-cols-3{grid-template-columns:repeat(3,1fr)}.mt-6{margin-top:1.5rem}",
        "dist/about/index.html":
          '<div class="group"><h1 class="text-h1 text-4xl">About</h1><ul class="md:grid-cols-3 mt-6"></ul><pre><code class="language-js">x</code></pre><section class="sk-section"></section></div>',
      },
      ["--built"],
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /dist\/about\/index\.html: class without a rule "text-4xl" \(the built CSS has no rule for it: a Tailwind default the theme resets/);
    assert.equal(result.output.match(/class without a rule/g).length, 1, `only text-4xl: ${result.output}`);
  });

  it("asks for the build first", async () => {
    const result = await checkStyles({ "src/styles/site.css": "" }, ["--built"]);
    assert.equal(result.code, 1);
    assert.match(result.output, /run npm run build first/);
  });
});

// site-kit-site-variants design D160.
describe("check:styles, site variants", () => {
  // Scenario "A site variant that selects by position".
  it("names an element name or a position in a site variant's rule, and passes pseudo-elements and states", async () => {
    const result = await checkStyles({
      "src/styles/theme/sections.css": [
        '.sk-faq[data-site-variant="boxed"] .sk-faq__item:nth-child(odd) {\n  margin: 0;\n}',
        '.sk-faq[data-site-variant="boxed"] .sk-faq__item::before {\n  content: "";\n}',
        '.sk-faq[data-site-variant="boxed"] li {\n  margin: 0;\n}',
        '.sk-faq[data-site-variant="boxed"] {\n  & .sk-faq__item:first-child {\n    margin: 0;\n  }\n  &:hover .sk-faq__question:focus-visible {\n    margin: 0;\n  }\n}',
        'html .sk-faq[data-site-variant="boxed"] .sk-faq__item:not([open]) {\n  margin: 0;\n}',
        ".sk-faq .sk-faq__item:last-child {\n  margin: 0;\n}",
      ].join("\n"),
    });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /sections\.css:1: site variant by position ":nth-child" \(a site variant selects by the kit's hooks and states/);
    assert.match(result.output, /sections\.css:7: site variant by element "li"/);
    assert.match(result.output, /sections\.css:11: site variant by position ":first-child"/);
    assert.equal(result.output.match(/site variant by/g).length, 3, result.output);
  });

  // Scenarios "A site variant without a rule" and "A site variant no page uses".
  it("warns about a site variant a page uses and no rule styles, and one no page uses", async () => {
    const result = await checkStyles(
      {
        "src/site.config.ts":
          'export const siteConfig = { url: "https://www.example.com", locales: [{ code: "en" }], collections: {}, siteVariants: { faq: { boxed: { label: "Boxed" } }, cta: { quiet: { label: "Quiet" } }, testimonials: { band: { label: "On a band" } }, steps: { numbered: { label: "Numbered" } } } } as const;\n',
        "src/styles/theme/sections.css":
          ".sk-section, .sk-faq, .sk-cta, .sk-cta--card, .sk-testimonials {\n  margin: 0;\n}\n.sk-cta[data-site-variant=quiet] {\n  margin: 0;\n}\n[data-site-variant='band'] .sk-section__title {\n  margin: 0;\n}\n.sk-faq[data-site-variant~=\"numbered\"] {\n  margin: 0;\n}\n.sk-testimonials[data-site-variant=\"boxed\"] {\n  margin: 0;\n}\n",
        "dist/index.html":
          '<section data-section="faq" data-site-variant="boxed" class="sk-section sk-faq"></section><section data-section="cta" data-site-variant="quiet" class="sk-section sk-cta sk-cta--card"></section>',
        "dist/about/index.html": '<section data-section="faq" data-site-variant="boxed" class="sk-section sk-faq"></section><section data-section="testimonials" data-site-variant="band" class="sk-section sk-testimonials"></section>',
      },
      ["--built"],
    );
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /dist\/(about\/)?index\.html: unstyled site variant "boxed" \(no rule in src\/styles\/theme\/ or site\.css styles \.sk-faq\[data-site-variant="boxed"\]\)/);
    assert.match(result.output, /src\/site\.config\.ts: unused site variant "numbered" \(steps: no built page has a steps section with it\)/);
    assert.equal(result.output.match(/site variant "/g).length, 2, result.output);
  });
});
