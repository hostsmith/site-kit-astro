#!/usr/bin/env node
// The Webflow migration's page outline (site-kit-migration-cost design D147):
// an export page as one line per element that matters, so the agent reads
// its content and structure without its markup.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/outline.mjs \
//     .hostsmith/snapshot/code/index.html .hostsmith/snapshot/code/about.html
//
// For each page: its title, description and Open Graph tags, and the head's
// scripts and stylesheets that aren't Webflow's own, then its body. Each line
// is an element, indented by its depth: its tag (none for a div), id and
// classes, then the attributes that matter, such as a link's href, an image's
// src and alt, a form field's name, an interaction's data-w-id and the style
// Webflow sets for it, then its text, with inline elements as
// {span.class: text}. A chain of wrappers with nothing of their own is one
// line, joined by ">". An SVG shows as its viewBox, a <style> as its length:
// css-rules.mjs reads it. A block of 300 characters or more that an earlier
// page of the same call printed, such as the header and the footer, shows as
// "same as in <page>", so name every page in one call. It reads the pages as
// text and runs nothing.
//
// --notes prints only what step 2 notes for each page: the head's scripts and
// stylesheets, each form with its fields, each embed, video, iframe, script
// and <style>, each element an interaction names by its data-w-id, and the
// page's links.
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { ELEMENT_NODE, parse, TEXT_NODE } from "ultrahtml";
import { UsageError } from "./browser.mjs";
import { decode } from "./content.mjs";

const SKIPPED = new Set(["head", "noscript", "template", "link", "meta", "title"]);
const INLINE = new Set(["a", "abbr", "b", "br", "cite", "code", "del", "em", "i", "ins", "kbd", "mark", "q", "s", "small", "span", "strong", "sub", "sup", "time", "u"]);
// The attributes a line shows, in this order, besides the id and classes.
const SHOWN = ["href", "src", "alt", "type", "name", "placeholder", "value", "for", "action", "method", "role", "aria-label", "title", "target", "data-w-id"];
const FLAGS = ["required", "checked", "selected", "multiple", "disabled", "hidden", "autoplay", "loop", "muted", "playsinline", "controls"];
// Webflow's own scripts, which the migration never carries.
const WEBFLOW_SCRIPT = /webflow\.js|jquery|d3e54v103j8qbb\.cloudfront\.net|website-files\.com|w-mod-/i;
const REPEATED = 300;

const space = (text) => decode(text).replace(/\s+/g, " ");
const nameOf = (node) => node.name.toLowerCase();
const attributesOf = (node) => node.attributes ?? {};
const classesOf = (node) => String(attributesOf(node).class ?? "").split(/\s+/).filter(Boolean);
const quote = (text) => `"${text.replaceAll('"', '\\"')}"`;
const children = (node) => (node.children ?? []).filter((child) => child.type === TEXT_NODE || (child.type === ELEMENT_NODE && !SKIPPED.has(nameOf(child))));
const elementsOf = (node) => children(node).filter((child) => child.type === ELEMENT_NODE);
const ownText = (node) => children(node).filter((child) => child.type === TEXT_NODE).map((child) => space(child.value)).join("").trim();

/**
 * The style Webflow writes for an interaction's start, without vendor
 * prefixes and identity transforms: `opacity:0; transform:translate3d(0, 20px, 0)`.
 */
