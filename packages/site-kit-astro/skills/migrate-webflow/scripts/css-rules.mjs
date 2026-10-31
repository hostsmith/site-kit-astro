#!/usr/bin/env node
// The Webflow migration's CSS rules (site-kit-migration-cost design D147):
// the rules of the export's stylesheets that a step needs, so the agent never
// reads a stylesheet whole.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/css-rules.mjs --variables
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/css-rules.mjs --elements
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/css-rules.mjs --fonts
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/css-rules.mjs navbar_component button w-tab-link
//
// It reads every stylesheet in --dir, .hostsmith/snapshot/code/css/ by
// default, but normalize.css: the site's own first, then webflow.css, whose
// rules are the builder's defaults. --page adds a page's <style> blocks, such
// as Client-First's global styles embed, as a stylesheet of its own.
// - --variables prints each rule that sets a custom property, with those
//   properties alone, such as Webflow's variables in :root and what each
//   media query sets again.
// - --elements prints the rules whose selectors name no class and no id,
//   such as body, h1 and a:hover.
// - --fonts prints the @font-face rules.
// - Class names print every rule whose selectors name one of them, with its
//   states and combo classes, such as .button.is-secondary:hover.
// Rules print one per line, grouped by stylesheet and by media query, in the
// stylesheet's order. The values of the variables the printed rules use
// follow, with what each media query sets them to. It reads the stylesheets
// as text and runs nothing.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { UsageError } from "./browser.mjs";

const DIR = ".hostsmith/snapshot/code/css";

// The index of `char` in `text` from `from`, outside strings and brackets.
function scan(text, from, chars) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      i = end === -1 ? text.length : end;
    } else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && chars.includes(c)) return i;
  }
  return -1;
}

// The index of the `}` that closes the block opened just before `from`.
function closing(text, from) {
  let depth = 1;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      i = end === -1 ? text.length : end;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return text.length;
}

/** A declaration block's declarations, as [property, value] pairs. */
export function declarationsOf(body) {
  const out = [];
  let at = 0;
  while (at < body.length) {
    let end = scan(body, at, ";");
    if (end === -1) end = body.length;
    const part = body.slice(at, end).trim();
    const colon = part.indexOf(":");
    if (colon > 0) out.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, " ")]);
    at = end + 1;
  }
  return out;
}

/**
 * A stylesheet's rules, in order: `{ media, selector, declarations }` for a
 * style rule, with `media` the at-rules around it, such as "@media screen and
 * (max-width: 991px)", and `{ media, atRule, body }` for @font-face and the
 * like.
 */
