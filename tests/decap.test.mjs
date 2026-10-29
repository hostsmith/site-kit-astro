// site-kit-content-model, "Decap config is the schema source".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseFrontmatter } from "astro/markdown";
import { ASSEMBLED, assemble, SITE_PART, staleness } from "../packages/site-kit-astro/scripts/decap-config.mjs";
import { localeCodes } from "../packages/site-kit-astro/scripts/site-config.mjs";
import { defineKitContent, PART_UI_PARAMS } from "../packages/site-kit-astro/src/kit-content.ts";
import { CONTENT_ICONS } from "../packages/site-kit-astro/src/lib/icons.ts";
import { siteConfig } from "../examples/basics/src/site.config.ts";
import * as siteSchema from "../examples/basics/src/site.schema.ts";
import { BASICS, buildFixture, EXAMPLE_NAMES, EXAMPLES, PACKAGE, REPO } from "./helpers.mjs";

const { sectionSchemas } = defineKitContent(siteConfig, siteSchema);
const parse = (yaml) => parseFrontmatter(`---\n${yaml}\n---\n`).frontmatter;
const text = readFileSync(join(BASICS, ASSEMBLED), "utf8");
const config = parse(text);
const kitPart = readFileSync(join(PACKAGE, "decap", "config.kit.yml"), "utf8");
// The locales of a site in one language, as decap-config reads them.
const EN = ["en"];
const pages = config.collections.find((c) => c.name === "pages");
const sections = pages.fields.find((f) => f.name === "sections");

function* walk(value) {
  if (Array.isArray(value)) for (const item of value) yield* walk(item);
  else if (value && typeof value === "object") {
    yield value;
    for (const item of Object.values(value)) yield* walk(item);
  }
}

// The object shape of a prop schema, through optional, default and list wrappers.
function shapeOf(schema) {
  for (let s = schema; s; ) {
    if (s.shape) return s.shape;
    const def = s._zod.def;
    s = def.type === "array" ? def.element : def.innerType;
  }
  return undefined;
}

// The types of a list widget without a field, which make Decap reject the
// whole config (site-kit-locales design D52).
function typesWithoutFields(value) {
  return [...walk(value)].flatMap((node) => (Array.isArray(node.types) ? node.types.filter((type) => !type.fields?.length).map((type) => type.name) : []));
}

// Compares Decap fields with Zod props, including the fields of object and list props.
function assertSameFields(fields, shape, where) {
  const names = fields.map((f) => f.name);
  const props = Object.keys(shape).filter((key) => key !== "type");
  assert.deepEqual([...names].sort(), props.sort(), `${where}: Decap fields and Zod props differ`);
  for (const field of fields.filter((f) => f.fields)) {
    const inner = shapeOf(shape[field.name]);
    assert.ok(inner, `${where}.${field.name} has Decap fields but no Zod object`);
    assertSameFields(field.fields, inner, `${where}.${field.name}`);
  }
}

