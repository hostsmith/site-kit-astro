// site-kit-themes: every example's theme, in src/styles/theme/, checked for
// the rules that keep themes swappable (site-kit-design-system design D31,
// D32, D33): the theme's files and layers, the token roles the examples
// share, color presets, coverage of every hook, contrast, and the
// accessibility duties only CSS can meet.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { checkStyles, contrastPairs, contrastRatio, cssRules, presetColors } from "../packages/site-kit-astro/scripts/check-styles.mjs";
import { deprecatedHooks, documentedHooks, EXAMPLES, PACKAGE } from "./helpers.mjs";

const COLORS = ["bg", "fg", "surface", "tint", "muted", "border", "brand", "accent", "accent-fg", "on-dark", "error"];
const FONTS = ["heading", "body"];
const TEXT = ["display", "h1", "h2", "h3", "quote", "lead", "body", "small", "eyebrow"];
const RADII = ["tag", "input", "card", "panel", "button"];
const SHADOWS = ["raised", "overlay"];
const SPACE = ["--container-site", "--spacing-section", "--spacing-gutter", "--breakpoint-md"];

// The token roles every example defines (README, "Token roles"): colors in
// each preset, the rest in the token files.
export const COLOR_ROLES = COLORS.map((name) => `--color-${name}`);
export const ROLES = [
  ...FONTS.map((name) => `--font-${name}`),
  ...TEXT.flatMap((name) => [`--text-${name}`, `--text-${name}--line-height`, `--text-${name}--letter-spacing`, `--text-${name}--font-weight`]),
  ...RADII.map((name) => `--radius-${name}`),
  ...SHADOWS.map((name) => `--shadow-${name}`),
  ...SPACE,
];

// The text and background pairs the shared roles imply (design D33). Each
// example's contrast table lists at least these.
const PAIRS = [
  ["fg", "bg"],
  ["fg", "surface"],
  ["fg", "tint"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["bg", "fg"],
  ["on-dark", "fg"],
  ["accent-fg", "accent"],
  ["brand", "bg"],
  ["brand", "surface"],
  ["error", "surface"],
].map(([text, background]) => `--color-${text} on --color-${background}`);

// The token files, and the Tailwind namespaces each resets.
const TOKEN_FILES = { "tokens/type.css": ["font", "text"], "tokens/shape.css": ["radius", "shadow"], "tokens/space.css": ["container"] };
// The files that style the kit's hooks, all in plain CSS.
const STYLE_FILES = ["base.css", "layout.css", "sections.css", "prose.css"];
// global.css's imports, in order, with their layers.
const IMPORTS = [
  '"tailwindcss"',
  '"./theme/tokens/colors.css"',
  '"./theme/tokens/type.css"',
  '"./theme/tokens/shape.css"',
  '"./theme/tokens/space.css"',
  '"./theme/fonts.css"',
  '"./theme/base.css" layer(base)',
  '"./theme/layout.css" layer(components)',
  '"./theme/sections.css" layer(components)',
  '"./theme/prose.css" layer(components)',
  '"./site.css"',
];

// The kit's elements that render with the `hidden` attribute, by class.
const HIDDEN = [];
for (const file of readdirSync(join(PACKAGE, "src"), { recursive: true }).filter((f) => f.endsWith(".astro"))) {
  for (const [, attributes] of readFileSync(join(PACKAGE, "src", file), "utf8").matchAll(/<[a-z]+\b([^>]*)>/g)) {
    if (/\shidden(?=[\s=>]|$)/.test(attributes)) HIDDEN.push(...(attributes.match(/class="([^"]*)"/)?.[1].split(/\s+/) ?? []));
  }
}

// A selector list's top-level parts, and a selector's last compound.
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if ("([".includes(text[i])) depth++;
    else if (")]".includes(text[i])) depth--;
    else if (depth === 0 && separator.test(text[i])) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, text.slice(start)].map((part) => part.trim()).filter(Boolean);
}
const lastCompound = (selector) => splitTopLevel(selector, /[\s>+~]/).at(-1) ?? "";

// The compounds a rule's declarations apply to, with `&` resolved through
// the rules it is nested in.
function subjects({ selector, ancestors }) {
  const resolve = (list, parents) =>
    splitTopLevel(list, /,/).flatMap((part) => {
      const last = lastCompound(part);
      return last.includes("&") ? parents.map((parent) => last.replaceAll("&", parent)) : [last];
    });
  let parents = [""];
  for (const ancestor of ancestors) parents = resolve(ancestor, parents);
  return resolve(selector, parents);
}

const examples = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(EXAMPLES, entry.name, "package.json")))
  .map((entry) => entry.name);

