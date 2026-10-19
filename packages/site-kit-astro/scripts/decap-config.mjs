// Assembles the Decap CMS config, public/admin/config.yml, from the kit's part
// (decap/config.kit.yml in the package) and the site's part
// (public/admin/config.site.yml):
//
//   npm run decap-config             # writes config.yml
//   npm run decap-config -- --check  # fails when config.yml is stale
//
// The build fails when config.yml is stale, too (site-kit-updates design D21).
//
// The assembly is text, so the kit's YAML anchors, flow mappings and comments
// survive. Each `# site: <part>` line in the kit's part is replaced, at its
// indent, by the site's part:
//
// - `repo`: `repo: <repo>` from the site's `repo` key;
// - `collection options`: the names of the site's folder collections, as the
//   options of the collection list section;
// - `section types`: the site's `section_types`, each with the kit's id field
//   added as its first field;
// - `ui`: the fields of the site's own interface strings, from its optional
//   `ui` key, added to the settings' `ui` object. A plural string's fields
//   are the kit's `*plural_forms` (site-kit-locales design D46);
// - `collections`: the site's `collections`.
//
// Then Decap's i18n settings are added, for the locales in src/site.config.ts,
// one or more (site-kit-locales design D55).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMap, isSeq, parse, parseDocument } from "yaml";
import { localeCodes } from "./site-config.mjs";

// The kit's part, as messages name it, and its file in the package.
export const KIT_PART = "@hostsmith/site-kit-astro/decap/config.kit.yml";
const KIT_PART_FILE = fileURLToPath(new URL("../decap/config.kit.yml", import.meta.url));
// The site's part and the assembled file, relative to the site's root.
export const SITE_PART = "public/admin/config.site.yml";
export const ASSEMBLED = "public/admin/config.yml";

const MARKERS = ["repo", "collection options", "section types", "ui", "collections"];
const SITE_KEYS = ["repo", "section_types", "ui", "collections"];
// `ui` is optional: a site without its own interface strings leaves it out.
const REQUIRED_SITE_KEYS = ["repo", "section_types", "collections"];

// A plural interface string's fields: every CLDR plural form, of which only
// `other` is required, since each language uses its own set. The site's part
// writes `fields: *plural_forms`; the first use defines the anchor.
const PLURAL_FORMS = `[${["zero", "one", "two", "few", "many", "other"]
  .map((form) => `{ name: ${form}, label: ${form[0].toUpperCase()}${form.slice(1)}, widget: string${form === "other" ? "" : ", required: false"} }`)
  .join(", ")}]`;

const HEADER = `# Decap CMS config, assembled by \`npm run decap-config\` from the kit's part
# (${KIT_PART}) and this site's part
# (${SITE_PART}). Don't edit this file: edit the site's
# part and run the command again.
#
# Decap CMS and Sveltia CMS both read it. The build removes /admin, so it is
# never deployed.
`;

// The site's part, split into its top-level keys.
export function parseSitePart(text) {
  const fail = (line, message) => {
    throw new Error(`${SITE_PART} line ${line}: ${message}`);
  };
  const keys = {};
  let current;
  text.split("\n").forEach((line, index) => {
    const number = index + 1;
    if (line.trim() === "") {
      current?.lines.push({ text: "", number });
      return;
    }
    if (line.startsWith("#")) {
      current = undefined;
      return;
    }
    const key = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (key) {
      if (!SITE_KEYS.includes(key[1])) fail(number, `unknown key "${key[1]}". The site's part has ${SITE_KEYS.join(", ")}.`);
      if (keys[key[1]]) fail(number, `"${key[1]}" is set twice.`);
      current = keys[key[1]] = { value: key[2].trim(), lines: [], number };
      return;
    }
    if (!current) fail(number, "an indented line needs a key above it, without a comment line in between at the start of a line.");
    current.lines.push({ text: line, number });
  });
  for (const key of REQUIRED_SITE_KEYS) if (!keys[key]) throw new Error(`${SITE_PART} has no "${key}".`);

  const repo = keys.repo.value;
  if (repo === "" || keys.repo.lines.some((l) => l.text !== "")) fail(keys.repo.number, 'set "repo" to the GitHub repository, as OWNER/REPOSITORY.');

  return {
    repo,
    sectionTypes: listItems("section_types", keys.section_types, fail),
    ui: keys.ui ? listItems("ui", keys.ui, fail) : [],
    collections: listItems("collections", keys.collections, fail),
  };
}

