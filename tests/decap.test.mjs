// site-kit-content-model, "Decap config is the schema source".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseFrontmatter } from "astro/markdown";
import { sectionSchemas } from "../src/content.config.ts";
import { ROOT } from "./helpers.mjs";

const text = readFileSync(join(ROOT, "public/admin/config.yml"), "utf8");
const config = parseFrontmatter(`---\n${text}\n---\n`).frontmatter;
const pages = config.collections.find((c) => c.name === "pages");
const sections = pages.fields.find((f) => f.name === "sections");

function* walk(value) {
  if (Array.isArray(value)) for (const item of value) yield* walk(item);
  else if (value && typeof value === "object") {
    yield value;
    for (const item of Object.values(value)) yield* walk(item);
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
      const fields = type.fields.map((f) => f.name);
      assert.ok(fields.includes("id"), `${type.name} has no id field`);
      const props = Object.keys(sectionSchemas[type.name].shape).filter((key) => key !== "type");
      assert.deepEqual([...fields].sort(), props.sort(), `${type.name}: Decap fields and Zod props differ`);
    }
  });

  it("has a settings file and a news folder collection", () => {
    const settings = config.collections.find((c) => c.name === "settings");
    assert.equal(settings.files[0].file, "src/content/settings/site.yml");
    const news = config.collections.find((c) => c.name === "news");
    assert.equal(news.folder, "src/content/news");
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
