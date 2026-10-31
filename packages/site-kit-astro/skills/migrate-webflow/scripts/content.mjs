#!/usr/bin/env node
// The Webflow migration's content check (site-kit-webflow-migration design
// D166): each page of the export against its build page, as HTML, before the
// fidelity review looks at the look. A script compares text more reliably
// than eyes do, so the review is left the look alone.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/content.mjs \
//     --export .hostsmith/snapshot/code \
//     --build dist \
//     --pages .hostsmith/snapshot/fidelity/pages.txt \
//     --out .hostsmith/snapshot/fidelity/content.json
//
// --pages is the fidelity check's list: the export's file, then the build's
// path, on each line. For each page, it lists:
// - each text of the export that the build doesn't have, and each one it
//   has in another order, among the longer texts, of three words or more;
// - each link of the export the build doesn't have, internal ones by their
//   clean path, such as /about for about.html;
// - each image's alt text the build doesn't have.
// It leaves out what the export can't show or the migration doesn't carry: a
// collection list, which the export holds empty, a form, an embed's custom
// code, Webflow's badge, conditional content the export hides, and what the
// export hides. It reads both sides as text and runs nothing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { ELEMENT_NODE, parse, TEXT_NODE } from "ultrahtml";
import { find, UsageError } from "./browser.mjs";

const SKIPPED_ELEMENTS = new Set(["head", "script", "style", "noscript", "template", "svg", "iframe", "select", "option"]);
// Webflow's: a collection list, a form, custom code, the badge, and content
// a condition hides.
const SKIPPED_CLASSES = ["w-dyn-list", "w-dyn-empty", "w-form", "w-embed", "w-webflow-badge", "w-condition-invisible"];
// A text whose order is checked: three words or more. Shorter ones, such as a
// button's "Learn more", repeat too often to place.
const ORDERED = /\S+\s+\S+\s+\S+/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", times: "×" };
export const decode = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") return String.fromCodePoint(Number.parseInt(name[1] === "x" || name[1] === "X" ? name.slice(2) : name.slice(1), name[1] === "x" || name[1] === "X" ? 16 : 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
const normal = (text) => decode(text).replace(/[\s ​-‍﻿]+/g, " ").trim();

/**
 * A page's content, from its HTML: `texts`, each text node in order, as
 * written; `links`, each link's href, as written; `alts`, each image's alt
 * text and each media element's label. `export` leaves out what the
 * migration doesn't carry.
 */