describe("public/admin/config.yml", () => {
  it("uses the github backend and the media folders", () => {
    assert.equal(config.backend.name, "github");
    assert.equal(config.media_folder, "public/assets");
    assert.equal(config.public_folder, "/assets");
  });

  it("lists every registered section type exactly once", () => {
    assert.equal(sections.widget, "list");
    assert.equal(sections.typeKey, "type");
    const names = sections.types.map((t) => t.name);
    assert.deepEqual([...names].sort(), Object.keys(sectionSchemas).sort());
    assert.equal(new Set(names).size, names.length, "a type appears twice");
  });

  it("gives every section type an id field and the schema's props", () => {
    for (const type of sections.types) {
      assert.ok(type.fields.some((f) => f.name === "id"), `${type.name} has no id field`);
      assertSameFields(type.fields, sectionSchemas[type.name].shape, type.name);
    }
  });

  // site-kit-section-library, "Kit icon set".
  it("offers the kit's icon names in every icon select", () => {
    const selects = [...walk(sections.types)].filter((field) => field.name === "icon");
    assert.ok(selects.length > 0, "no section type has an icon field");
    for (const select of selects) {
      assert.equal(select.widget, "select");
      assert.deepEqual(select.options, [...CONTENT_ICONS]);
    }
  });

  // site-kit-interactive-parts, "Interface strings of interactive parts".
  it("offers every interactive part's interface string, none of them required", () => {
    const settings = config.collections.find((c) => c.name === "settings");
    const ui = settings.fields.find((f) => f.name === "ui").fields;
    for (const key of Object.keys(PART_UI_PARAMS)) {
      const field = ui.find((f) => f.name === key);
      assert.ok(field, `no field for ${key}`);
      assert.equal(field.required, false, `${key} is required`);
    }
  });

  it("has a settings folder and a folder collection per site collection", () => {
    const settings = config.collections.find((c) => c.name === "settings");
    assert.equal(settings.folder, "src/content/settings");
    for (const name of Object.keys(siteConfig.collections)) {
      const collection = config.collections.find((c) => c.name === name);
      assert.equal(collection?.folder, `src/content/${name}`, `no folder collection for ${name}`);
    }
  });

  it("uses no Sveltia-only options and no dropped features", () => {
    for (const option of ["omit_empty_optional_fields", "slugify_filename", "local_backend"]) {
      assert.ok(!text.includes(option), `config.yml uses ${option}`);
    }
    assert.doesNotMatch(text, /git-gateway|netlify|bitbucket|azure|remark/i);
    for (const node of walk(config)) {
      if (node.widget === "image" || node.widget === "file") assert.ok(!("multiple" in node), `${node.name} uses "multiple"`);
    }
  });

  it("gives every type of every list a field, as Decap requires", () => {
    assert.deepEqual(typesWithoutFields(config), []);
  });

  // site-locales design D61: what a CMS can't save, or doesn't list.
  it("lists nested pages, each a file of its own", () => {
    assert.ok(pages.nested?.depth >= 2, "the pages collection has no nested option");
    assert.equal(pages.nested.subfolders, false, "Decap would look for nested pages as _index.md files");
  });

  it("lets the CMS save a field left empty", () => {
    const blocking = [];
    const check = (fields, path, inOptionalObject) => {
      for (const field of fields ?? []) {
        const where = `${path}.${field.name}`;
        const required = field.required !== false;
        if (inOptionalObject && required) blocking.push(`${where}: required in an optional object`);
        if (field.widget === "select" && "default" in field && required) blocking.push(`${where}: a select with a default`);
        check(field.fields, where, field.widget === "object" && !required);
        for (const type of field.types ?? []) check(type.fields, `${where}<${type.name}>`, false);
      }
    };
    for (const collection of config.collections) {
      check(collection.fields, collection.name, false);
      for (const file of collection.files ?? []) check(file.fields, `${collection.name}/${file.name}`, false);
    }
    assert.deepEqual(blocking, []);
  });
});