export function rulesOf(css) {
  const rules = [];
  const walk = (text, media) => {
    let at = 0;
    while (at < text.length) {
      const open = scan(text, at, "{;");
      if (open === -1) break;
      const prelude = text.slice(at, open).trim().replace(/\s+/g, " ");
      if (text[open] === ";") {
        at = open + 1;
        continue;
      }
      const end = closing(text, open + 1);
      const body = text.slice(open + 1, end);
      if (/^@(media|supports|container|layer|document)\b/i.test(prelude)) walk(body, [...media, prelude]);
      else if (prelude.startsWith("@")) rules.push({ media, atRule: prelude, body: body.trim().replace(/\s+/g, " ") });
      else if (prelude) rules.push({ media, selector: prelude, declarations: declarationsOf(body) });
      at = end + 1;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""), []);
  return rules;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const selectorsOf = (selector) => {
  const out = [];
  let at = 0;
  while (at <= selector.length) {
    let end = scan(selector, at, ",");
    if (end === -1) end = selector.length;
    out.push(selector.slice(at, end).trim());
    at = end + 1;
  }
  return out.filter(Boolean);
};
// A data: URL, such as webflow.css's icon font, as its length.
const shorten = (text) => text.replace(/url\(\s*(["']?)data:([^;,)]*)[^)]*\)/g, (whole, quote, type) => `url(data:${type}... ${whole.length} characters)`);
const format = (rule) => shorten(rule.atRule ? `${rule.atRule} { ${rule.body} }` : `${rule.selector} { ${rule.declarations.map(([property, value]) => `${property}: ${value}`).join("; ")} }`);
const varsIn = (value) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);

/**
 * The rules of `sheets`, each `{ name, css }`, that a query asks for:
 * `variables`, `elements`, `fonts` or `classes`. Returns the text to print.
 */
export function query(sheets, { variables = false, elements = false, fonts = false, classes = [] }) {
  const parsed = sheets.map((sheet) => ({ ...sheet, rules: rulesOf(sheet.css) }));
  const patterns = classes.map((name) => new RegExp(`\\.${escape(name.replace(/^\./, ""))}(?![\\w-])`));
  const found = new Set();
  const used = new Set();
  const out = [];
  for (const sheet of parsed) {
    const groups = new Map();
    for (const rule of sheet.rules) {
      let shown;
      if (rule.atRule) {
        if (fonts && /^@font-face/i.test(rule.atRule)) shown = rule;
      } else {
        const matched = patterns.filter((pattern) => pattern.test(rule.selector));
        matched.forEach((pattern) => found.add(pattern));
        const element = elements && selectorsOf(rule.selector).some((selector) => !/[.#]|\[(class|data-w)/.test(selector) && selector !== ":root");
        const declarations = rule.declarations.filter(([property]) => (property.startsWith("--") ? variables : matched.length > 0 || element));
        if (declarations.length) shown = { ...rule, declarations };
      }
      if (!shown) continue;
      if (shown.declarations) shown.declarations.forEach(([, value]) => varsIn(value).forEach((name) => used.add(name)));
      const media = shown.media.join(" ");
      if (!groups.has(media)) groups.set(media, []);
      groups.get(media).push(format(shown));
    }
    if (groups.size === 0) continue;
    out.push(`## ${sheet.name}`);
    for (const [media, lines] of groups) {
      if (media) out.push(media, ...lines.map((line) => `  ${line}`));
      else out.push(...lines);
    }
    out.push("");
  }
  // The values of the variables the rules use, and of those they use.
  if (used.size && !variables) {
    const definitions = new Map();
    for (const sheet of parsed) {
      for (const rule of sheet.rules) {
        for (const [property, value] of rule.declarations ?? []) {
          if (!property.startsWith("--")) continue;
          if (!definitions.has(property)) definitions.set(property, []);
          definitions.get(property).push({ media: rule.media.join(" "), selector: rule.selector, value });
        }
      }
    }
    const queue = [...used];
    for (let i = 0; i < queue.length; i++) for (const { value } of definitions.get(queue[i]) ?? []) for (const name of varsIn(value)) if (!queue.includes(name)) queue.push(name);
    out.push("## Variables they use");
    for (const name of queue) {
      const values = definitions.get(name);
      if (!values) {
        out.push(`${name}: not defined`);
        continue;
      }
      // The first value, then each one set again that differs from it.
      const [first, ...again] = values;
      const where = ({ media, selector }) => [media, selector !== ":root" ? `on ${selector}` : ""].filter(Boolean).join(" ");
      const shown = [first, ...again.filter(({ value }) => value !== first.value)];
      out.push(`${name}: ${shown.map((entry) => (where(entry) ? `${entry.value} (${where(entry)})` : entry.value)).join(", ")}`);
    }
    out.push("");
  }
  const missing = classes.filter((_, i) => !found.has(patterns[i]));
  if (missing.length) out.push(`No rule names ${missing.map((name) => `.${name.replace(/^\./, "")}`).join(", ")}.`);
  if (out.length === 0) out.push("No rule matches.");
  return `${out.join("\n").trim()}\n`;
}

// The stylesheets: the site's own, then webflow.css, then each page's <style>
// blocks.
function sheetsOf(dir, pages) {
  if (!existsSync(dir)) throw new UsageError(`${dir} doesn't exist. Run this in the site's folder, after step 1, or name the stylesheets' folder with --dir.`);
  const files = readdirSync(dir).filter((file) => file.endsWith(".css") && file !== "normalize.css");
  files.sort((a, b) => (a === "webflow.css") - (b === "webflow.css") || a.localeCompare(b));
  const sheets = files.map((file) => ({ name: file, css: readFileSync(join(dir, file), "utf8") }));
  for (const page of pages) {
    const styles = [...readFileSync(page, "utf8").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(([, css]) => css);
    if (styles.length) sheets.push({ name: `${basename(page)}'s <style>`, css: styles.join("\n") });
  }
  return sheets;
}

function main({ values, positionals }) {
  const asked = { variables: values.variables ?? false, elements: values.elements ?? false, fonts: values.fonts ?? false, classes: positionals };
  if (!asked.variables && !asked.elements && !asked.fonts && positionals.length === 0) throw new UsageError("Ask for --variables, --elements, --fonts or class names. See the usage at the top of this script.");
  process.stdout.write(query(sheetsOf(values.dir ?? DIR, values.page ?? []), asked));
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(parseArgs({ allowPositionals: true, options: { variables: { type: "boolean" }, elements: { type: "boolean" }, fonts: { type: "boolean" }, dir: { type: "string" }, page: { type: "string", multiple: true } } }));
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