export function contentOf(html, { exported = false } = {}) {
  const out = { texts: [], links: [], alts: [] };
  const walk = (node) => {
    if (node.type === TEXT_NODE) {
      const text = normal(node.value);
      if (text) out.texts.push(text);
      return;
    }
    if (node.type === ELEMENT_NODE) {
      const name = node.name.toLowerCase();
      const attributes = node.attributes ?? {};
      if (SKIPPED_ELEMENTS.has(name) || attributes["aria-hidden"] === "true") return;
      // The build's `hidden` elements, such as the menu button, show once
      // the kit's scripts run, so only the export's are left out.
      const classes = String(attributes.class ?? "").split(/\s+/);
      if (exported && ("hidden" in attributes || SKIPPED_CLASSES.some((skipped) => classes.includes(skipped)))) return;
      if (name === "a" && attributes.href !== undefined) out.links.push(String(attributes.href));
      if (name === "img" && normal(String(attributes.alt ?? ""))) out.alts.push(normal(String(attributes.alt)));
      if ((name === "video" || attributes.role === "img") && normal(String(attributes["aria-label"] ?? ""))) out.alts.push(normal(String(attributes["aria-label"])));
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(parse(html));
  return out;
}

/**
 * A link as both sides can compare it, or null for one that points nowhere,
 * such as "#": an internal one as its clean path, resolved against `page`,
 * the export's file or the build's path; mailto: in lower case; tel: as its
 * digits; any other as its host and path.
 */
export function linkKey(href, page) {
  const value = decode(href).trim();
  if (!value || value.startsWith("#") || /^javascript:/i.test(value)) return null;
  if (/^mailto:/i.test(value)) return value.toLowerCase().split("?")[0];
  if (/^tel:/i.test(value)) return `tel:${value.slice(4).replace(/[^\d+]/g, "")}`;
  const url = new URL(value, `http://site.invalid/${page.replace(/^\//, "")}`);
  if (url.host !== "site.invalid") return `${url.host.toLowerCase()}${url.pathname.replace(/\/$/, "")}${url.search}`;
  const path = url.pathname.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "").replace(/\/$/, "");
  return path || "/";
}

/**
 * What a build page lacks of its export page: `missing`, the texts it doesn't
 * have; `outOfOrder`, the texts of three words or more it has elsewhere than
 * after the one before; `links`, the links it doesn't have; `alts`, the alt
 * texts it doesn't have.
 */
export function compare(exported, built, { exportFile, buildPath }) {
  const corpus = ` ${built.texts.join(" ")} `;
  const missing = [];
  const outOfOrder = [];
  let cursor = 0;
  for (const text of exported.texts) {
    const at = corpus.indexOf(text, cursor);
    if (!ORDERED.test(text)) {
      if (!corpus.includes(text)) missing.push(text);
      continue;
    }
    if (at !== -1) cursor = at + text.length;
    else if (corpus.includes(text)) outOfOrder.push(text);
    else missing.push(text);
  }
  const builtLinks = new Set(built.links.map((href) => linkKey(href, buildPath)).filter(Boolean));
  const links = [...new Set(exported.links.map((href) => linkKey(href, exportFile)).filter((key) => key && !builtLinks.has(key)))];
  const alts = [...new Set(exported.alts.filter((alt) => !built.alts.includes(alt)))];
  return { missing: [...new Set(missing)], outOfOrder: [...new Set(outOfOrder)], links, alts };
}

function pagesOf(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    .filter(([exportFile, buildPath]) => exportFile && buildPath)
    .map(([exportFile, buildPath]) => ({ exportFile, buildPath }));
}

const quoted = (list) => list.slice(0, 3).map((text) => `"${text.length > 60 ? `${text.slice(0, 57)}...` : text}"`).join(", ") + (list.length > 3 ? `, and ${list.length - 3} more` : "");

function main(args) {
  for (const name of ["export", "build", "pages", "out"]) {
    if (!args[name]) throw new UsageError(`--${name} is missing. See the usage at the top of this script.`);
  }
  const pages = pagesOf(readFileSync(args.pages, "utf8"));
  if (pages.length === 0) throw new UsageError(`${args.pages} lists no pages.`);
  const result = { pages: [] };
  for (const { exportFile, buildPath } of pages) {
    const exportPath = join(resolve(args.export), exportFile);
    const buildFile = find(resolve(args.build), buildPath);
    if (!existsSync(exportPath) || !buildFile) {
      result.pages.push({ export: exportFile, build: buildPath, error: !existsSync(exportPath) ? `the export has no ${exportFile}` : `the build has no page at ${buildPath}` });
      continue;
    }
    const gaps = compare(contentOf(readFileSync(exportPath, "utf8"), { exported: true }), contentOf(readFileSync(buildFile, "utf8")), { exportFile, buildPath });
    result.pages.push({ export: exportFile, build: buildPath, ...gaps });
  }
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);

  let withGaps = 0;
  for (const page of result.pages) {
    if (page.error) {
      withGaps++;
      console.log(`${page.build}: ${page.error}.`);
      continue;
    }
    const parts = [
      page.missing.length && `${page.missing.length} texts missing, such as ${quoted(page.missing)}`,
      page.outOfOrder.length && `${page.outOfOrder.length} in another order, such as ${quoted(page.outOfOrder)}`,
      page.links.length && `${page.links.length} links missing: ${page.links.slice(0, 5).join(", ")}${page.links.length > 5 ? ", and more" : ""}`,
      page.alts.length && `${page.alts.length} alt texts missing, such as ${quoted(page.alts)}`,
    ].filter(Boolean);
    if (parts.length === 0) continue;
    withGaps++;
    console.log(`${page.build} (${page.export}): ${parts.join("; ")}.`);
  }
  console.log(
    `Checked the content of ${result.pages.length} pages: ${withGaps} with gaps. Fix each gap before the fidelity review, or note in the report why it stays, such as a form the kit doesn't carry yet. In ${args.out}`,
  );
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { export: { type: "string" }, build: { type: "string" }, pages: { type: "string" }, out: { type: "string" } } });
    main(values);
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