for (const example of examples) {
  describe(`theme of example ${example}`, () => {
    const root = join(EXAMPLES, example);
    const dir = join(root, "src", "styles", "theme");
    const read = (file) => readFileSync(join(dir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const presetsDir = join(dir, "presets", "colors");
    const presets = existsSync(presetsDir) ? readdirSync(presetsDir).filter((file) => file.endsWith(".css")).sort() : [];
    const tokens = Object.keys(TOKEN_FILES).filter((file) => existsSync(join(dir, file)));
    const defined = new Map(tokens.flatMap((file) => [...read(file).matchAll(/(--[a-z0-9*-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])));
    const files = STYLE_FILES.filter((file) => existsSync(join(dir, file)));
    const styles = files.map(read).join("\n");
    const rules = files.flatMap((file) => cssRules(readFileSync(join(dir, file), "utf8")).map((rule) => ({ ...rule, file })));

    let hooks;
    let states;
    let deprecated;
    before(async () => {
      hooks = await documentedHooks();
      states = await documentedHooks({ states: true });
      deprecated = await deprecatedHooks();
    });

    // site-kit-themes, "A theme is one folder".
    describe("files", () => {
      it("has the theme's files and at least one color preset", () => {
        for (const file of ["README.md", "tokens/colors.css", ...Object.keys(TOKEN_FILES), "fonts.css", ...STYLE_FILES]) {
          assert.ok(existsSync(join(dir, file)), `${example} has no theme/${file}`);
        }
        assert.ok(presets.length > 0, `${example} has no preset in theme/presets/colors/`);
      });

      it("picks one preset in tokens/colors.css", () => {
        const imports = [...read("tokens/colors.css").matchAll(/@import\s+"\.\.\/presets\/colors\/([\w-]+\.css)"/g)].map((m) => m[1]);
        assert.equal(imports.length, 1, `${example}'s tokens/colors.css imports ${imports.length} presets`);
        assert.ok(presets.includes(imports[0]), `${example}'s tokens/colors.css imports ${imports[0]}, which doesn't exist`);
      });

      it("imports the theme in global.css in its order and layers", () => {
        const global = readFileSync(join(root, "src", "styles", "global.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        assert.deepEqual([...global.matchAll(/@import\s+([^;]+);/g)].map((m) => m[1].trim()), IMPORTS);
      });

      it("leaves the layers to global.css", () => {
        for (const file of files) assert.doesNotMatch(read(file), /@layer\b/, `${example}'s theme/${file} has an @layer block`);
      });
    });

    // site-kit-themes, "Shared token roles" and "Color schemes".
    describe("tokens", () => {
      it("defines every shared role", () => {
        const missing = ROLES.filter((role) => !defined.has(role));
        assert.deepEqual(missing, [], `${example}'s token files miss roles`);
        for (const preset of presets) {
          const colors = presetColors(read(`presets/colors/${preset}`));
          assert.deepEqual(COLOR_ROLES.filter((role) => !colors.has(role)), [], `${example}'s ${preset} misses color roles`);
        }
      });

      it("resets Tailwind's defaults in each token file and preset, and writes every token as a variable", () => {
        for (const [file, namespaces] of Object.entries(TOKEN_FILES)) {
          assert.match(read(file), /@theme static\s*\{/, `${file}: @theme static, so theme CSS can read every token`);
          for (const namespace of namespaces) assert.match(read(file), new RegExp(`--${namespace}-\\*:\\s*initial;`), `${file}: --${namespace}-*: initial`);
        }
        for (const preset of presets) {
          const css = read(`presets/colors/${preset}`);
          assert.match(css, /@theme static\s*\{/, `${preset}: @theme static`);
          assert.match(css, /--color-\*:\s*initial;/, `${preset}: --color-*: initial`);
        }
      });

      it("lists the shared roles' contrast pairs in the theme's README", () => {
        const listed = contrastPairs(readFileSync(join(dir, "README.md"), "utf8")).map(({ text, background }) => `${text} on ${background}`);
        assert.deepEqual(PAIRS.filter((pair) => !listed.includes(pair)), [], `${example}'s README misses contrast pairs`);
      });

      it("meets every listed contrast pair in every preset", () => {
        const pairs = contrastPairs(readFileSync(join(dir, "README.md"), "utf8"));
        for (const preset of presets) {
          const colors = presetColors(read(`presets/colors/${preset}`));
          const failing = pairs
            .map(({ text, background, minimum }) => ({ text, background, minimum, ratio: contrastRatio(colors.get(text) ?? "", colors.get(background) ?? "", colors) }))
            .filter(({ ratio, minimum }) => !(ratio >= minimum))
            .map(({ text, background, minimum, ratio }) => `${text} on ${background}: ${ratio === null ? "a color is missing or can't be computed" : `${ratio.toFixed(2)}:1, below ${minimum}:1`}`);
          assert.deepEqual(failing, [], `${example}'s ${preset} fails contrast pairs`);
        }
      });

      it("passes npm run check:styles", () => {
        const { errors } = checkStyles(root);
        assert.deepEqual(errors, [], `${example} fails check:styles`);
      });
    });

    // site-kit-themes, "Self-hosted fonts".
    describe("fonts", () => {
      const fontsDir = join(root, "public", "assets", "fonts");

      it("loads every font from the site's /assets/fonts/", () => {
        const urls = [...read("fonts.css").matchAll(/url\(["']?([^)"']+)["']?\)/g)].map((m) => m[1]);
        assert.ok(urls.length > 0, "fonts.css loads no font");
        for (const url of urls) {
          assert.match(url, /^\/assets\/fonts\/[^/]+\.woff2$/, url);
          assert.ok(existsSync(join(root, "public", url)), `${url} doesn't exist`);
        }
        const theme = readdirSync(dir, { recursive: true })
          .filter((file) => file.endsWith(".css"))
          .map(read)
          .join("\n");
        assert.doesNotMatch(theme, /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny|@import\s+url\(\s*["']?https?:/);
      });

      it("keeps each font's license next to it", () => {
        const fontFiles = readdirSync(fontsDir);
        for (const font of fontFiles.filter((file) => file.endsWith(".woff2"))) {
          const family = font.split("-latin")[0];
          assert.ok(fontFiles.includes(`${family}-OFL.txt`), `${font} has no ${family}-OFL.txt`);
        }
      });
    });

    // site-kit-themes, "A theme styles every hook".
    describe("coverage", () => {
      const styled = () => new Set([...styles.matchAll(/\.(sk-[a-z0-9_-]+)/g)].map((m) => m[1]));

      it("styles every hook in HOOKS.md, and no other sk- class", () => {
        const unstyled = [...hooks].filter((hook) => !deprecated.has(hook) && !styled().has(hook));
        const unknown = [...styled()].filter((name) => !hooks.has(name));
        assert.deepEqual(unknown, [], `${example}'s theme styles classes HOOKS.md doesn't list`);
        assert.deepEqual(unstyled, [], `${example}'s theme leaves hooks unstyled`);
      });

      it("styles every state in HOOKS.md", () => {
        const unstyled = [...states].filter((state) => !deprecated.has(state) && !styles.includes(`[${state}`));
        assert.deepEqual(unstyled, [], `${example}'s theme leaves states unstyled`);
      });

      it("styles no deprecated hook", () => {
        const used = [...deprecated].filter(([hook]) => styled().has(hook) || styles.includes(`[${hook}`));
        assert.deepEqual(used.map(([hook, { replacement }]) => `${hook}, use ${replacement ?? "nothing"}`), [], `${example}'s theme styles deprecated hooks`);
      });

      it("uses plain CSS, no @apply", () => {
        assert.doesNotMatch(styles, /@apply\b/);
      });

      // design D31: a plain rule gets only the properties it names.
      it("reads all four properties of every text role a rule uses", () => {
        const incomplete = [];
        for (const rule of rules) {
          const declarations = rule.declarations.join(";");
          const roles = new Set([...declarations.matchAll(/var\(\s*--text-([a-z0-9-]+)\s*[,)]/g)].map((m) => m[1]).filter((role) => !role.includes("--")));
          for (const role of roles) {
            const missing = ["line-height", "letter-spacing", "font-weight"].filter((part) => !declarations.includes(`var(--text-${role}--${part})`));
            if (missing.length > 0) incomplete.push(`${rule.file}:${rule.line} ${rule.selector}: --text-${role} without ${missing.join(", ")}`);
          }
        }
        assert.deepEqual(incomplete, [], `${example}'s theme has incomplete type rules`);
      });
    });

    // site-kit-themes, "Theme accessibility duties".
    describe("accessibility duties", () => {
      it("gives focus a visible style", () => assert.match(styles, /:focus-visible/));

      it("shows the skip link on focus", () => assert.match(styles, /\.sk-skip-link:focus(-visible)?\b/));

      it("hides the menu only once the script has run", () => {
        assert.match(styles, /\.sk-menu\[data-ready\]:not\(\[data-open\]\)/);
      });

      it("sets display on a hidden element only with :not([hidden])", () => {
        assert.ok(HIDDEN.includes("sk-header__menu-button"), `the kit's hidden elements: ${HIDDEN.join(", ")}`);
        const unguarded = [];
        for (const rule of rules) {
          if (!rule.declarations.some((declaration) => /^display\s*:/.test(declaration))) continue;
          for (const subject of subjects(rule)) {
            for (const name of HIDDEN) {
              if (subject.includes(`.${name}`) && !subject.includes(":not([hidden])")) unguarded.push(`${rule.file}:${rule.line} ${rule.selector}`);
            }
          }
        }
        assert.deepEqual(unguarded, [], `${example}'s theme shows hidden elements before the script runs`);
      });

      it("turns motion off for reduced motion", () => {
        if (/\b(transition|animation)(-[a-z-]+)?\s*:\s*(?!none\b)/.test(styles)) assert.match(styles, /prefers-reduced-motion/);
      });
    });
  });
}
