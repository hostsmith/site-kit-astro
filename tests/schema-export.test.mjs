// site-core, "The schema export", "Collection locations" and "Locales in core
// sites": computeExport() on stored inputs, as Astro writes them for a site
// (site-kit-core-split design D74, D76, D85).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeExport, ExportError, serializeExport } from "../packages/site-kit-astro/scripts/core/schema-export.mjs";

const MANIFEST = { media: { dir: "public/assets", publicPath: "/assets" } };
const NEWS_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: { title: { type: "string", minLength: 1 }, image: { type: "string", pattern: "^\\/assets\\/\\S+$", "x-widget": "image" } },
  required: ["title"],
  additionalProperties: false,
};
const EN_DE = { default: "en", codes: ["en", "de"] };

// A site's inputs, with `news` unless the test says otherwise.
function site({ kind = "core", manifest = MANIFEST, locales = null, schemas = { news: NEWS_SCHEMA }, entries = {}, collections } = {}) {
  return { kind, manifest, locales, schemas, entries, collections: collections ?? Object.keys(schemas) };
}
const files = (...paths) => paths.map((path) => ({ id: path.split("/").pop().replace(/\.[^.]+$/, ""), filePath: path }));
const news = (input) => computeExport(input).schema.collections.news;
// A schema without the widgets the export gives by type, to compare its shape.
const noWidgets = (schema) =>
  JSON.parse(JSON.stringify(schema, (key, value) => (value && typeof value === "object" && !Array.isArray(value) && value["x-widget"] && value["x-widget"] !== "image" ? (({ "x-widget": _, ...rest }) => rest)(value) : value)));
const fails = (input, pattern) => assert.throws(() => computeExport(input), (error) => error instanceof ExportError && pattern.test(error.message));

describe("the schema export", () => {
  it("names the format's version, the generator without a version, the kind, media and the field attribute", () => {
    const { schema } = computeExport(site({ entries: { news: files("src/content/news/a.md") } }));
    assert.deepEqual(
      { ...schema, collections: undefined },
      {
        version: 1,
        generator: "@hostsmith/site-kit-astro",
        kind: "core",
        media: { dir: "public/assets", publicPath: "/assets" },
        fieldAttribute: { name: "data-field", format: "<collection>/<entry id>#<path>" },
        collections: undefined,
      },
    );
  });

  it("takes a collection's JSON Schema as Astro wrote it, without the $schema keyword and property", () => {
    const { $schema, ...fields } = NEWS_SCHEMA;
    const asAstroWrites = { ...NEWS_SCHEMA, properties: { ...NEWS_SCHEMA.properties, $schema: { type: "string" } } };
    assert.deepEqual(noWidgets(news(site({ schemas: { news: asAstroWrites }, entries: { news: files("src/content/news/a.md") } })).fields), fields);
  });

  it("gives the same bytes for the same site, with collections sorted by name", () => {
    const input = site({ schemas: { news: NEWS_SCHEMA, events: NEWS_SCHEMA }, entries: { news: files("src/content/news/a.md"), events: files("src/content/events/b.md") } });
    const text = serializeExport(computeExport(input).schema);
    assert.equal(serializeExport(computeExport(input).schema), text);
    assert.deepEqual(Object.keys(JSON.parse(text).collections), ["events", "news"]);
    assert.ok(text.endsWith("}\n"));
  });

  it("fails without media in the manifest, naming hostsmith.json", () => {
    fails(site({ manifest: {} }), /hostsmith\.json needs media\.dir and media\.publicPath/);
  });
});

