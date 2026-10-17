// site-kit-package, "New sites start from an example": every example builds
// as is. site-kit-repository, "Example content covers the whole kit": the
// `basics` example's content.
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";
import { checkBuilt } from "../packages/site-kit-astro/scripts/check-styles.mjs";
import { defineKitContent } from "../packages/site-kit-astro/src/kit-content.ts";
import { siteConfig } from "../examples/basics/src/site.config.ts";
import * as siteSchema from "../examples/basics/src/site.schema.ts";
import { BASICS, buildFixture, deprecatedHooks, EXAMPLES, htmlFiles } from "./helpers.mjs";

// The nine library section types (site-kit-section-library).
const LIBRARY_TYPES = [
  "hero",
  "rich-text",
  "collection-list",
  "services-grid",
  "gallery",
  "testimonials",
  "faq",
  "cta",
  "hours-location",
  "trust-bar",
  "stats",
  "steps",
  "split",
  "team",
  "pricing-list",
];
const { sectionSchemas } = defineKitContent(siteConfig, siteSchema);

// The selectors of every rule in built CSS that names an `sk-` class, with the
// @layer each sits in.
function hookRuleLayers(css) {
  const layers = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      const prelude = css.slice(start, i).trim();
      stack.push(prelude);
      if (prelude.includes(".sk-") && !prelude.startsWith("@")) layers.push({ selector: prelude, layer: stack.findLast((p) => p.startsWith("@layer")) ?? "(none)" });
      start = i + 1;
    } else if (css[i] === "}" || css[i] === ";") {
      if (css[i] === "}") stack.pop();
      start = i + 1;
    }
  }
  return layers;
}

describe("examples", () => {
  for (const example of readdirSync(EXAMPLES)) {
    it(`${example} builds as is`, async () => {
      const build = await buildFixture(null, { example });
      try {
        assert.ok(build.ok, build.output);

        // site-kit-themes, "A theme is one folder": theme rules sit in the
        // components layer, so utilities win over them.
        const css = (await readdir(join(build.dist, "_astro"))).filter((file) => file.endsWith(".css"));
        assert.ok(css.length > 0, `${example} builds no CSS`);
        const rules = (await Promise.all(css.map((file) => build.read(`_astro/${file}`)))).flatMap(hookRuleLayers);
        assert.ok(rules.length > 100, `${example}: only ${rules.length} theme rules found in the built CSS`);
        const outside = rules.filter(({ layer }) => layer !== "@layer components");
        assert.deepEqual(outside, [], `${example}: theme rules outside @layer components`);

        // site-kit-themes, "Style check": every hook the pages carry is styled.
        const built = checkBuilt(build.dir);
        assert.deepEqual([...built.errors, ...built.warnings], [], `${example} fails check:styles --built`);

        // site-kit-themes, "A theme styles every hook": no deprecated hook renders.
        const deprecated = await deprecatedHooks();
        for (const file of await htmlFiles(build.dist)) {
          const html = await build.read(file);
          for (const hook of deprecated.keys()) assert.ok(!new RegExp(`class="[^"]*\\b${hook}\\b`).test(html), `${example}'s ${file} uses the deprecated hook ${hook}`);
        }
      } finally {
        await build.cleanup();
      }
    });
  }
});

