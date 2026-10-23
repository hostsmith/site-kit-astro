// How much of a built site's visible text is bound to content (site-kit-core-split
// design D81): the characters inside an element with `data-field`, itself or an
// ancestor, over every visible character, per page and for the whole site.
//
//   npx site-kit check-fields               # a report, lowest coverage first
//   npx site-kit check-fields --min 90      # fails below 90% for the site
//   npx site-kit check-fields --json        # the report as JSON
//
// It reads every .html file in the build output (`build.output` in
// hostsmith.json, dist by default). The head isn't visible, and neither are
// `script`, `style`, `noscript` and `template`, elements with `hidden` or
// `aria-hidden="true"`, nor elements marked `data-field-ignore`, such as a
// footer's legal line. A text node counts its characters with runs of
// whitespace as one, and leading and trailing whitespace not at all. In a
// site whose content is in an external CMS, it reports and doesn't gate.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { ELEMENT_NODE, parse, TEXT_NODE } from "ultrahtml";
import { contentSource, externalSite, readManifest, siteKind } from "./manifest.mjs";

const SKIPPED = new Set(["head", "script", "style", "noscript", "template"]);
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Entities as the characters they stand for. Any other named entity is one
// character, which is all the count needs.
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (_, entity) => {
    if (entity[0] !== "#") return NAMED[entity.toLowerCase()] ?? "\u0000";
    return String.fromCodePoint(entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10));
  });
}

const hidden = (attributes) =>
  "hidden" in attributes || attributes["aria-hidden"] === "true" || "data-field-ignore" in attributes;

// A page's covered and counted characters.
export function pageCoverage(html) {
  const totals = { covered: 0, total: 0 };
  const visit = (node, covered) => {
    if (node.type === TEXT_NODE) {
      const length = [...decode(node.value).replace(/\s+/g, " ").trim()].length;
      totals.total += length;
      if (covered) totals.covered += length;
      return;
    }
    if (node.type === ELEMENT_NODE) {
      if (SKIPPED.has(node.name.toLowerCase()) || hidden(node.attributes)) return;
      covered ||= "data-field" in node.attributes;
    }
    for (const child of node.children ?? []) visit(child, covered);
  };
  visit(parse(html), false);
  return totals;
}

const percent = (covered, total) => (total === 0 ? null : Math.round((covered / total) * 1000) / 10);

// The URL path a built file is served at.
function pathOf(file) {
  const path = `/${file.split(sep).join("/")}`.replace(/(^|\/)index\.html?$/, "$1").replace(/\.html?$/, "");
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

// The report of a build output folder: { overall, pages }, the pages lowest
// coverage first, then the ones without text, each by path.
export function checkFields(dir) {
  const files = readdirSync(dir, { recursive: true }).filter((file) => /\.html?$/.test(file));
  const pages = files.map((file) => {
    const { covered, total } = pageCoverage(readFileSync(join(dir, file), "utf8"));
    return { path: pathOf(file), covered, total, percent: percent(covered, total) };
  });
  pages.sort((a, b) => (a.percent ?? Infinity) - (b.percent ?? Infinity) || a.path.localeCompare(b.path));
  const covered = pages.reduce((sum, page) => sum + page.covered, 0);
  const total = pages.reduce((sum, page) => sum + page.total, 0);
  return { overall: { covered, total, percent: percent(covered, total) }, pages };
}

function report({ overall, pages }) {
  const lines = [`Field coverage: ${overall.percent ?? "-"}% of ${overall.total} characters of visible text, in ${pages.length} pages.`];
  for (const page of pages) {
    lines.push(page.percent === null ? `  -       ${page.path}  (no text)` : `  ${`${page.percent}%`.padEnd(6)}  ${page.path}  (${page.covered} of ${page.total})`);
  }
  return lines.join("\n");
}

function main(args) {
  const json = args.includes("--json");
  const minAt = args.indexOf("--min");
  const min = minAt === -1 ? undefined : Number(args[minAt + 1]);
  if (minAt !== -1 && !(min >= 0 && min <= 100)) throw new Error("--min takes a percentage from 0 to 100, such as --min 90.");
  const unknown = args.filter((arg, i) => arg !== "--json" && arg !== "--min" && i !== minAt + 1);
  if (unknown.length > 0) throw new Error(`Usage: site-kit check-fields [--min <percent>] [--json]. Unknown: ${unknown.join(" ")}.`);

  const manifest = readManifest(".");
  const output = manifest?.build?.output ?? "dist";
  if (!existsSync(output)) throw new Error(`No build output in ${output}/. Build the site first.`);
  const result = checkFields(output);
  console.log(json ? JSON.stringify(result, null, 2) : report(result));
  // Text from an external CMS has nothing in the repository to bind to (D86).
  if (min !== undefined && manifest && contentSource(manifest, siteKind(".")) === "external") {
    console.error(externalSite("--min doesn't apply: its text has nothing in the repository to bind to"));
    return;
  }
  if (min !== undefined && (result.overall.percent ?? 0) < min) {
    const below = result.pages.filter((page) => page.percent !== null && page.percent < min).map((page) => page.path);
    throw new Error(`Field coverage is ${result.overall.percent ?? 0}%, below --min ${min}. Pages below ${min}%: ${below.join(", ") || "none"}.`);
  }
}

// `site-kit check-fields [--min <percent>] [--json]` (bin/site-kit.mjs).
export function cli(args) {
  try {
    main(args);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