describe("collection locations", () => {
  it("infer a folder and a pattern with subfolders", () => {
    const collection = news(site({ entries: { news: files("src/content/news/a.md", "src/content/news/2026/b.md") } }));
    assert.equal(collection.type, "folder");
    assert.equal(collection.path, "src/content/news");
    assert.equal(collection.pattern, "**/*.md");
    assert.equal(collection.format, "markdown");
    assert.equal(collection.locales, null);
  });

  it("give a flat folder `*.<ext>`, and YAML and JSON their formats", () => {
    assert.equal(news(site({ entries: { news: files("src/content/news/a.md", "src/content/news/b.md") } })).pattern, "*.md");
    assert.equal(news(site({ entries: { news: files("src/content/news/a.yml") } })).format, "yaml");
    assert.equal(news(site({ entries: { news: files("src/content/news/a.json") } })).format, "json");
  });

  it("fail for a collection without entries or an override, naming it and content.collections", () => {
    fails(site({ schemas: { events: NEWS_SCHEMA } }), /Collection "events" has no entries.*content\.collections\.events in hostsmith\.json/);
  });

  it("use the manifest's path and pattern, with or without entries", () => {
    const manifest = { ...MANIFEST, content: { collections: { events: { path: "src/content/events", pattern: "*.md" } } } };
    for (const entries of [{}, { events: files("src/content/elsewhere/a.md") }]) {
      const { events } = computeExport(site({ manifest, schemas: { events: NEWS_SCHEMA }, entries })).schema.collections;
      assert.equal(events.path, "src/content/events");
      assert.equal(events.pattern, "*.md");
    }
  });

  it("fail on an override with a key it doesn't know", () => {
    const manifest = { ...MANIFEST, content: { collections: { news: { folder: "src/content/news" } } } };
    fails(site({ manifest, entries: { news: files("src/content/news/a.md") } }), /content\.collections\.news in hostsmith\.json has "folder"/);
  });

  it("mark a collection loaded from no file not editable, with its fields and no location", () => {
    const { news } = computeExport(site({ entries: { news: [{ id: "a" }, { id: "b" }] } })).schema.collections;
    assert.deepEqual(Object.keys(news), ["editable", "fields"]);
    assert.equal(news.editable, false);
    assert.equal(news.fields.properties.title["x-widget"], "string");
  });

  it("mark a file-backed collection editable", () => {
    assert.equal(news(site({ entries: { news: files("src/content/news/a.md") } })).editable, true);
  });

  it("take the manifest's editable: false for a collection without entries yet", () => {
    const manifest = { ...MANIFEST, content: { collections: { events: { editable: false } } } };
    const { events } = computeExport(site({ manifest, schemas: { events: NEWS_SCHEMA } })).schema.collections;
    assert.equal(events.editable, false);
  });

  it("fail for entries with two extensions, naming the collection", () => {
    fails(site({ entries: { news: files("src/content/news/a.md", "src/content/news/b.mdx") } }), /Collection "news" has entries in \.md and \.mdx files/);
  });

  it("fail for files the CMS can't edit", () => {
    fails(site({ entries: { news: files("src/content/news/a.mdx") } }), /Collection "news" has \.mdx files, which the CMS can't edit/);
  });

  it("fail for a collection with entries but no JSON Schema, naming it", () => {
    fails(site({ schemas: {}, collections: ["news"], entries: { news: files("src/content/news/a.md") } }), /Collection "news" has entries, but Astro wrote no JSON Schema for it/);
  });
});

describe("page copy in the export", () => {
  const home = { type: "object", properties: { hero: { type: "object", properties: { title: { type: "string" } } } }, required: ["hero"], "x-file": "home" };
  const about = { type: "object", properties: { intro: { type: "string" } }, "x-file": "about" };
  const strip = ({ "x-file": _, ...fields }) => fields;
  // As pageCopy() wraps a page's schema in its locales: the page's name is on the wrapper.
  const wrap = (branch) => ({ type: "object", properties: { en: strip(branch), de: strip(branch) }, required: ["en", "de"], "x-file": branch["x-file"] });
  const copyEntries = { copy: [{ id: "home", filePath: "src/content/copy/home.yml" }, { id: "about", filePath: "src/content/copy/about.yml" }] };

  it("lists a union of pages as a files collection, each file with its own fields", () => {
    const { copy } = computeExport(site({ schemas: { copy: { $schema: "x", anyOf: [home, about] } }, entries: copyEntries })).schema.collections;
    assert.equal(copy.files.home.fields.properties.hero.properties.title["x-widget"], "string");
    assert.deepEqual(noWidgets(copy), {
      type: "files",
      editable: true,
      format: "yaml",
      locales: null,
      files: {
        about: { path: "src/content/copy/about.yml", fields: strip(about) },
        home: { path: "src/content/copy/home.yml", fields: strip(home) },
      },
    });
  });

  it("gives one locale's fields and single_file in a site with locales", () => {
    const { copy } = computeExport(site({ locales: EN_DE, schemas: { copy: { anyOf: [wrap(home), wrap(about)] } }, entries: copyEntries })).schema.collections;
    assert.deepEqual(copy.locales, { ...EN_DE, structure: "single_file" });
    assert.deepEqual(noWidgets(copy.files.home.fields), strip(home));
  });
});

describe("widget hints", () => {
  const fieldsOf = (properties) => news(site({ schemas: { news: { type: "object", properties } }, entries: { news: files("src/content/news/a.md") } })).fields.properties;

  it("keep a helper's hint and a site's own", () => {
    const fields = fieldsOf({ image: { type: "string", "x-widget": "image" }, intro: { type: "string", "x-widget": "text" } });
    assert.equal(fields.image["x-widget"], "image");
    assert.equal(fields.intro["x-widget"], "text");
  });

  it("mark a plain enum select, with its values", () => {
    const { category } = fieldsOf({ category: { type: "string", enum: ["Planning", "Renovation", "News"] } });
    assert.equal(category["x-widget"], "select");
    assert.deepEqual(category.enum, ["Planning", "Renovation", "News"]);
  });

  it("give other fields their widget by type, nested ones too", () => {
    const fields = fieldsOf({
      title: { type: "string" },
      draft: { type: "boolean" },
      count: { type: "integer" },
      tags: { type: "array", items: { type: "string" } },
      cta: { type: "object", properties: { label: { type: "string" } } },
    });
    assert.deepEqual(
      Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value["x-widget"]])),
      { title: "string", draft: "boolean", count: "number", tags: "list", cta: "object" },
    );
    assert.equal(fields.tags.items["x-widget"], "string");
    assert.equal(fields.cta.properties.label["x-widget"], "string");
  });

  it("give a union no widget, and each branch's fields theirs", () => {
    const { target } = fieldsOf({ target: { anyOf: [{ type: "object", properties: { url: { type: "string" } } }, { type: "boolean", const: false }] } });
    assert.equal(target["x-widget"], undefined);
    assert.equal(target.anyOf[0].properties.url["x-widget"], "string");
  });
});

