// Checks a site's styles (site-kit-design-system design D34):
//
//   npm run check:styles              the source check, before the build
//   npm run check:styles -- --built   the output check, after the build
//
// The source check reports, as errors, in the site's src/**/*.css and
// src/**/*.astro:
// - raw colors (hex, color functions, named colors) outside the color scheme
//   (theme/tokens/colors.css and theme/presets/colors/), and font family
//   names outside theme/tokens/type.css and theme/fonts.css, in CSS
//   declarations, <style> blocks and style attributes;
// - arbitrary Tailwind values, such as text-[44px], in class attributes;
// - in theme/ and site.css, `sk-` classes and their data-/aria- attributes
//   that the installed kit's HOOKS.md doesn't list;
// - color presets that define other color names than the active one, or
//   that fail a contrast pair from the theme's README.md.
// It warns about hooks HOOKS.md lists as deprecated.
//
// The output check warns about every `sk-` class in the built pages that no
// rule in theme/ or site.css styles. Only errors fail the command.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readHooks } from "./hooks-reference.mjs";

const THEME = "src/styles/theme/";
const SITE_CSS = "src/styles/site.css";
const COLORS = `${THEME}tokens/colors.css`;
const PRESETS = `${THEME}presets/colors/`;
const README = `${THEME}README.md`;
const FONT_FILES = [`${THEME}tokens/type.css`, `${THEME}fonts.css`];

// Where raw colors and font names belong.
export const rawColorAllowed = (file) => file === COLORS || file.startsWith(PRESETS);
export const fontNameAllowed = (file) => FONT_FILES.includes(file);
// The files whose rules style the kit's hooks.
const stylesHooks = (file) => (file.startsWith(THEME) || file === SITE_CSS) && file.endsWith(".css");

// CSS named colors (CSS Color Module Level 4). transparent and currentColor
// are no raw colors.
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray " +
    "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
    "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue " +
    "mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
    "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue " +
    "slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen"
  ).split(" "),
);
const HEX = /#[0-9a-f]{3,8}(?![\w-])/gi;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const FONT_KEYWORDS = /^(?:inherit|initial|unset|revert|revert-layer)$/i;

const lineAt = (text, index) => text.slice(0, index).split("\n").length;
// Comments become spaces, so positions stay the same.
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

// Raw values in CSS text. `offset` places the text in its file, for line numbers.
export function cssFindings(css, offset = 0, fileText = css) {
  const text = withoutComments(css);
  const findings = [];
  const report = (index, value, kind) => findings.push({ line: lineAt(fileText, offset + index), value, kind });
  // A declaration ends with ";" or "}", which tells it from a selector such as a:hover {.
  for (const match of text.matchAll(/(?<![\w-])((?:--)?[a-z][\w-]*)\s*:\s*([^;{}]+?)\s*(?=[;}]|$)/gi)) {
    const [, property, value] = match;
    const at = match.index + match[0].indexOf(value);
    if (property.toLowerCase() === "font-family" && !/^var\(/i.test(value) && !FONT_KEYWORDS.test(value)) {
      report(at, value, "font name");
      continue;
    }
    for (const hex of value.matchAll(HEX)) report(at + hex.index, hex[0], "raw color");
    for (const fn of value.matchAll(COLOR_FUNCTION)) report(at + fn.index, `${fn[0]}…)`, "raw color");
    const unquoted = value.replace(/"[^"]*"|'[^']*'/g, (s) => " ".repeat(s.length));
    for (const word of unquoted.matchAll(/[a-z]+/gi)) {
      if (NAMED_COLORS.has(word[0].toLowerCase()) && !/var\([^)]*$/.test(unquoted.slice(0, word.index))) {
        report(at + word.index, word[0], "raw color");
      }
    }
  }
  return findings;
}

