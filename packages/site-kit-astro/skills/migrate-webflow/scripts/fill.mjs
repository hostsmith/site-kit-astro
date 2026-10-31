// The fidelity check's fill of the export's CMS pages (site-kit-fidelity-cms-stubs
// design D181, D182). Webflow's code export keeps a collection's template,
// detail_<collection>.html, with each bound element empty and marked
// w-dyn-bind-empty, and a collection list with one item, its bound elements
// empty too, and its empty state, w-dyn-empty. Step 6 writes the fill file,
// .hostsmith/snapshot/fidelity/fill.json, which names the CSV columns that
// fill them, from the field mapping it made:
//
//   {
//     "templates": {
//       "detail_blog.html": { "csv": "<the posts' CSV>", "fields": ["Name", "Summary", ...] }
//     },
//     "lists": {
//       "index.html": [{ "csv": "<the posts' CSV>", "entries": ["<slug>", ...], "fields": [...] }]
//     }
//   }
//
// A template's fields are its empty elements outside its lists, in their
// order in the page, and its entry is the one whose Slug is the last part of
// the build path pages.txt gives it. A page's lists are in their order in the
// page, each with the entries the build shows in it, in the build's order. A
// field is a column's name, as the CSV's header has it; an object, with
// `column` and either `date`, the Intl.DateTimeFormat options it shows with in
// the page's language, or `ref`, `{ "csv", "column" }`, the column of the
// referenced entry, whose Slug the column holds; or null, for an element the
// build leaves empty.
//
// fillPage() fills a page's HTML: the text of a text element, an image's src
// from the local name cms-images.txt gives its URL, served under /__fill/ from
// the build, and a rich text element's HTML without scripts, frames, embeds,
// styles or event attributes, its images mapped the same way. A list's item is
// copied once per entry, and its empty state removed unless it has none. Only
// the elements it fills change: the rest of the page stays as it was, byte for
// byte. A template or list whose fields don't account for its empty elements
// one by one, or whose CSV, column or entry isn't there, stays as it is, and
// its problem names the element. It reads the files as text and runs nothing.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOCUMENT_NODE, ELEMENT_NODE, parse, renderSync } from "ultrahtml";
import { FILL_PATH, UsageError } from "./browser.mjs";
import { readCsv } from "./csv.mjs";

const IMAGES_PATH = `${FILL_PATH}assets/images/`;
const BOUND = "w-dyn-bind-empty";
// What a rich text body loses: what runs, what frames another page, and what
// reaches beyond the element.
const DROPPED = new Set(["script", "noscript", "iframe", "frame", "frameset", "object", "embed", "applet", "style", "link", "meta", "base"]);

const nameOf = (node) => node.name.toLowerCase();
const classesOf = (node) => String(node.attributes?.class ?? "").split(/\s+/).filter(Boolean);
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

// An element as the outline shows it: its tag, none for a div, its id and its
// classes, without Webflow's mark of an empty bound element.
const labelOf = (node) =>
  `${nameOf(node) === "div" ? "" : nameOf(node)}${node.attributes?.id ? `#${node.attributes.id}` : ""}${classesOf(node)
    .filter((name) => name !== BOUND)
    .map((name) => `.${name}`)
    .join("")}` || nameOf(node);

// An element's outline path, from its section, or the top of the body.
function pathOf(chain) {
  const elements = chain.filter((node) => node.type === ELEMENT_NODE && !["html", "body"].includes(nameOf(node)));
  const section = elements.findLastIndex((node) => nameOf(node) === "section");
  return elements.slice(Math.max(0, section)).map(labelOf).join(" > ");
}

/** The fill file at `file`, checked, or undefined when there's none. */
export function readFill(file) {
  if (!file || !existsSync(file)) return undefined;
  let fill;
  try {
    fill = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new UsageError(`${file} isn't JSON: ${error.message}`);
  }
  const fail = (where, what) => {
    throw new UsageError(`${file}: ${where} ${what}. See the fill file in step 6.`);
  };
  const checkFields = (where, fields) => {
    if (!Array.isArray(fields)) fail(where, 'has no "fields" list');
    fields.forEach((field, i) => {
      const at = `${where}, field ${i + 1},`;
      if (field === null || typeof field === "string") return;
      if (typeof field !== "object" || typeof field.column !== "string") fail(at, 'is neither a column\'s name, null, nor an object with "column"');
      if (field.date !== undefined && (typeof field.date !== "object" || field.date === null)) fail(at, 'has a "date" that isn\'t an object of Intl.DateTimeFormat options');
      if (field.ref !== undefined && (typeof field.ref?.csv !== "string" || typeof field.ref?.column !== "string")) fail(at, 'has a "ref" without "csv" and "column"');
    });
  };
  if (typeof fill !== "object" || fill === null || Array.isArray(fill)) fail("the file", 'isn\'t an object with "templates" and "lists"');
  for (const [page, template] of Object.entries(fill.templates ?? {})) {
    if (typeof template?.csv !== "string") fail(`the template ${page}`, 'has no "csv"');
    checkFields(`the template ${page}`, template.fields);
  }
  for (const [page, lists] of Object.entries(fill.lists ?? {})) {
    if (!Array.isArray(lists)) fail(`the lists of ${page}`, "aren't a list");
    lists.forEach((list, i) => {
      const where = `the ${ordinal(i + 1)} list of ${page}`;
      if (typeof list?.csv !== "string") fail(where, 'has no "csv"');
      if (!Array.isArray(list.entries) || list.entries.some((entry) => typeof entry !== "string")) fail(where, 'has no "entries" list of slugs');
      checkFields(where, list.fields);
    });
  }
  return { templates: fill.templates ?? {}, lists: fill.lists ?? {} };
}

