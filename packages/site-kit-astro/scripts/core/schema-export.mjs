// The schema export, .hostsmith/schema.json (site-kit-core-split design D74,
// D75, D76, D85): one file that describes a site's editable content, for kit
// sites and core sites alike. Hostsmith's CMS, checks and agents read it, and
// a core site's Decap config is generated from it.
//
// It comes from what Astro writes when it syncs a site: the collections in
// .astro/content.d.ts, each collection's JSON Schema in .astro/collections/,
// and each entry's file path in the content data store. computeExport() takes
// those as plain data, so the tests can hand it any site. readExportInputs()
// reads them from a synced site.
//
// The format:
//
//   { version: 1, generator, kind: "core" | "kit", media: { dir, publicPath },
//     fieldAttribute: { name, format },
//     collections: { <name>: folder or files collection } }
//
// A folder collection is { type: "folder", editable: true, path, pattern,
// format, locales, fields }, and a files collection { type: "files",
// editable: true, format, locales, files: { <id>: { path, fields } } }. A
// collection whose entries come from no file is { editable: false, fields }. `format` is "markdown", "yaml" or "json".
// `locales` is null, or { default, codes, structure }, with Decap's name for
// where each locale's content lives. `fields` is a JSON Schema of one locale's
// data in an entry, with each field's CMS widget as `x-widget`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as devalue from "devalue";
import { MANIFEST } from "./manifest.mjs";

export const EXPORT_FILE = ".hostsmith/schema.json";
export const EXPORT_COMMAND = "site-kit schema";

// A problem the site has to fix, as opposed to a bug.
export class ExportError extends Error {}

const FORMATS = { md: "markdown", markdown: "markdown", yml: "yaml", yaml: "yaml", json: "json" };
const STRUCTURES = ["multiple_folders", "multiple_files"];

// The export of a site, from its inputs:
// - kind: "kit" or "core";
// - manifest: the parsed hostsmith.json;
// - locales: { default, codes }, a core site's from its manifest or a kit
//   site's from the kit, or null for a site in one language;
// - collections: every collection the site's content config has;
// - schemas: each collection's JSON Schema, as Astro wrote it;
// - entries: each collection's entries, as { id, filePath }, with file paths
//   relative to the site's root.
// Returns { schema, warnings }.
export function computeExport({ kind, manifest, locales, collections, schemas, entries }) {
  const media = manifest.media;
  if (typeof media?.dir !== "string" || typeof media?.publicPath !== "string") {
    throw new ExportError(`${MANIFEST} needs media.dir and media.publicPath, such as { "dir": "public/assets", "publicPath": "/assets" }.`);
  }
  const overrides = manifest.content?.collections ?? {};

  const warnings = [];
  const out = {};
  for (const name of [...new Set(collections)].sort()) {
    const list = entries[name] ?? [];
    const files = list.flatMap((entry) => (entry.filePath ? [{ id: entry.id, path: entry.filePath }] : []));
    const set = override(name, overrides[name]);
    const schema = schemas[name];
    // A collection whose entries come from elsewhere, such as a CMS's loader:
    // the platform knows its fields, but can't edit it (D86).
    if (set.editable === false || (list.length > 0 && files.length === 0)) {
      out[name] = { editable: false, fields: schema ? withWidgets(withoutSchemaKeys(schema)) : null };
      continue;
    }
    if (!schema) {
      if (files.length > 0) {
        throw new ExportError(`Collection "${name}" has entries, but Astro wrote no JSON Schema for it in .astro/collections/. Astro only warns when it can't: see the warnings of "astro sync".`);
      }
      continue;
    }
    out[name] = isFilesSchema(schema) ? filesCollection(name, schema, files, locales) : folderCollection(name, schema, files, locales, set);
  }

  return {
    schema: {
      version: 1,
      generator: "@hostsmith/site-kit-astro",
      kind,
      media: { dir: media.dir, publicPath: media.publicPath },
      fieldAttribute: { name: "data-field", format: "<collection>/<entry id>#<path>" },
      collections: out,
    },
    warnings,
  };
}