describe("basics example content", () => {
  let build;
  let html;
  before(async () => {
    build = await buildFixture(null);
    html = (await Promise.all((await htmlFiles(build.dist)).map((f) => build.read(f)))).join("\n");
  });
  after(() => build.cleanup());

  it("renders every library section type", () => {
    assert.ok(build.ok, build.output);
    assert.deepEqual(Object.keys(sectionSchemas).sort(), [...LIBRARY_TYPES].sort(), "the example registers exactly the library types");
    for (const type of LIBRARY_TYPES) assert.ok(html.includes(`data-section="${type}"`), `no ${type} section`);
  });

  it("has the design's pages, the blog, a custom page and the 404 page", async () => {
    const pages = ["services", "services/kitchen-and-bath", "services/repairs", "services/painting", "about", "contact", "blog"];
    for (const page of ["index.html", "404.html", ...pages.map((page) => `${page}/index.html`)]) assert.ok(build.exists(page), `no ${page}`);
    assert.equal(build.exists("blog/spring-painting-dates/index.html"), false, "a draft post is built");

    // Posts are served at /blog/<slug>, with the breadcrumb through the blog page.
    const post = await build.read("blog/what-a-fixed-quote-should-include/index.html");
    assert.match(post, /<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<a href="\/blog"[^>]*>\s*Blog\s*<\/a>/);
    assert.match(post, /data-field="news\/what-a-fixed-quote-should-include#category">\s*Planning\s*</);
  });

  it("has no bracketed placeholders in its content and settings", async () => {
    const content = join(BASICS, "src", "content");
    for (const file of await readdir(content, { recursive: true })) {
      if (!/\.(md|ya?ml)$/.test(file)) continue;
      const text = await readFile(join(content, file), "utf8");
      // A bracket that isn't a Markdown link, such as [PHONE] or [Customer name].
      const placeholder = text.match(/\[[^\]\n]+\](?!\()/);
      assert.equal(placeholder, null, `src/content/${file} has the placeholder ${placeholder?.[0]}`);
    }
  });

  it("uses American fillers", async () => {
    const home = await build.read("index.html");
    assert.match(home, /<html lang="en-US"/);
    const footer = home.slice(home.indexOf("<footer"));
    assert.match(footer, /, [A-Z]{2} \d{5}\b/, "no address with a state code and ZIP code");
    assert.match(home, /\(\d{3}\) 555-01\d{2}/, "no phone number in the 555-0100 to 555-0199 range");
    assert.match(footer, /\d{1,2}:\d{2} (AM|PM)/, "no 12-hour opening hours");
    assert.match(home, /<time datetime="2026-10-08"[^>]*>\s*October 8, 2026\s*<\/time>/, "no US-style post date");
  });

  it("credits every third-party file under public/assets/", async () => {
    const credits = await readFile(join(BASICS, "CREDITS.md"), "utf8");
    const assets = join(BASICS, "public", "assets");
    for (const file of await readdir(assets, { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue;
      const path = relative(BASICS, join(file.parentPath, file.name));
      if (/^placeholder-[a-z0-9-]+\.svg$/.test(file.name)) continue;
      assert.ok(credits.includes(`\`${path}\``), `CREDITS.md doesn't list ${path}`);
    }
    for (const [, path] of credits.matchAll(/`(public\/assets\/[^`]+)`/g)) assert.ok(existsSync(join(BASICS, path)), `CREDITS.md lists ${path}, which doesn't exist`);
  });

  it("marks placeholder images as placeholders in their alt text", () => {
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({ tag, src: tag.match(/src="([^"]*)"/)?.[1] ?? "", alt: tag.match(/alt="([^"]*)"/)?.[1] ?? "" }));
    const placeholders = images.filter(({ src }) => src.includes("/placeholder-"));
    assert.ok(placeholders.length > 0, "no placeholder images");
    for (const { tag, src, alt } of images) {
      assert.equal(alt.startsWith("Placeholder"), src.includes("/placeholder-"), `alt text and image disagree: ${tag}`);
    }
    // Every missing photo is a placeholder image, so no section falls back to
    // the kit's empty placeholder parts.
    const empty = html.match(/class="sk-(team|testimonials)__placeholder"/);
    assert.equal(empty, null, `a ${empty?.[1]} item has no image`);
  });

  it("fails on a post with an unknown category, naming the allowed ones", async () => {
    const bad = await buildFixture(null, {
      files: { "src/content/news/bad-category.md": '---\ntitle: Bad category\ndate: "2026-10-01"\ncategory: Gardening\n---\n\nText.\n' },
    });
    try {
      assert.equal(bad.ok, false);
      assert.match(bad.output, /bad-category/);
      assert.match(bad.output, /category/);
      assert.match(bad.output, /"Planning"\|"Renovation"\|"Maintenance"\|"News"/);
    } finally {
      await bad.cleanup();
    }
  });
});