// Raw values in an .astro file: its <style> blocks, style attributes and class lists.
export function astroFindings(text) {
  const findings = [];
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    findings.push(...cssFindings(match[1], match.index + match[0].indexOf(match[1]), text));
  }
  for (const match of text.matchAll(/\sstyle=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const css = match[1] ?? match[2] ?? match[3];
    findings.push(...cssFindings(`x{${css}}`, match.index + match[0].indexOf(css) - 2, text));
  }
  // A class name with brackets or parentheses is an arbitrary Tailwind value
  // or property: text-[44px], md:bg-[#fff], [mask-type:alpha], bg-(--name).
  // In class:list={...} and class={...}, the class names are the quoted strings.
  for (const match of text.matchAll(/\sclass(?::list)?=(?:"([^"]*)"|\{([^}]*)\})/g)) {
    const start = match.index + match[0].indexOf(match[1] ?? match[2]);
    const strings =
      match[1] !== undefined
        ? [{ text: match[1], index: 0 }]
        : [...match[2].matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)].map((m) => ({ text: m[1] ?? m[2] ?? m[3], index: m.index + 1 }));
    for (const string of strings) {
      for (const name of string.text.matchAll(/\S+/g)) {
        if (/\[.*\]|\(--[\w-]+\)/.test(name[0])) findings.push({ line: lineAt(text, start + string.index + name.index), value: name[0], kind: "arbitrary value" });
      }
    }
  }
  return findings;
}

// Every style rule in CSS text: its selector, its line, the selectors of the
// rules it is nested in, and its own declarations, such as "display: none".
// At-rules (@media, @variant) hold rules but are none themselves: a
// declaration inside one nested in a rule belongs to that rule. Strings are
// blanked, so a declaration's quoted value reads as spaces.
export function cssRules(css) {
  const text = withoutComments(css).replace(/"[^"\n]*"|'[^'\n]*'/g, (s) => " ".repeat(s.length));
  const rules = [];
  const stack = [];
  let start = 0;
  const declare = (end) => {
    const declaration = text.slice(start, end).trim();
    const rule = stack.findLast(Boolean);
    if (declaration && rule) rule.declarations.push(declaration);
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "{") {
      const prelude = text.slice(start, i);
      const selector = prelude.trim();
      const rule =
        selector && !selector.startsWith("@")
          ? { selector, line: lineAt(css, start + prelude.length - prelude.trimStart().length), ancestors: stack.filter(Boolean).map((parent) => parent.selector), declarations: [] }
          : null;
      if (rule) rules.push(rule);
      stack.push(rule);
      start = i + 1;
    } else if (char === "}") {
      declare(i);
      stack.pop();
      start = i + 1;
    } else if (char === ";") {
      declare(i);
      start = i + 1;
    }
  }
  return rules;
}