/** cms-images.txt as a map of each image's URL to its local name. */
export function readImages(file) {
  const images = new Map();
  if (!file || !existsSync(file)) return images;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const words = line.trim().split(/\s+/);
    const url = words.find((word) => /^https?:\/\//.test(word));
    const name = words.findLast((word) => word && !/^https?:\/\//.test(word));
    if (url && name) images.set(url, name);
  }
  return images;
}

/**
 * A page's empty bound elements: `template`, those outside its lists, and
 * `lists`, each collection list with its items, its empty state and the empty
 * elements of its first item, all in their order in the page. A list inside
 * a list's item stays as it is.
 */
export function boundOf(html) {
  const template = [];
  const lists = [];
  const walk = (node, chain, list, inItem) => {
    if (node.type !== ELEMENT_NODE && node.type !== DOCUMENT_NODE) return;
    const classes = node.type === ELEMENT_NODE ? classesOf(node) : [];
    const here = [...chain, node];
    if (classes.includes("w-dyn-list")) {
      if (list) return;
      const found = { node, path: pathOf(here), items: [], empty: undefined, elements: [] };
      lists.push(found);
      for (const child of node.children ?? []) walk(child, here, found, false);
      return;
    }
    let inside = inItem;
    if (list && classes.includes("w-dyn-item")) {
      list.items.push(node);
      inside = list.items.length === 1;
    }
    if (list && classes.includes("w-dyn-empty")) list.empty ??= node;
    if (classes.includes(BOUND)) {
      const element = { node, label: labelOf(node), path: pathOf(here) };
      if (!list) template.push(element);
      else if (inside) list.elements.push(element);
    }
    for (const child of node.children ?? []) walk(child, here, list, inside);
  };
  walk(parse(html), [], undefined, false);
  return { template, lists };
}

// What fills one element from one entry: { value }, a string, or null to
// leave it, or { problem }.
function valueOf(field, row, csv, read, locale) {
  if (field === null) return { value: null };
  const column = typeof field === "string" ? field : field.column;
  if (!csv.columns.includes(column)) return { problem: `its CSV has no column "${column}"` };
  let value = row[column];
  if (field.ref && value) {
    const referenced = read(field.ref.csv);
    if (referenced.problem) return referenced;
    if (!referenced.columns.includes(field.ref.column)) return { problem: `${field.ref.csv} has no column "${field.ref.column}"` };
    // A slug no entry has shows nothing, as on the old site.
    value = referenced.rows.find((entry) => entry.Slug === value)?.[field.ref.column] ?? "";
  }
  if (field.date && value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { problem: `"${column}" holds "${value}", which isn't a date` };
    try {
      value = new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...field.date }).format(date);
    } catch (error) {
      return { problem: `the date options of "${column}" don't work: ${error.message}` };
    }
  }
  return { value };
}

// A field as the printed map shows it.
function fieldLabel(field) {
  if (field === null) return "left empty";
  if (typeof field === "string") return field;
  return `${field.column}${field.ref ? ` > ${field.ref.column}` : ""}${field.date ? " (date)" : ""}`;
}

