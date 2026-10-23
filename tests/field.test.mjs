// site-kit-sections, "Field attribute format", and site-core, "Field binder".
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { field, fieldsFor, formatPath, sectionFields } from "../packages/site-kit-astro/src/core/field.ts";

describe("field()", () => {
  it("addresses a section prop by section id", () => {
    const s = sectionFields("pages/home", { id: "s7k2", type: "hero" });
    assert.deepEqual(s.root, { "data-section": "hero" });
    assert.deepEqual(s.field("title"), { "data-field": "pages/home#sections[s7k2].title" });
  });

  it("addresses a list item inside a section by index", () => {
    const s = sectionFields("pages/home", { id: "q1m9", type: "faq" });
    assert.deepEqual(s.field("items", 0, "answer"), { "data-field": "pages/home#sections[q1m9].items[0].answer" });
  });

  it("addresses a collection entry field", () => {
    assert.deepEqual(field("news/fresh-rye", "title"), { "data-field": "news/fresh-rye#title" });
  });

  it("addresses a settings list item", () => {
    assert.deepEqual(field("settings/site", "nav", 2, "label"), { "data-field": "settings/site#nav[2].label" });
  });

  it("keeps paths when sections are reordered", () => {
    const hero = { id: "s7k2", type: "hero" };
    const faq = { id: "q1m9", type: "faq" };
    const before = [hero, faq].map((s) => sectionFields("pages/home", s).field("title"));
    const after = [faq, hero].map((s) => sectionFields("pages/home", s).field("title")).reverse();
    assert.deepEqual(after, before);
  });

  it("formats nested paths", () => {
    assert.equal(formatPath(["cta", "label"]), "cta.label");
    assert.equal(formatPath(["images", 3, "alt"]), "images[3].alt");
    assert.equal(formatPath(["body"]), "body");
  });
});

describe("fieldsFor()", () => {
  it("keeps a dotted path as written", () => {
    assert.deepEqual(fieldsFor("copy", "home")("hero.title"), { "data-field": "copy/home#hero.title" });
  });

  it("addresses a list item by index", () => {
    assert.deepEqual(fieldsFor("copy", "about")("items", 2, "title"), { "data-field": "copy/about#items[2].title" });
  });
});