// The file's text: two-space indents and a final newline, so two runs on one
// site give the same bytes.
export function serializeExport(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

// A union whose branches each name their page is a files collection, which
// pageCopy() makes (design D77). Any other schema is a folder's.
function isFilesSchema(schema) {
  const branches = schema.anyOf;
  return Array.isArray(branches) && branches.length > 0 && branches.every((branch) => typeof branch?.["x-file"] === "string");
}

function filesCollection(name, schema, files, locales) {
  const pages = new Map(schema.anyOf.map((branch) => [branch["x-file"], branch]));
  // pageCopy() reads YAML files, and fails the build on a page without one.
  const format = files.length > 0 ? formatOf(name, extension(files[0].path)) : "yaml";
  const out = {};
  for (const file of [...files].sort((a, b) => a.id.localeCompare(b.id))) {
    const branch = pages.get(file.id);
    if (!branch) throw new ExportError(`${file.path} is in collection "${name}", but no page "${file.id}" is declared in pageCopy().`);
    const { "x-file": _, ...fields } = branch;
    out[file.id] = { path: file.path, fields: withWidgets(locales ? localeFields(name, file.id, fields, locales) : fields) };
  }
  return { type: "files", editable: true, format, locales: locales ? { ...locales, structure: "single_file" } : null, files: out };
}

// A translated page's schema wraps one schema per locale code. The export
// gives one locale's fields, as for every structure.
function localeFields(name, page, fields, locales) {
  const own = fields.properties?.[locales.default];
  if (!own || !locales.codes.every((code) => code in fields.properties)) {
    throw new ExportError(`Page "${page}" in collection "${name}" has no schema per locale (${locales.codes.join(", ")}). pageCopy() reads the locales from content.locales in ${MANIFEST}.`);
  }
  return own;
}

// The manifest's content.collections.<name>: { path, pattern, i18n, editable },
// each optional.
function override(name, value) {
  if (value === undefined) return {};
  const where = `content.collections.${name} in ${MANIFEST}`;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExportError(`${where} must be an object with "path", "pattern", "i18n" or "editable".`);
  const { path, pattern, i18n, editable, ...extra } = value;
  if (Object.keys(extra).length > 0) throw new ExportError(`${where} has "${Object.keys(extra)[0]}". It may set "path", "pattern", "i18n" and "editable".`);
  if (editable !== undefined && typeof editable !== "boolean") throw new ExportError(`${where} sets "editable" to ${JSON.stringify(editable)}. It is false for a collection whose entries come from elsewhere.`);
  if (path !== undefined && (typeof path !== "string" || path === "" || path.startsWith("/") || path.endsWith("/"))) {
    throw new ExportError(`${where} sets "path" to ${JSON.stringify(path)}. It is a folder relative to the site's root, such as "src/content/events".`);
  }
  if (pattern !== undefined && (typeof pattern !== "string" || !/^(\*\*\/)?\*\.[a-z]+$/.test(pattern))) {
    throw new ExportError(`${where} sets "pattern" to ${JSON.stringify(pattern)}. It is "*.<extension>", or "**/*.<extension>" with subfolders.`);
  }
  if (i18n !== undefined && i18n !== false && !STRUCTURES.includes(i18n)) {
    throw new ExportError(`${where} sets "i18n" to ${JSON.stringify(i18n)}. It is "multiple_folders", "multiple_files" or false.`);
  }
  return { path, pattern, i18n, editable };
}

function folderCollection(name, schema, files, locales, set) {
  // The manifest's structure, if it sets one. A site in one language has none.
  const forced = locales ? set.i18n : false;
  let found;
  if (set.path === undefined || set.pattern === undefined || (locales && set.i18n === undefined)) {
    if (files.length === 0) {
      const needs = locales ? `{ "path": "src/content/${name}", "pattern": "*.md", "i18n": "multiple_folders" }` : `{ "path": "src/content/${name}", "pattern": "*.md" }`;
      throw new ExportError(`Collection "${name}" has no entries, so the export can't find its files. Set content.collections.${name} in ${MANIFEST} to ${needs}.`);
    }
    found = locate(name, files.map((file) => file.path), locales, forced);
  }
  const pattern = set.pattern ?? found.pattern;
  const structure = forced === undefined ? found.structure : forced || null;
  return {
    type: "folder",
    editable: true,
    path: set.path ?? found.path,
    pattern,
    format: formatOf(name, pattern.slice(pattern.lastIndexOf(".") + 1)),
    locales: locales && structure ? { ...locales, structure } : null,
    fields: withWidgets(withoutSchemaKeys(schema)),
  };
}

// Every field's CMS widget, as `x-widget` (D79). A field built with one of the
// core's helpers has the helper's, and a site may set its own. Any other field
// takes it from its type: a string is "string", an enum "select", a boolean
// "boolean", a number "number", a list "list" and an object "object". A field
// of no single type, such as a union, gets none, and each branch's fields get
// theirs. The entry itself isn't a field.
function withWidgets(schema) {
  const out = { ...schema };
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, field(value)]));
  if (schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)) out.items = field(schema.items);
  for (const key of ["anyOf", "oneOf"]) {
    if (Array.isArray(schema[key])) out[key] = schema[key].map(withWidgets);
  }
  return out;
}