const SK_CLASS = /\.(sk-[a-z0-9_-]+)/g;
const HOOK_ATTRIBUTE = /\[\s*((?:data|aria)-[a-z0-9-]+)/g;

// The hooks a CSS file's rules name, each with its line: `sk-` classes, and
// data-/aria- attributes in a rule on an `sk-` class.
export function styledHooks(css) {
  const hooks = [];
  for (const { selector, line, ancestors } of cssRules(css)) {
    for (const [, name] of selector.matchAll(SK_CLASS)) hooks.push({ name, line, kind: "class" });
    if ([selector, ...ancestors].some((s) => s.includes(".sk-"))) {
      for (const [, name] of selector.matchAll(HOOK_ATTRIBUTE)) hooks.push({ name, line, kind: "attribute" });
    }
  }
  return hooks;
}

// A color as linear sRGB channels, or null when it can't be computed. `vars`
// resolves var(--color-...) references within the same preset.
export function linearRgb(value, vars = new Map(), seen = new Set()) {
  const v = value.trim().toLowerCase();
  const reference = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (reference) {
    if (seen.has(reference[1]) || !vars.has(reference[1])) return null;
    return linearRgb(vars.get(reference[1]), vars, new Set([...seen, reference[1]]));
  }
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const hex = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1].slice(0, 3)].map((d) => d + d) : hex[1].slice(0, 6).match(/../g);
    return digits.map((d) => toLinear(parseInt(d, 16) / 255));
  }
  const fn = v.match(/^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/);
  if (!fn) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  const number = (part, scale) => (part.endsWith("%") ? (parseFloat(part) / 100) * scale : parseFloat(part));
  if (fn[1].startsWith("rgb")) {
    const channels = parts.slice(0, 3).map((part) => number(part, 255) / 255);
    return channels.length === 3 && channels.every(Number.isFinite) ? channels.map(toLinear) : null;
  }
  if (fn[1].startsWith("hsl")) {
    const [h, s, l] = [parseFloat(parts[0]), number(parts[1] ?? "", 1), number(parts[2] ?? "", 1)];
    if (![h, s, l].every(Number.isFinite)) return null;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map((n) => toLinear(l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  }
  // oklch(L C H): through OKLab to linear sRGB.
  const [L, C, H] = [number(parts[0] ?? "", 1), number(parts[1] ?? "", 0.4), parseFloat(parts[2])];
  if (![L, C, H].every(Number.isFinite)) return null;
  const [a, b] = [C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
  const [l, m, s] = [L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.291485548 * b].map((x) => x ** 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

// The WCAG contrast ratio of two colors, or null when either can't be computed.
export function contrastRatio(a, b, vars) {
  const [x, y] = [linearRgb(a, vars), linearRgb(b, vars)];
  if (!x || !y) return null;
  const luminance = ([r, g, bl]) => 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  const [light, dark] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (light + 0.05) / (dark + 0.05);
}

// The color names and values a preset defines, without its reset.
export function presetColors(css) {
  return new Map([...withoutComments(css).matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

// The pairs in the theme README's contrast table: text, background, minimum.
export function contrastPairs(markdown) {
  return [...markdown.matchAll(/^\| `(--color-[a-z0-9-]+)` \| `(--color-[a-z0-9-]+)` \| ([\d.]+) \|/gm)].map((m) => ({ text: m[1], background: m[2], minimum: Number(m[3]) }));
}

// Color presets: the same names as the active one, and every contrast pair met.
function presetFindings(root) {
  const dir = join(root, PRESETS);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((file) => file.endsWith(".css")).sort();
  if (files.length === 0) return [];
  const findings = [];
  const presets = new Map(files.map((file) => [file, presetColors(readFileSync(join(dir, file), "utf8"))]));
  const active = existsSync(join(root, COLORS)) ? readFileSync(join(root, COLORS), "utf8").match(/presets\/colors\/([\w-]+\.css)/)?.[1] : undefined;
  const reference = presets.has(active) ? active : files[0];

  for (const [file, colors] of presets) {
    if (file === reference) continue;
    const names = presets.get(reference);
    for (const name of names.keys()) {
      if (!colors.has(name)) findings.push({ file: PRESETS + file, kind: "missing color", value: name, detail: `${reference} defines it` });
    }
    for (const name of colors.keys()) {
      if (!names.has(name)) findings.push({ file: PRESETS + file, kind: "extra color", value: name, detail: `${reference} doesn't define it` });
    }
  }

  const pairs = existsSync(join(root, README)) ? contrastPairs(readFileSync(join(root, README), "utf8")) : [];
  if (pairs.length === 0) {
    findings.push({ file: README, kind: "no contrast table", value: "| Text | Background | Minimum |", detail: "list the pairs the theme's rules use" });
    return findings;
  }
  for (const [file, colors] of presets) {
    for (const { text, background, minimum } of pairs) {
      const value = `${text} on ${background}`;
      if (!colors.has(text) || !colors.has(background)) {
        findings.push({ file: PRESETS + file, kind: "contrast", value, detail: `${colors.has(text) ? background : text} isn't defined` });
        continue;
      }
      const ratio = contrastRatio(colors.get(text), colors.get(background), colors);
      if (ratio === null) findings.push({ file: PRESETS + file, kind: "contrast", value, detail: "can't compute a color: use hex, rgb(), hsl() or oklch()" });
      else if (ratio < minimum) findings.push({ file: PRESETS + file, kind: "contrast", value, detail: `${ratio.toFixed(2)}:1, below ${minimum}:1` });
    }
  }
  return findings;
}

function* filesUnder(dir, pattern) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* filesUnder(path, pattern);
    else if (pattern.test(entry.name)) yield path;
  }
}

const relativeTo = (root, path) => relative(root, path).split("\\").join("/");

// The source check: errors and warnings for root/src, files relative to root.
// `hooks` is the hook reference, the installed kit's by default.
export function checkStyles(root, { hooks = readHooks() } = {}) {
  const errors = [];
  const warnings = [];
  let files = 0;
  const known = new Set([...hooks.classes, ...hooks.states, ...hooks.attributes]);
  for (const path of filesUnder(join(root, "src"), /\.(css|astro)$/)) {
    const file = relativeTo(root, path);
    const text = readFileSync(path, "utf8");
    files++;
    for (const finding of file.endsWith(".css") ? cssFindings(text) : astroFindings(text)) {
      if (finding.kind === "raw color" && rawColorAllowed(file)) continue;
      if (finding.kind === "font name" && fontNameAllowed(file)) continue;
      errors.push({ file, ...finding });
    }
    if (!stylesHooks(file)) continue;
    for (const { name, line } of styledHooks(text)) {
      const old = hooks.deprecated.get(name);
      if (old) warnings.push({ file, line, kind: "deprecated hook", value: name, detail: old.replacement ? `use ${old.replacement}` : "no replacement" });
      else if (!known.has(name)) errors.push({ file, line, kind: "unknown hook", value: name, detail: "the installed kit's HOOKS.md doesn't list it" });
    }
  }
  errors.push(...presetFindings(root));
  return { files, errors, warnings };
}

// The class names in CSS selectors, unescaped: `.md\:grid-cols-3` gives
// "md:grid-cols-3". Numbers such as `.5rem` add names that match no class.
export function cssClasses(css) {
  const names = new Set();
  for (const [, raw] of css.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\[^0-9a-fA-F\s]|[\w-])+)/g)) {
    names.add(raw.replace(/\\([0-9a-fA-F]{1,6}) ?|\\(.)/g, (_, hex, char) => (hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : char)));
  }
  return names;
}

// Classes that need no rule of their own: Tailwind's group and peer markers,
// and the language hints Markdown puts on code.
const RULELESS = /^(group|peer)(\/.*)?$|^language-/;

// The output check: `sk-` classes in root/dist that no theme or site.css rule
// styles, and other classes that no rule in the built CSS matches, such as a
// Tailwind default the theme resets (site-kit-design-system design D34).
export function checkBuilt(root) {
  const dist = join(root, "dist");
  if (!existsSync(dist)) return { pages: 0, errors: [{ file: "dist", kind: "no build", value: "dist/", detail: "run npm run build first" }], warnings: [] };
  const styled = new Set();
  for (const path of filesUnder(join(root, "src", "styles"), /\.css$/)) {
    if (!stylesHooks(relativeTo(root, path))) continue;
    for (const { name, kind } of styledHooks(readFileSync(path, "utf8"))) if (kind === "class") styled.add(name);
  }
  const built = new Set();
  for (const path of filesUnder(dist, /\.css$/)) for (const name of cssClasses(readFileSync(path, "utf8"))) built.add(name);
  const unstyled = new Map();
  const ruleless = new Map();
  let pages = 0;
  for (const path of filesUnder(dist, /\.html$/)) {
    pages++;
    const page = relativeTo(dist, path);
    for (const [, list] of readFileSync(path, "utf8").matchAll(/\sclass="([^"]*)"/g)) {
      for (const name of list.split(/\s+/)) {
        if (!name) continue;
        if (name.startsWith("sk-")) {
          if (!styled.has(name) && !unstyled.has(name)) unstyled.set(name, page);
        } else if (!built.has(name) && !RULELESS.test(name) && !ruleless.has(name)) {
          ruleless.set(name, page);
        }
      }
    }
  }
  const warnings = [
    ...[...unstyled].map(([name, page]) => ({ file: `dist/${page}`, kind: "unstyled hook", value: name, detail: "no rule in src/styles/theme/ or site.css styles it" })),
    ...[...ruleless].map(([name, page]) => ({
      file: `dist/${page}`,
      kind: "class without a rule",
      value: name,
      detail: "the built CSS has no rule for it: a Tailwind default the theme resets, a plugin's class or a typo. Use the theme's tokens",
    })),
  ];
  return { pages, errors: [], warnings };
}

const format = ({ file, line, kind, value, detail }) => `  ${file}${line ? `:${line}` : ""}: ${kind} ${JSON.stringify(value)}${detail ? ` (${detail})` : ""}`;

// `site-kit check-styles [--built]` (bin/site-kit.mjs), in the site's root.
export function cli(args = []) {
  const built = args.includes("--built");
  const result = built ? checkBuilt(process.cwd()) : checkStyles(process.cwd());
  if (result.warnings.length > 0) {
    console.warn(`${result.warnings.length} warnings:`);
    for (const warning of result.warnings) console.warn(format(warning));
  }
  if (result.errors.length > 0) {
    console.error(`${result.errors.length} problems. Use the theme's tokens and the hooks in HOOKS.md:`);
    for (const error of result.errors) console.error(format(error));
    process.exit(1);
  }
  console.log(built ? `Checked the classes in ${result.pages} built pages.` : `No problems in ${result.files} style files.`);
}
