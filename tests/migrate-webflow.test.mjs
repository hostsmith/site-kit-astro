// site-kit-webflow-migration: the Webflow migration skill in the package
// (design D97 to D99). Its index links every step and reference by a path
// from the site's root, since agents reach it through the `webflow` example's
// pointer. Each step starts with its scope, no path is written from the
// skill's own folder, and every package path it names exists. The element
// mapping covers every Webflow element the kit replaces (site-kit-webflow-example
// design D103), and the Client-First mapping every utility class of the
// Cobbleford demo's export (D112, D118), whose files stay out of this
// repository.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PACKAGE } from "./helpers.mjs";

const ROOT = "node_modules/@hostsmith/site-kit-astro/";
const SKILL_PATH = `${ROOT}skills/migrate-webflow/`;
const SKILL = join(PACKAGE, "skills", "migrate-webflow");
const read = (file) => readFileSync(join(SKILL, file), "utf8");
const markdown = (dir) => readdirSync(join(SKILL, dir)).filter((file) => file.endsWith(".md")).sort().map((file) => `${dir}/${file}`);

const STEPS = markdown("steps");
const REFERENCES = markdown("references");
const FILES = ["SKILL.md", ...STEPS, ...REFERENCES, "scripts/fidelity.mjs"];

// D99's scopes, provisional until Q19 decides the content-only mode.
const SCOPES = {
  "01-snapshot": "any",
  "02-url-map": "any",
  "03-theme": "kit",
  "04-settings": "kit",
  "05-pages-to-sections": "kit",
  "06-cms-to-collections": "any",
  "07-media": "any",
  "08-brief": "kit",
  "09-verify": "any",
  "10-report": "any",
  "11-clean-up": "kit",
};

// Every word inside the `code spans` of a Markdown file.
const codeWords = (text) => new Set([...text.matchAll(/`([^`\n]+)`/g)].flatMap(([, code]) => code.split(/[\s,:;()]+/)));

describe("Webflow migration skill", () => {
  it("has D99's steps, each starting with its scope", () => {
    assert.deepEqual(STEPS.map((step) => step.slice("steps/".length, -".md".length)), Object.keys(SCOPES));
    for (const step of STEPS) {
      const scope = SCOPES[step.slice("steps/".length, -".md".length)];
      assert.match(read(step), new RegExp(`^---\\nscope: ${scope}\\n---\\n`), `${step} doesn't start with scope: ${scope}`);
    }
  });

  it("has D99's references and the fidelity script", () => {
    assert.deepEqual(REFERENCES, ["references/client-first.md", "references/devlink.md", "references/dns-switch-checklist.md", "references/elements.md", "references/report-template.md"]);
    assert.ok(existsSync(join(SKILL, "scripts", "fidelity.mjs")));
  });

  it("links every step and reference from SKILL.md, from the site's root", () => {
    const index = read("SKILL.md");
    assert.match(index, /^---\nname: migrate-webflow\ndescription: .+\n---\n/);
    for (const file of [...STEPS, ...REFERENCES]) assert.ok(index.includes(`](${SKILL_PATH}${file})`), `SKILL.md doesn't link ${file}`);
  });

  it("writes no path from the skill's own folder", () => {
    for (const file of FILES) {
      const text = read(file);
      for (const [path] of text.matchAll(/[\w./@-]*\b(?:steps|references|scripts)\/[\w.-]+\.(?:md|mjs)/g)) {
        assert.ok(path.startsWith(SKILL_PATH), `${file}: ${path} isn't written from the site's root`);
      }
      // Links outside code: a code span may show content, such as an image.
      const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
      assert.doesNotMatch(prose, /\]\((?!https:\/\/|node_modules\/)/, `${file} links a path that isn't from the site's root`);
    }
  });

  it("names only package files that exist", () => {
    for (const file of FILES) {
      for (const [path] of read(file).matchAll(/node_modules\/@hostsmith\/site-kit-astro\/[\w./-]*\w/g)) {
        assert.ok(existsSync(join(PACKAGE, path.slice(ROOT.length))), `${file} names ${path}, which the package doesn't have`);
      }
    }
  });

  it("is named in the kit's rules", () => {
    assert.ok(readFileSync(join(PACKAGE, "AGENTS.md"), "utf8").includes(`\`${SKILL_PATH}SKILL.md\``));
  });

  it("maps every Webflow element the kit replaces", () => {
    const words = codeWords(read("references/elements.md"));
    const elements = ["w-nav", "w-dropdown", "w-tabs", "w-slider", "w-lightbox", "w-background-video", "w-widget-map", "w-embed", "w-video", "w-iframe", "w-richtext", "w-form", "w-dyn-list"];
    const parts = ["tabs", "slider", "gallery", "video", "embed", "children", "reveal", "collection-list"];
    const presets = ["fade", "fade-up", "fade-down", "slide-left", "slide-right", "scale"];
    for (const name of [...elements, ...parts, ...presets]) assert.ok(words.has(name), `the element mapping doesn't name ${name}`);
  });

  it("maps every utility class of the Cobbleford export", () => {
    const words = codeWords(read("references/client-first.md"));
    const cobbleford = [
      "page-wrapper",
      "main-wrapper",
      "skip-link",
      "padding-global",
      "container-large",
      "container-small",
      "padding-section-large",
      "padding-section-medium",
      "padding-section-small",
      "heading-style-h1",
      "heading-style-h2",
      "heading-style-h3",
      "heading-style-h4",
      "heading-style-h5",
      "text-size-large",
      "text-size-medium",
      "text-size-regular",
      "text-size-small",
      "text-style-eyebrow",
      "text-style-link",
      "text-color-secondary",
      "text-color-accent",
      "text-color-accent-light",
      "text-color-alternate-secondary",
      "text-weight-semibold",
      "button",
      "button-group",
      "is-secondary",
      "is-small",
      "is-alternate",
      "is-full-width",
      "is-center",
      "is-text-area",
      "image-cover",
      "hide-mobile-portrait",
      "check-list",
      "utility-page-wrap",
      "utility-page-content",
      "utility-page-form",
    ];
    for (const name of cobbleford) assert.ok(words.has(name), `the Client-First mapping doesn't name ${name}`);
  });
});