// An image's src for a URL from the CSV, or undefined, noted, when
// cms-images.txt doesn't name it.
function imageSrc(url, images, unmapped) {
  const name = images.get(url.trim());
  if (name) return `${IMAGES_PATH}${encodeURIComponent(name)}`;
  unmapped.add(url.trim());
  return undefined;
}

// A rich text body's HTML, without what DROPPED names and event attributes,
// its images from the build.
function richText(html, images, unmapped) {
  const document = parse(html);
  const clean = (node) => {
    node.children = (node.children ?? []).filter((child) => child.type !== ELEMENT_NODE || !DROPPED.has(nameOf(child)));
    for (const child of node.children) {
      if (child.type !== ELEMENT_NODE) continue;
      for (const key of Object.keys(child.attributes ?? {})) if (/^on/i.test(key)) delete child.attributes[key];
      if (nameOf(child) === "img" && child.attributes.src) {
        const src = imageSrc(String(child.attributes.src), images, unmapped);
        if (src) {
          child.attributes.src = src;
          delete child.attributes.srcset;
          delete child.attributes.sizes;
        }
      }
      clean(child);
    }
  };
  clean(document);
  return renderSync(document);
}

// An opening tag without Webflow's mark of an empty bound element, and with
// `src` when it's given, in place of its src, srcset and sizes.
function openTag(tag, src) {
  let out = tag.replace(/(\sclass=")([^"]*)"/i, (match, start, classes) => {
    const kept = classes.split(/\s+/).filter((name) => name && name !== BOUND);
    return kept.length > 0 ? `${start}${kept.join(" ")}"` : "";
  });
  if (src !== undefined) {
    out = out.replace(/\s(src|srcset|sizes)="[^"]*"/gi, "");
    out = out.replace(/^<img/i, `<img src="${src}"`);
  }
  return out;
}

// The edits that fill `elements` from `values`, as offsets into `html`
// shifted by `base`.
function editsOf(html, elements, values, base, images, unmapped) {
  const edits = [];
  elements.forEach((element, i) => {
    const value = values[i];
    if (value === null || value === "") return;
    const [open, close] = element.node.loc;
    const tag = html.slice(open.start - base, open.end - base);
    if (nameOf(element.node) === "img") {
      const src = imageSrc(value, images, unmapped);
      if (src) edits.push({ start: open.start - base, end: open.end - base, text: openTag(tag, src) });
      return;
    }
    edits.push({ start: open.start - base, end: open.end - base, text: openTag(tag) });
    const inner = classesOf(element.node).includes("w-richtext") ? richText(value, images, unmapped) : escape(value);
    edits.push({ start: open.end - base, end: close.start - base, text: inner });
  });
  return edits;
}