describe("locales in the export", () => {
  it("are null everywhere in a core site in one language", () => {
    assert.equal(news(site({ entries: { news: files("src/content/news/en/a.md") } })).locales, null);
  });

  it("find the locale in file names", () => {
    const collection = news(site({ locales: EN_DE, entries: { news: files("src/content/news/a.en.md", "src/content/news/a.de.md") } }));
    assert.equal(collection.path, "src/content/news");
    assert.equal(collection.pattern, "*.md");
    assert.deepEqual(collection.locales, { ...EN_DE, structure: "multiple_files" });
  });

  it("find locale folders, even with one locale's entries", () => {
    const collection = news(site({ locales: EN_DE, entries: { news: files("src/content/news/en/a.md", "src/content/news/en/b.md") } }));
    assert.equal(collection.path, "src/content/news");
    assert.equal(collection.pattern, "*.md");
    assert.deepEqual(collection.locales, { ...EN_DE, structure: "multiple_folders" });
  });

  it("find subfolders below the locale folders", () => {
    assert.equal(news(site({ locales: EN_DE, entries: { news: files("src/content/news/en/a.md", "src/content/news/de/2026/b.md") } })).pattern, "**/*.md");
  });

  it("leave a collection without codes in one language", () => {
    const authors = computeExport(site({ locales: EN_DE, schemas: { authors: NEWS_SCHEMA }, entries: { authors: files("src/content/authors/jane.yml", "src/content/authors/sam.yml") } })).schema.collections.authors;
    assert.equal(authors.locales, null);
    assert.equal(authors.path, "src/content/authors");
  });

  it("fail with the default locale at the root, saying the CMS needs its own folder or suffix", () => {
    fails(
      site({ locales: EN_DE, entries: { news: files("src/content/news/a.md", "src/content/news/de/a.md") } }),
      /Collection "news" has files with a locale.*The CMS needs the default locale in its own folder or suffix.*content\.collections\.news in hostsmith\.json/,
    );
  });

  it("fail with locale folders at different depths", () => {
    fails(site({ locales: EN_DE, entries: { news: files("src/content/news/en/a.md", "src/content/news/2026/de/b.md") } }), /Collection "news" has locale folders in more than one place/);
  });

  it("take the manifest's i18n over what they find", () => {
    const manifest = { ...MANIFEST, content: { collections: { news: { i18n: false } } } };
    const collection = news(site({ manifest, locales: EN_DE, entries: { news: files("src/content/news/en/a.md") } }));
    assert.equal(collection.locales, null);
    assert.equal(collection.path, "src/content/news/en");
  });

  it("fail for an empty collection whose override lacks i18n in a site with locales", () => {
    const manifest = { ...MANIFEST, content: { collections: { events: { path: "src/content/events", pattern: "*.md" } } } };
    fails(site({ manifest, locales: EN_DE, schemas: { events: NEWS_SCHEMA } }), /Collection "events" has no entries.*"i18n"/);
  });

  it("use an empty collection's override with i18n", () => {
    const manifest = { ...MANIFEST, content: { collections: { events: { path: "src/content/events", pattern: "*.md", i18n: "multiple_folders" } } } };
    const { events } = computeExport(site({ manifest, locales: EN_DE, schemas: { events: NEWS_SCHEMA } })).schema.collections;
    assert.deepEqual(events.locales, { ...EN_DE, structure: "multiple_folders" });
  });
});