// site-kit-content-model, "Stale assembled config"; site-kit-updates design D21.
describe("npm run decap-config", () => {
  const sitePart = readFileSync(join(REPO, "tests", "fixtures", "base", "site", SITE_PART), "utf8");
  const menuBoard = [
    "section_types:",
    "  - name: menu-board",
    "    label: Menu board",
    "    widget: object",
    "    fields:",
    "      - { name: title, label: Title, widget: string }",
  ].join("\n");
  const blog = ["  - name: blog", "    label: Blog", "    folder: src/content/blog", "    fields:", "      - { name: title, label: Title, widget: string }"].join("\n");

  it("left every example's config.yml matching its two parts", async () => {
    for (const example of EXAMPLE_NAMES) {
      const problem = staleness(join(EXAMPLES, example), await localeCodes(join(EXAMPLES, example)));
      assert.ok(!problem, `${example}: ${problem}`);
    }
  });

  it("names the site's part and the command when config.yml was edited by hand", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-decap-"));
    try {
      await cp(join(BASICS, "public", "admin"), join(dir, "public", "admin"), { recursive: true });
      await writeFile(join(dir, ASSEMBLED), text.replace("label: Hero", "label: Big hero"));
      assert.match(staleness(dir, EN), /public\/admin\/config\.yml doesn't match the kit's part, public\/admin\/config\.site\.yml and the site variants in src\/site\.config\.ts\. Edit public\/admin\/config\.site\.yml or src\/site\.config\.ts.*npm run decap-config/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails the build when config.yml is stale", async () => {
    const build = await buildFixture("base", { files: { [ASSEMBLED]: text.replace("label: Hero", "label: Big hero") } });
    try {
      assert.ok(!build.ok, "the build passed");
      assert.match(build.output, /config\.site\.yml.*npm run decap-config/);
    } finally {
      await build.cleanup();
    }
  });

  it("adds the kit's id field and reveal field to a site-local type", () => {
    const assembled = parse(assemble(kitPart, sitePart.replace("section_types: []", menuBoard), EN));
    const types = assembled.collections.find((c) => c.name === "pages").fields.find((f) => f.name === "sections").types;
    const type = types.find((t) => t.name === "menu-board");
    assert.ok(type, "menu-board is missing");
    assert.deepEqual(type.fields[0], types[0].fields[0], "the first field is the kit's id field");
    assert.deepEqual(type.fields[1], types[0].fields[1], "the second field is the kit's reveal field");
    assert.deepEqual(type.fields.map((f) => f.name), ["id", "reveal", "title"]);
  });

  it("offers every folder collection, and nothing else, in the collection list", () => {
    const assembled = parse(assemble(kitPart, sitePart.replace("collections:\n", `collections:\n${blog}\n`), EN));
    const types = assembled.collections.find((c) => c.name === "pages").fields.find((f) => f.name === "sections").types;
    const collection = types.find((t) => t.name === "collection-list").fields.find((f) => f.name === "collection");
    assert.deepEqual(collection.options, ["blog", "news"]);
  });

  it("fails on a site-local type with its own id field", () => {
    const withId = menuBoard.replace("    fields:", "    fields:\n      - { name: id, label: Id, widget: string }");
    assert.throws(() => assemble(kitPart, sitePart.replace("section_types: []", withId), EN), /config\.site\.yml line \d+: section type "menu-board" has an id field/);
  });

  it("fails on an unknown key in the site part", () => {
    assert.throws(() => assemble(kitPart, `${sitePart}\nmedia_folder: public/media\n`, EN), /config\.site\.yml line \d+: unknown key "media_folder"/);
  });

  // site-kit-ui-strings, "The Decap part mirrors the declared keys".
  it("adds the site's interface string fields to the settings' ui, with the plural forms", () => {
    const ui = [
      "ui:",
      "  - { name: keepReading, label: Keep reading, widget: string }",
      "  - { name: minRead, label: Minutes to read, widget: object, fields: *plural_forms }",
      "  - name: wordCount",
      "    label: Word count",
      "    widget: object",
      "    fields: *plural_forms",
    ].join("\n");
    const assembled = parse(assemble(kitPart, `${sitePart}\n${ui}\n`, EN));
    const fields = assembled.collections.find((c) => c.name === "settings").fields.find((f) => f.name === "ui").fields;
    assert.deepEqual(fields.slice(-3).map((f) => f.name), ["keepReading", "minRead", "wordCount"]);
    for (const name of ["minRead", "wordCount"]) {
      const forms = fields.find((f) => f.name === name).fields;
      assert.deepEqual(forms.map((f) => f.name), ["zero", "one", "two", "few", "many", "other"]);
      assert.deepEqual(forms.filter((f) => f.required !== false).map((f) => f.name), ["other"], "only other is required");
    }
  });
});

// site-kit-locales, "Decap i18n for every site" (design D55).
describe("npm run decap-config for a site with several locales", () => {
  const sitePart = readFileSync(join(REPO, "tests", "fixtures", "locales", "site", SITE_PART), "utf8");
  const localizedText = assemble(kitPart, sitePart, ["en", "de"]);
  const localized = parse(localizedText);
  const collection = (name) => localized.collections.find((c) => c.name === name);

  // Every field at every depth, and the entries of each list's `types`.
  function fieldsAndTypes(fields, found = { fields: [], types: [] }) {
    for (const field of fields ?? []) {
      found.fields.push(field);
      fieldsAndTypes(field.fields, found);
      if (field.field) fieldsAndTypes([field.field], found);
      for (const type of field.types ?? []) {
        found.types.push(type);
        fieldsAndTypes(type.fields, found);
      }
    }
    return found;
  }

  // site-kit-locales, "Only Decap's i18n options".
  it("writes Decap's i18n settings, and none of Sveltia's", () => {
    assert.deepEqual(localized.i18n, { structure: "multiple_files", locales: ["en", "de"], default_locale: "en" });
    for (const option of ["omit_default_locale_from_file_path", "initial_locales", "duplicate_if_empty", "save_all_locales", "canonical_slug"]) {
      assert.ok(!localizedText.includes(option), `config.yml uses ${option}`);
    }
    assert.doesNotMatch(localizedText, /\{\{locale\}\}/, "a slug template");
    for (const c of localized.collections) assert.equal(c.i18n, true, `${c.name} has i18n options of its own`);
  });

  it("translates the pages, the settings and each site collection, every field included", () => {
    assert.deepEqual(localized.collections.map((c) => c.name), ["pages", "settings", "news"]);
    for (const c of localized.collections) {
      const { fields, types } = fieldsAndTypes(c.fields);
      assert.deepEqual(fields.filter((field) => field.i18n !== true).map((field) => field.name), [], `${c.name}: fields without i18n`);
      assert.deepEqual(types.filter((type) => "i18n" in type).map((type) => type.name), [], `${c.name}: types with i18n`);
    }
  });

  it("makes the settings a folder collection, one entry per locale", () => {
    const settings = collection("settings");
    assert.equal(settings.folder, "src/content/settings");
    assert.equal(settings.extension, "yml");
    assert.equal(settings.create, false);
    assert.equal(settings.summary, "Site settings");
    assert.ok(settings.fields.some((field) => field.name === "ui"));
    assert.ok(localized.collections.every((c) => !c.files), "a files collection is left");
  });

  it("adds a localSlug field to the pages and each site collection", () => {
    for (const name of ["pages", "news"]) {
      const field = collection(name).fields.find((f) => f.name === "localSlug");
      assert.ok(field, `${name} has no localSlug field`);
      assert.equal(field.required, false);
      assert.match(field.hint, /Only for a translation/);
    }
    assert.ok(!collection("settings").fields.some((f) => f.name === "localSlug"));
  });

  // site-kit-locales, "Link field in a localized site".
  it("hints on every link field, the site's too, to write the default locale's path", () => {
    const withLink = sitePart.replace("      - { name: body,", "      - { name: link, label: Link, widget: string, required: false }\n      - { name: body,");
    for (const c of parse(assemble(kitPart, withLink, ["en", "de"])).collections) {
      const links = [...walk(c.fields)].filter((field) => field.name === "link" && field.widget === "string");
      assert.ok(links.length > 0, `${c.name} has no link field`);
      for (const field of links) assert.match(field.hint, /^For a page on this site, write its path in the default language \(en\), such as \/contact/);
    }
  });

  it("gives every type of every list a field, as Decap requires", () => {
    assert.deepEqual(typesWithoutFields(localized), []);
  });

  it("keeps the nested pages and the kit's anchors", () => {
    assert.ok(collection("pages").nested?.depth >= 2);
    assert.match(localizedText, /&labeled_link\n/);
    assert.match(localizedText, /fields: \*labeled_link/);
  });

  // site-kit-locales, "Files collection in the site part".
  it("fails on a files collection, such as the old custom pages, naming it", () => {
    const customPages = [
      "  - name: custom-pages",
      "    label: Custom pages",
      "    files:",
      "      - name: about",
      "        label: About",
      "        file: src/content/pages/about.en.md",
      "        fields:",
      "          - { name: title, label: Title, widget: string }",
    ].join("\n");
    for (const locales of [EN, ["en", "de"]]) {
      assert.throws(
        () => assemble(kitPart, sitePart.replace("collections:\n", `collections:\n${customPages}\n`), locales),
        /config\.site\.yml: "custom-pages" is a files collection.*pages collection.*remove "custom-pages"/,
      );
    }
  });

  // site-kit-locales, "One locale".
  it("writes the same i18n settings for a site with one locale, without localSlug or the link hint", () => {
    assert.deepEqual(config.i18n, { structure: "multiple_files", locales: ["en"], default_locale: "en" });
    assert.equal(config.collections.find((c) => c.name === "settings").folder, "src/content/settings");
    assert.doesNotMatch(text, /localSlug/);
    assert.doesNotMatch(text, /path in the default language/);
    for (const c of config.collections) assert.equal(c.i18n, true, `${c.name} isn't translated`);
  });

  it("fails without locales", () => {
    assert.throws(() => assemble(kitPart, sitePart), /every site lists its locales in src\/site\.config\.ts/);
  });

  it("fails the build when config.yml lacks the site's locales", async () => {
    const build = await buildFixture("locales", { files: { [ASSEMBLED]: assemble(kitPart, sitePart, EN) } });
    try {
      assert.ok(!build.ok, "the build passed");
      assert.match(build.output, /config\.site\.yml.*npm run decap-config/);
    } finally {
      await build.cleanup();
    }
  });
});