function field(schema) {
  const out = withWidgets(schema);
  if (out["x-widget"] === undefined) {
    const widget = Array.isArray(out.enum) ? "select" : WIDGETS[out.type];
    if (widget) out["x-widget"] = widget;
  }
  return out;
}

const WIDGETS = { string: "string", boolean: "boolean", number: "number", integer: "number", array: "list", object: "object" };

// Astro gives a collection's object schema the `$schema` keyword, and a
// `$schema` property so editors can validate a file. Neither is content.
function withoutSchemaKeys(schema) {
  const { $schema: _, ...fields } = schema;
  if (fields.properties && "$schema" in fields.properties) {
    const { $schema: __, ...properties } = fields.properties;
    fields.properties = properties;
  }
  return fields;
}

// Where a folder collection's files are, from its entries' paths (D76), and
// where each locale's files are (D85): a folder per locale code, or the code
// before the extension. `forced` is the manifest's structure, if it sets one.
// Returns { path, pattern, structure }, with a null structure for a
// collection in one language.
function locate(name, paths, locales, forced) {
  const extensions = [...new Set(paths.map(extension))];
  if (extensions.length > 1) {
    throw new ExportError(`Collection "${name}" has entries in ${extensions.map((ext) => `.${ext}`).join(" and ")} files. Give them one extension, or set content.collections.${name} in ${MANIFEST}.`);
  }
  const ext = extensions[0];
  const fix = `set content.collections.${name} in ${MANIFEST}`;

  if (locales && forced !== false) {
    const codes = new Set(locales.codes);
    // Each path without its locale suffix, or null without one.
    const suffixed = paths.map((path) => {
      const match = /^(.*)\.([^./]+)\.[^./]+$/.exec(path);
      return match && codes.has(match[2]) ? `${match[1]}.${ext}` : null;
    });
    // Each path's first folder that is a locale code, or null without one.
    const foldered = paths.map((path) => {
      const segments = path.split("/");
      const at = segments.slice(0, -1).findIndex((segment) => codes.has(segment));
      return at === -1 ? null : { at, segments };
    });
    const bySuffix = suffixed.every((path) => path !== null);
    const byFolder = foldered.every((path) => path !== null);

    if (forced === "multiple_files" || (forced === undefined && bySuffix)) {
      if (!bySuffix) throw new ExportError(`Collection "${name}" is set to "multiple_files", but ${paths[suffixed.indexOf(null)]} has no locale before its extension.`);
      return { ...folderOf(suffixed, ext), structure: "multiple_files" };
    }
    if (forced === "multiple_folders" || (forced === undefined && byFolder)) {
      if (!byFolder) throw new ExportError(`Collection "${name}" is set to "multiple_folders", but ${paths[foldered.indexOf(null)]} is in no locale's folder.`);
      const { at, segments } = foldered[0];
      const root = segments.slice(0, at).join("/");
      const other = foldered.find((path) => path.at !== at || path.segments.slice(0, at).join("/") !== root);
      if (other) {
        throw new ExportError(`Collection "${name}" has locale folders in more than one place, such as ${paths[0]} and ${other.segments.join("/")}. Put each locale's folder directly in the collection's folder, or ${fix}.`);
      }
      // A folder below a locale's folder, such as news/de/2026/a.md.
      const nested = foldered.some((path) => path.segments.length - at > 2);
      return { path: root, pattern: nested ? `**/*.${ext}` : `*.${ext}`, structure: "multiple_folders" };
    }
    const withLocale = paths.find((_, i) => suffixed[i] !== null || foldered[i] !== null);
    if (withLocale) {
      const without = paths.find((_, i) => suffixed[i] === null && foldered[i] === null);
      if (without) {
        throw new ExportError(
          `Collection "${name}" has files with a locale, such as ${withLocale}, and files without one, such as ${without}. ` +
            `The CMS needs the default locale in its own folder or suffix too: move those files, or ${fix}.`,
        );
      }
      throw new ExportError(`Collection "${name}" has both locale folders and locale suffixes. Use one of them, or ${fix}.`);
    }
  }
  return { ...folderOf(paths, ext), structure: null };
}

