// site-kit-content-model, "Decap config is the schema source".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseFrontmatter } from "astro/markdown";
import { ASSEMBLED, assemble, KIT_PART, SITE_PART, staleness } from "../scripts/decap-config.mjs";
import { sectionSchemas } from "../src/content.config.ts";
import { siteConfig } from "../src/site.config.ts";
import { ROOT } from "./helpers.mjs";

const parse = (yaml) => parseFrontmatter(`---\n${yaml}\n---\n`).frontmatter;
const text = readFileSync(join(ROOT, ASSEMBLED), "utf8");
const config = parse(text);
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

  it("has a settings file and a folder collection per site collection", () => {
    const settings = config.collections.find((c) => c.name === "settings");
    assert.equal(settings.files[0].file, "src/content/settings/site.yml");
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
});

// site-kit-content-model, "Stale assembled config"; site-kit-updates design D19.
describe("npm run decap-config", () => {
  const kitPart = readFileSync(join(ROOT, KIT_PART), "utf8");
  // The base fixture's site part, which every site repo has unchanged.
  const sitePart = readFileSync(join(ROOT, "tests", "fixtures", "base", "site", SITE_PART), "utf8");
  const menuBoard = [
    "section_types:",
    "  - name: menu-board",
    "    label: Menu board",
    "    widget: object",
    "    fields:",
    "      - { name: title, label: Title, widget: string }",
  ].join("\n");
  const blog = ["  - name: blog", "    label: Blog", "    folder: src/content/blog", "    fields:", "      - { name: title, label: Title, widget: string }"].join("\n");

  it("left config.yml matching its two parts", () => {
    const problem = staleness(ROOT);
    assert.ok(!problem, problem);
  });

  it("names both parts when config.yml was edited by hand", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-decap-"));
    try {
      await cp(join(ROOT, "public", "admin"), join(dir, "public", "admin"), { recursive: true });
      await writeFile(join(dir, ASSEMBLED), text.replace("label: Hero", "label: Big hero"));
      assert.match(staleness(dir), /public\/admin\/config\.yml doesn't match public\/admin\/config\.kit\.yml and public\/admin\/config\.site\.yml/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("adds the kit's id field to a site-local type", () => {
    const assembled = parse(assemble(kitPart, sitePart.replace("section_types: []", menuBoard)));
    const types = assembled.collections.find((c) => c.name === "pages").fields.find((f) => f.name === "sections").types;
    const type = types.find((t) => t.name === "menu-board");
    assert.ok(type, "menu-board is missing");
    assert.deepEqual(type.fields[0], types[0].fields[0], "the first field is the kit's id field");
    assert.deepEqual(type.fields.map((f) => f.name), ["id", "title"]);
  });

  it("offers every folder collection, and nothing else, in the collection list", () => {
    const assembled = parse(assemble(kitPart, sitePart.replace("collections:\n", `collections:\n${blog}\n`)));
    const types = assembled.collections.find((c) => c.name === "pages").fields.find((f) => f.name === "sections").types;
    const collection = types.find((t) => t.name === "collection-list").fields.find((f) => f.name === "collection");
    assert.deepEqual(collection.options, ["blog", "news"]);
  });

  it("fails on a site-local type with its own id field", () => {
    const withId = menuBoard.replace("    fields:", "    fields:\n      - { name: id, label: Id, widget: string }");
    assert.throws(() => assemble(kitPart, sitePart.replace("section_types: []", withId)), /config\.site\.yml line \d+: section type "menu-board" has an id field/);
  });

  it("fails on an unknown key in the site part", () => {
    assert.throws(() => assemble(kitPart, `${sitePart}\nmedia_folder: public/media\n`), /config\.site\.yml line \d+: unknown key "media_folder"/);
  });
});