export function compactStyle(style) {
  const identity = /\b(?:scale3d\(1,\s*1,\s*1\)|scale\(1(?:,\s*1)?\)|rotate[XYZ]?\(0(?:deg)?\)|skew\(0(?:deg)?,\s*0(?:deg)?\)|translate3d\(0(?:px)?,\s*0(?:px)?,\s*0(?:px)?\))\s*/gi;
  return decode(style)
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !/^-(?:webkit|moz|ms|o)-/i.test(part))
    .map((part) => {
      const [property, ...rest] = part.split(":");
      let value = rest.join(":").trim().replace(/(\d)PX\b/g, "$1px");
      if (/^transform$/i.test(property.trim())) value = value.replace(identity, "").trim();
      return value ? `${property.trim()}:${value}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

// An element's tag, none for a div, its id and its classes.
const baseOf = (node) => `${nameOf(node) === "div" ? "" : nameOf(node)}${attributesOf(node).id ? `#${attributesOf(node).id}` : ""}${classesOf(node).map((name) => `.${name}`).join("")}` || nameOf(node);

// An element's tag, id, classes and the attributes that matter.
function labelOf(node) {
  const attributes = attributesOf(node);
  const extras = [];
  for (const key of SHOWN) {
    if (attributes[key] === undefined) continue;
    const value = space(String(attributes[key])).trim();
    extras.push(key === "href" || key === "src" ? value : key === "alt" || key === "aria-label" || key === "title" || key === "placeholder" || key === "value" ? `${key} ${quote(value)}` : `${key}=${value}`);
  }
  if (attributes.style) {
    const style = compactStyle(String(attributes.style));
    if (style) extras.push(`style ${quote(style)}`);
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith("data-") && key !== "data-w-id" && !key.startsWith("data-wf-")) extras.push(`${key}=${String(value).length > 60 ? `${String(value).slice(0, 57)}...` : value}`);
  }
  for (const flag of FLAGS) if (attributes[flag] !== undefined) extras.push(flag);
  return [baseOf(node), ...extras].join(" ");
}

const textLike = (node) => children(node).every((child) => child.type === TEXT_NODE || (INLINE.has(nameOf(child)) && textLike(child)));

// A text-like element's text, with its inline elements marked.
function inline(node) {
  const text = children(node)
    .map((child) => {
      if (child.type === TEXT_NODE) return space(child.value);
      const name = nameOf(child);
      if (name === "br") return "{br}";
      const inner = inline(child);
      const label = labelOf(child);
      return label === name && (name === "span" || name === "time") ? inner : `{${label}: ${inner}}`;
    })
    .join("");
  return text.replace(/ {2,}/g, " ").trim();
}

// Whether an element has nothing of its own: no text, no attribute shown.
const bare = (node) => labelOf(node) === baseOf(node) && !ownText(node);

function scriptLine(node) {
  const attributes = attributesOf(node);
  if (attributes.src) return WEBFLOW_SCRIPT.test(String(attributes.src)) ? undefined : `script ${attributes.src}`;
  const code = children(node).map((child) => child.value ?? "").join("").trim();
  if (!code || WEBFLOW_SCRIPT.test(code)) return undefined;
  const short = code.replace(/\s+/g, " ");
  return `script ${quote(short.length > 200 ? `${short.slice(0, 197)}...` : short)} (${code.length} characters)`;
}

// The lines of `node` and what it holds, at `depth`: `full`, all of them, and
// `shown`, with the blocks an earlier page printed, such as the header, as
// one line each.
function linesOf(node, depth, context) {
  const indent = "  ".repeat(depth);
  const name = nameOf(node);
  const leaf = (line) => (line === undefined ? { full: [], shown: [] } : { full: [`${indent}${line}`], shown: [`${indent}${line}`] });
  if (name === "script") return leaf(scriptLine(node));
  if (name === "style") return leaf(`style (${children(node).map((child) => child.value ?? "").join("").trim().length} characters)`);
  if (name === "svg") {
    const viewBox = attributesOf(node).viewbox ?? attributesOf(node).viewBox;
    return leaf(`${labelOf(node)}${viewBox ? ` viewBox ${quote(String(viewBox))}` : ""}`);
  }
  if (textLike(node)) {
    const text = inline(node);
    const label = labelOf(node);
    return leaf(!text && label === name && name === "div" ? undefined : `${label}${text ? ` ${quote(text)}` : ""}`);
  }
  const elements = elementsOf(node);
  const lines = { full: [], shown: [] };
  if (bare(node) && elements.length === 1) {
    const inner = linesOf(elements[0], depth, context);
    for (const part of ["full", "shown"]) {
      const [first, ...rest] = inner[part];
      if (first !== undefined) lines[part] = [`${indent}${labelOf(node)} > ${first.slice(indent.length)}`, ...rest];
    }
  } else {
    lines.full.push(`${indent}${labelOf(node)}`);
    lines.shown.push(`${indent}${labelOf(node)}`);
    for (const child of children(node)) {
      if (child.type === TEXT_NODE) {
        const text = space(child.value).trim();
        if (!text) continue;
        lines.full.push(`${indent}  ${quote(text)}`);
        lines.shown.push(`${indent}  ${quote(text)}`);
      } else {
        const inner = linesOf(child, depth + 1, context);
        lines.full.push(...inner.full);
        lines.shown.push(...inner.shown);
      }
    }
  }
  const key = lines.full.map((line) => line.slice(indent.length)).join("\n").replaceAll(".w--current", "");
  if (key.length >= REPEATED) {
    const first = context.seen.get(key);
    if (first && first !== context.page) return { full: lines.full, shown: [`${lines.full[0]} … same as in ${first}`] };
    if (!first) context.seen.set(key, context.page);
  }
  return lines;
}

function find(node, test, found = []) {
  if (node.type === ELEMENT_NODE && test(node)) found.push(node);
  for (const child of node.children ?? []) find(child, test, found);
  return found;
}

// A page's head: its title, description and Open Graph tags, and its scripts
// and stylesheets that aren't Webflow's own.
function headLines(document, { tags = true } = {}) {
  const lines = [];
  const title = find(document, (node) => nameOf(node) === "title")[0];
  if (title && tags) lines.push(`title: ${inline(title)}`);
  for (const meta of tags ? find(document, (node) => nameOf(node) === "meta") : []) {
    const { name, property, content } = attributesOf(meta);
    const key = String(name ?? property ?? "");
    if ((key === "description" || /^og:(title|description|image)$/.test(key)) && content) lines.push(`${key}: ${space(String(content)).trim()}`);
  }
  const head = find(document, (node) => nameOf(node) === "head")[0];
  if (head) {
    for (const link of find(head, (node) => nameOf(node) === "link" && /stylesheet/i.test(String(attributesOf(node).rel ?? "")) && /^(https?:)?\/\//.test(String(attributesOf(node).href ?? "")))) lines.push(`head: link ${attributesOf(link).href}`);
    for (const script of find(head, (node) => nameOf(node) === "script")) {
      const line = scriptLine(script);
      if (line) lines.push(`head: ${line}`);
    }
  }
  return lines;
}

const bodyOf = (document) => find(document, (node) => nameOf(node) === "body")[0] ?? document;

/** A page's outline, as text. `seen` carries the blocks of earlier pages. */
export function outline(html, page, seen = new Map()) {
  const document = parse(html);
  const lines = [`# ${page}`, ...headLines(document)];
  const body = bodyOf(document);
  const context = { seen, page };
  if (classesOf(body).length) lines.push(labelOf(body));
  for (const child of children(body)) {
    if (child.type === TEXT_NODE) {
      const text = space(child.value).trim();
      if (text) lines.push(quote(text));
    } else lines.push(...linesOf(child, 0, context).shown);
  }
  return `${lines.join("\n")}\n`;
}

const EMBED = /^w-(embed|iframe|video)$/;

/**
 * What step 2 notes of a page, as text: the head's scripts and stylesheets,
 * the forms, the embeds, the elements an interaction names, and the links.
 */
export function notes(html, page) {
  const document = parse(html);
  const body = bodyOf(document);
  const context = { seen: new Map(), page };
  const lines = [`# ${page}`, ...headLines(document, { tags: false })];
  const printed = new Set();
  const within = (node) => {
    printed.add(node);
    (node.children ?? []).forEach(within);
  };
  // A form with Webflow's wrapper, which holds its success and error messages.
  const blocks = find(body, (node) => nameOf(node) === "form" || classesOf(node).some((name) => name === "w-form" || EMBED.test(name)) || ["iframe", "video", "script", "style"].includes(nameOf(node)));
  for (const node of blocks) {
    if (printed.has(node)) continue;
    within(node);
    lines.push(...linesOf(node, 0, context).shown);
  }
  for (const node of find(body, (node) => attributesOf(node)["data-w-id"] !== undefined)) {
    const text = textLike(node) ? inline(node) : "";
    lines.push(`${labelOf(node)}${text ? ` ${quote(text.length > 60 ? `${text.slice(0, 57)}...` : text)}` : ""}`);
  }
  const links = [...new Set(find(body, (node) => nameOf(node) === "a" && attributesOf(node).href !== undefined).map((node) => space(String(attributesOf(node).href)).trim()))];
  if (links.length) lines.push(`links: ${links.join(" ")}`);
  return `${lines.join("\n")}\n`;
}

function main(args) {
  const { values, positionals: pages } = parseArgs({ args, allowPositionals: true, options: { notes: { type: "boolean" } } });
  if (pages.length === 0) throw new UsageError("Name the export's pages, such as .hostsmith/snapshot/code/index.html. See the usage at the top of this script.");
  const seen = new Map();
  const outlines = pages.map((page) => (values.notes ? notes : outline)(readFileSync(page, "utf8"), basename(page), seen));
  process.stdout.write(outlines.join("\n"));
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