// The items of a list key: its lines, with the leading comments of each item.
function listItems(name, { value, lines, number }, fail) {
  while (lines.at(-1)?.text === "") lines.pop();
  if (value === "[]") {
    if (lines.length > 0) fail(lines[0].number, `"${name}" is set to [] but has items below it.`);
    return [];
  }
  if (value !== "") fail(number, `"${name}" must be a block list, with each item on its own lines, or [].`);
  if (lines.length === 0) fail(number, `"${name}" has no items. Write "${name}: []" for none.`);

  const items = [];
  let pending = [];
  for (const line of lines) {
    if (line.text === "" || /^ {2}#/.test(line.text)) {
      (items.at(-1) && pending.length === 0 && line.text === "" ? items.at(-1).lines : pending).push(line);
      continue;
    }
    const start = line.text.match(/^ {2}- (.*)$/);
    if (start) {
      // A block item, "- name: <name>", or, for a field, a flow one, "- { name: <name>, ... }".
      const itemName = start[1].match(/^name: ([^\s#]+)\s*$/) ?? start[1].match(/^\{ *name: ([^\s,}#]+)/);
      if (!itemName) fail(line.number, `each item of "${name}" starts with "- name: <name>" on its own line, or is "- { name: <name>, ... }".`);
      items.push({ name: itemName[1], lines: [...pending, line] });
      pending = [];
      continue;
    }
    if (!/^ {4}/.test(line.text) || items.length === 0) fail(line.number, `"${name}" items start with "  - name:", and their lines are indented under it.`);
    items.at(-1).lines.push(...pending, line);
    pending = [];
  }
  if (pending.some((l) => l.text !== "")) fail(pending[0].number, `comment after the last item of "${name}".`);
  return items;
}

// A section type's lines, with the kit's id field added first.
function withIdField(item) {
  const fields = item.lines.findIndex((l) => /^ {4}fields:\s*$/.test(l.text));
  if (fields === -1) {
    throw new Error(`${SITE_PART} line ${item.lines[0].number}: section type "${item.name}" needs a block "fields:" list.`);
  }
  const id = item.lines.find((l) => /^ {6}- (\{ *)?name: id\b/.test(l.text));
  if (id) throw new Error(`${SITE_PART} line ${id.number}: section type "${item.name}" has an id field. Remove it: every section type gets the kit's id field.`);
  const lines = item.lines.map((l) => l.text);
  lines.splice(fields + 1, 0, "      - *section_id");
  return lines;
}

const indent = (lines, by) => lines.map((line) => (line === "" ? "" : `${by}${line.slice(2)}`));

// The first `*plural_forms` defines the anchor with the kit's plural fields.
function withPluralForms(lines) {
  const first = lines.findIndex((line) => line.includes("*plural_forms"));
  if (first !== -1) lines[first] = lines[first].replace("*plural_forms", `&plural_forms ${PLURAL_FORMS}`);
  return lines;
}

// The field names under the settings' `ui` in the assembled config, or
// undefined without one. The settings are a files collection, or a folder
// collection in a localized site.
export function decapUiKeys(root = ".") {
  const file = join(root, ASSEMBLED);
  if (!existsSync(file)) return undefined;
  const settings = parse(readFileSync(file, "utf8"))?.collections?.find((collection) => collection.name === "settings");
  const fields = settings?.files?.[0]?.fields ?? settings?.fields ?? [];
  return fields.find((field) => field.name === "ui")?.fields?.map((field) => field.name);
}

// A translation's own URL segment. The build fails on one in the default
// locale, or on a single-locale site.
const LOCAL_SLUG_FIELD = {
  name: "localSlug",
  label: "URL segment in this language",
  widget: "string",
  required: false,
  hint: "Only for a translation: its own URL segment, such as ueber-uns. Leave it empty in the default language.",
};

// A link field's hint, with several locales: content links to a page by its
// path in the default locale, which the kit localizes. A path with another
// locale's prefix stays as written, and breaks when that page's localSlug
// changes (site-kit-locales design D50).
const linkHint = (code) =>
  `For a page on this site, write its path in the default language (${code}), such as /contact, also in a translation. The site then links to the page in the translation's language.`;

// Gives every string field named `link`, at every depth, the hint. An
// anchored node is visited once, where it's defined.
function hintLinks(node, hint, seen = new Set()) {
  if (!node || seen.has(node)) return;
  seen.add(node);
  if (isSeq(node)) return node.items.forEach((item) => hintLinks(item, hint, seen));
  if (!isMap(node)) return;
  if (node.get("name") === "link" && node.get("widget") === "string" && !node.has("hint")) node.set("hint", hint);
  for (const key of ["fields", "field", "types"]) hintLinks(node.get(key, true), hint, seen);
}

// Marks every field, at every depth, for translation: Sveltia shows a
// translated list's subfields in other locales only when they're marked too.
// The entries of a list's `types` aren't fields, and Sveltia rejects `i18n`
// on them, so only their fields are marked. An anchored node is marked once,
// where it's defined. A block field gets `i18n` under its widget, a flow one
// at its end.
function translateFields(doc, node, seen, isType = false) {
  if (!node || seen.has(node)) return;
  seen.add(node);
  if (isSeq(node)) return node.items.forEach((item) => translateFields(doc, item, seen, isType));
  if (!isMap(node)) return;
  if (!isType && node.has("widget") && !node.has("i18n")) {
    if (node.flow) node.set("i18n", true);
    else insertAfter(doc, node, "widget", "i18n", true);
  }
  translateFields(doc, node.get("fields", true), seen);
  translateFields(doc, node.get("field", true), seen);
  translateFields(doc, node.get("types", true), seen, true);
}

// Adds `key: value` after the map's `after` key.
function insertAfter(doc, map, after, key, value) {
  const at = map.items.findIndex((pair) => pair.key?.value === after);
  map.items.splice(at + 1, 0, doc.createPair(key, value));
}

// Decap translates a files collection only as one file for every locale, so
// the settings become a folder collection with one entry per locale. Its
// summary titles that entry, which the CMSs otherwise title with the site's
// name.
function settingsFolder(doc, collection) {
  const [site] = collection.get("files", true).items;
  const file = site.get("file");
  const folder = doc.createNode({
    name: collection.get("name"),
    label: collection.get("label"),
    label_singular: collection.get("label"),
    folder: file.slice(0, file.lastIndexOf("/")),
    extension: file.slice(file.lastIndexOf(".") + 1),
    format: "yml",
    create: false,
    delete: false,
    i18n: true,
    identifier_field: "name",
    summary: "Site settings",
  });
  folder.set("fields", site.get("fields", true));
  return folder;
}

// Every site's config, with one locale or several (site-kit-locales design
// D55): Decap's i18n settings, in the `multiple_files` structure, which
// names each file's locale before its extension (D48); the pages, the
// settings and each site collection translated, every field
// included; and, with several locales, a localSlug field for translations
// and a hint on link fields.
// Only Decap's i18n options are used, which Sveltia reads too. The yaml
// library's document keeps the assembled text's comments, anchors and flow
// style.
function localize(text, locales) {
  const doc = parseDocument(text);
  const seen = new Set();
  const collections = doc.get("collections", true);
  collections.items = collections.items.map((collection) => {
    const name = collection.get("name");
    if (name === "settings" && collection.has("files")) {
      const folder = settingsFolder(doc, collection);
      translateFields(doc, folder.get("fields", true), seen);
      return folder;
    }
    if (!collection.has("folder")) {
      throw new Error(
        `${SITE_PART}: "${name}" is a files collection, which Decap can't translate with a file per locale. Custom pages are edited in the pages collection, with their content in sections: remove "${name}".`,
      );
    }
    insertAfter(doc, collection, "folder", "i18n", true);
    const fields = collection.get("fields", true);
    if (locales.length > 1) {
      const slug = doc.createNode(LOCAL_SLUG_FIELD);
      slug.flow = true;
      fields.items.splice(fields.items.findIndex((field) => field.get?.("name") === "title") + 1, 0, slug);
    }
    translateFields(doc, fields, seen);
    return collection;
  });
  if (locales.length > 1) hintLinks(collections, linkHint(locales[0]));

  const i18n = doc.createNode({ structure: "multiple_files", locales, default_locale: locales[0] });
  i18n.get("locales", true).flow = true;
  const pair = doc.createPair("i18n", i18n);
  pair.key.spaceBefore = true;
  pair.key.commentBefore = " The site's locales, from src/site.config.ts. Each content file names its\n locale before its extension, such as about.en.md.";
  doc.contents.items.splice(
    doc.contents.items.findIndex((item) => item.key?.value === "collections"),
    0,
    pair,
  );
  return doc.toString({ lineWidth: 0 });
}

// `locales` is the site's locale codes, the default first.
export function assemble(kitText, siteText, locales) {
  if (!locales?.length) {
    throw new Error(`No locales for ${ASSEMBLED}: every site lists its locales in src/site.config.ts, such as locales: [{ code: "en", tag: "en-US" }].`);
  }
  const site = parseSitePart(siteText);
  const lines = kitText.replace(/\n$/, "").split("\n");

  // The kit part's header comment gives way to the assembled file's header.
  let header = 0;
  while (lines[0]?.startsWith("#")) {
    lines.shift();
    header += 1;
  }

  const found = new Map();
  lines.forEach((line, index) => {
    const marker = line.match(/^( *)# site: (.+?)\s*$/);
    if (!marker) return;
    if (!MARKERS.includes(marker[2])) throw new Error(`${KIT_PART} line ${header + index + 1}: unknown marker "# site: ${marker[2]}".`);
    if (found.has(marker[2])) throw new Error(`${KIT_PART}: marker "# site: ${marker[2]}" appears twice.`);
    found.set(marker[2], { index, pad: marker[1] });
  });
  for (const marker of MARKERS) if (!found.has(marker)) throw new Error(`${KIT_PART} has no "# site: ${marker}" line.`);

  const folders = site.collections.filter((item) => item.lines.some((l) => /^ {4}folder:/.test(l.text))).map((item) => item.name);
  const parts = {
    repo: (pad) => [`${pad}repo: ${site.repo}`],
    "collection options": (pad) => [`${pad}options: [${folders.join(", ")}]`],
    "section types": (pad) => site.sectionTypes.flatMap((item) => indent(withIdField(item), pad)),
    ui: (pad) => withPluralForms(site.ui.flatMap((item) => indent(item.lines.map((l) => l.text), pad))),
    collections: (pad) => site.collections.flatMap((item) => indent(item.lines.map((l) => l.text), pad)),
  };

  // Replaced from the last marker up, so earlier indexes stay valid.
  for (const [marker, { index, pad }] of [...found].sort((a, b) => b[1].index - a[1].index)) {
    lines.splice(index, 1, ...parts[marker](pad));
  }
  while (lines.at(-1) === "") lines.pop();
  return localize(`${HEADER}${lines.join("\n")}\n`, locales);
}

// The kit part ships in the package. The site part is read from the site's root.
export function assembleFiles(root, locales, kitPartFile = KIT_PART_FILE) {
  return assemble(readFileSync(kitPartFile, "utf8"), readFileSync(join(root, SITE_PART), "utf8"), locales);
}

// Why config.yml is stale, or undefined when it matches a fresh assembly.
export function staleness(root, locales) {
  if (readFileSync(join(root, ASSEMBLED), "utf8") === assembleFiles(root, locales)) return undefined;
  return `${ASSEMBLED} doesn't match the kit's part and ${SITE_PART}. Edit ${SITE_PART}, not ${ASSEMBLED}, and run npm run decap-config. After a kit update, run npm run decap-config.`;
}

async function main(args) {
  const locales = await localeCodes();
  if (args.includes("--check")) {
    const problem = staleness(".", locales);
    if (problem) throw new Error(problem);
    console.log(`${ASSEMBLED} is up to date.`);
    return;
  }
  writeFileSync(ASSEMBLED, assembleFiles(".", locales));
  console.log(`Wrote ${ASSEMBLED} from the kit's part and ${SITE_PART}.`);
}

// `site-kit decap-config [--check]` (bin/site-kit.mjs).
export async function cli(args) {
  try {
    await main(args);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