function apply(html, edits) {
  let out = html;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

// The problem when `fields` don't account for `elements` one by one, naming
// the first element left over or the first field with none.
function countProblem(fields, elements, what) {
  if (fields.length === elements.length) return undefined;
  const named = `the fill file names ${fields.length} field${fields.length === 1 ? "" : "s"}`;
  const empty = `${elements.length} empty element${elements.length === 1 ? "" : "s"}`;
  if (fields.length < elements.length) return `${named} for its ${empty}: the ${ordinal(fields.length + 1)}, ${elements[fields.length].path}, has none`;
  return `${named} for ${what}'s ${empty}: the ${ordinal(elements.length + 1)}, ${fieldLabel(fields[elements.length])}, has no element`;
}

/**
 * The export page `file` (its path in the export, such as detail_blog.html)
 * filled for the build path `buildPath`: `html`, as served; `parts`, each
 * template or list with `filled` and, unfilled, its `problem`, and `map`, its
 * fields by element; `images`, the local names it used; and `unmapped`, the
 * image URLs cms-images.txt doesn't name. `cms` is the folder of the CSVs,
 * `images` readImages()'s map. A page without empty bound elements or lists
 * has no parts.
 */
export function fillPage(html, { file, buildPath, fill, cms, images = new Map() }) {
  const bound = boundOf(html);
  const locale = /<html[^>]*\slang="([^"]+)"/i.exec(html)?.[1] ?? "en";
  const parts = [];
  const edits = [];
  const unmapped = new Set();
  const used = new Set();
  const cache = new Map();
  const read = (name) => {
    if (!cache.has(name)) {
      try {
        cache.set(name, readCsv(join(cms, name)));
      } catch {
        cache.set(name, { problem: `there's no CSV named "${name}" in the snapshot's cms folder, or it can't be read` });
      }
    }
    return cache.get(name);
  };
  const noFill = fill ? undefined : "there's no fill file yet";

  const template = fill?.templates?.[file];
  if (bound.template.length > 0 || template) {
    const part = { part: "template", filled: false };
    parts.push(part);
    const slug = decodeURIComponent(buildPath.replace(/\/+$/, "").split("/").pop() ?? "");
    const csv = template && read(template.csv);
    part.problem =
      noFill ??
      (!template ? `the fill file has no template for ${file}` : undefined) ??
      (bound.template.length === 0 ? `${file} has no empty bound element outside its lists` : undefined) ??
      csv.problem ??
      countProblem(template.fields, bound.template, "the template");
    if (!part.problem) {
      part.map = bound.template.map((element, i) => `${element.label} = ${fieldLabel(template.fields[i])}`);
      const row = csv.rows.find((entry) => entry.Slug === slug);
      if (!row) part.problem = `${template.csv} has no entry with the Slug "${slug}", the last part of ${buildPath}`;
      else {
        const values = template.fields.map((field) => valueOf(field, row, csv, read, locale));
        const wrong = values.findIndex((value) => value.problem);
        if (wrong >= 0) part.problem = `the ${ordinal(wrong + 1)} field, for ${bound.template[wrong].path}: ${values[wrong].problem}`;
        else {
          edits.push(...editsOf(html, bound.template, values.map((value) => value.value), 0, images, unmapped));
          part.filled = true;
        }
      }
    }
  }

  const lists = fill?.lists?.[file] ?? [];
  const mismatch = bound.lists.length !== lists.length ? `the page has ${bound.lists.length} collection list${bound.lists.length === 1 ? "" : "s"}, and the fill file names ${lists.length}` : undefined;
  if (bound.lists.length === 0 && lists.length > 0) parts.push({ part: "lists", filled: false, problem: mismatch });
  bound.lists.forEach((list, n) => {
    const spec = lists[n];
    const part = { part: `list ${n + 1}`, filled: false };
    parts.push(part);
    const csv = spec && read(spec.csv);
    part.problem =
      noFill ??
      mismatch ??
      (list.items.length === 0 ? `${list.path} has no item, .w-dyn-item, to copy` : undefined) ??
      csv.problem ??
      countProblem(spec.fields, list.elements, "its item");
    if (part.problem) {
      part.problem = `${part.problem} (the list ${list.path})`;
      return;
    }
    part.map = list.elements.map((element, i) => `${element.label} = ${fieldLabel(spec.fields[i])}`);
    const [first, last] = [list.items[0], list.items.at(-1)];
    const start = first.loc[0].start;
    const end = last.loc[1].end;
    const item = html.slice(start, first.loc[1].end);
    const copies = [];
    for (const slug of spec.entries) {
      const row = csv.rows.find((entry) => entry.Slug === slug);
      if (!row) {
        part.problem = `${spec.csv} has no entry with the Slug "${slug}" (the list ${list.path})`;
        return;
      }
      const values = spec.fields.map((field) => valueOf(field, row, csv, read, locale));
      const wrong = values.findIndex((value) => value.problem);
      if (wrong >= 0) {
        part.problem = `the ${ordinal(wrong + 1)} field, for ${list.elements[wrong].path}: ${values[wrong].problem}`;
        return;
      }
      copies.push(apply(item, editsOf(html.slice(start), list.elements, values.map((value) => value.value), start, images, unmapped)));
    }
    edits.push({ start, end, text: copies.join("") });
    // The old site shows its empty state only when the list has no entries.
    if (list.empty && spec.entries.length > 0) edits.push({ start: list.empty.loc[0].start, end: list.empty.loc[1].end, text: "" });
    part.filled = true;
  });

  const filled = apply(html, edits);
  for (const match of filled.matchAll(new RegExp(`${IMAGES_PATH.replaceAll("/", "\\/")}([^"]+)"`, "g"))) used.add(decodeURIComponent(match[1]));
  return { html: filled, parts, images: [...used].sort(), unmapped: [...unmapped] };
}