// The deepest folder that holds every path, and the pattern of their files.
function folderOf(paths, ext) {
  const dirs = paths.map((path) => path.split("/").slice(0, -1));
  let common = dirs[0];
  for (const dir of dirs) {
    let same = 0;
    while (same < common.length && same < dir.length && common[same] === dir[same]) same++;
    common = common.slice(0, same);
  }
  const nested = dirs.some((dir) => dir.length > common.length);
  return { path: common.join("/"), pattern: nested ? `**/*.${ext}` : `*.${ext}` };
}

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") ? path.slice(dot + 1) : "";
}

function formatOf(name, ext) {
  const format = FORMATS[ext];
  if (!format) {
    throw new ExportError(`Collection "${name}" has .${ext} files, which the CMS can't edit. A collection's files are .md, .yml, .yaml or .json.`);
  }
  return format;
}

// The committed export against a fresh one's text, for `--check` and the
// build (D75): "missing", "stale", or undefined when it matches.
export function exportState(root, text) {
  const file = join(root, EXPORT_FILE);
  if (!existsSync(file)) return "missing";
  return readFileSync(file, "utf8") === text ? undefined : "stale";
}

export const EXPORT_MESSAGES = {
  missing: `${EXPORT_FILE} is missing. Run ${EXPORT_COMMAND} and commit the file, so Hostsmith's CMS can read the site's collections.`,
  stale: `${EXPORT_FILE} doesn't match the site's collections. Run ${EXPORT_COMMAND} and commit the file. After a kit update, run ${EXPORT_COMMAND}.`,
};

// What computeExport() needs, from a site that Astro has just synced or built.
// `cacheDir` is the Astro config's, where a build and `astro sync` keep the
// data store.
export function readExportInputs(root, { manifest, kind, locales, cacheDir }) {
  const dotAstro = join(root, ".astro");
  const types = join(dotAstro, "content.d.ts");
  // Astro rewrites this file on every sync, and names each collection in it.
  // It leaves old JSON Schemas in .astro/collections/, and the data store has
  // no key for a collection without entries.
  const collections = existsSync(types) ? [...readFileSync(types, "utf8").matchAll(/^\s*collection: ("(?:[^"\\]|\\.)*");$/gm)].map((match) => JSON.parse(match[1])) : [];

  const schemas = {};
  for (const name of collections) {
    const file = join(dotAstro, "collections", `${name}.schema.json`);
    if (existsSync(file)) schemas[name] = JSON.parse(readFileSync(file, "utf8"));
  }

  const entries = {};
  const store = join(cacheDir, "data-store.json");
  if (existsSync(store)) {
    const data = devalue.parse(readFileSync(store, "utf8"));
    for (const name of collections) {
      const map = data.get(name);
      if (map) entries[name] = [...map.values()].map(({ id, filePath }) => ({ id, filePath }));
    }
  }
  return { kind, manifest, locales, collections: [...new Set(collections)], schemas, entries };
}
