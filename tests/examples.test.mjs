// site-kit-package, "New sites start from an example": every example builds
// as is. site-kit-repository, "Example content covers the whole kit" and "The
// `webflow` example": each example's content.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";
import { checkBuilt } from "../packages/site-kit-astro/scripts/check-styles.mjs";
import { defineKitContent } from "../packages/site-kit-astro/src/kit-content.ts";
import { siteConfig } from "../examples/basics/src/site.config.ts";
import * as siteSchema from "../examples/basics/src/site.schema.ts";
import { BASICS, buildFixture, deprecatedHooks, EXAMPLE_NAMES, EXAMPLES, hookReference, htmlFiles, themeCoverage } from "./helpers.mjs";

// The library section types (site-kit-section-library).
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
  "tabs",
  "slider",
  "embed",
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
  for (const example of EXAMPLE_NAMES) {
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
        const pages = await Promise.all((await htmlFiles(build.dist)).map(async (file) => ({ file, html: await build.read(file) })));
        for (const { file, html } of pages) {
          for (const hook of deprecated.keys()) assert.ok(!new RegExp(`class="[^"]*\\b${hook}\\b`).test(html), `${example}'s ${file} uses the deprecated hook ${hook}`);
        }

        // site-kit-section-library, "Each example builds the types it lists".
        const all = pages.map(({ html }) => html).join("\n");
        for (const type of themeCoverage(example).types) assert.ok(all.includes(`data-section="${type}"`), `${example} lists ${type} but renders none`);
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

  // site-kit-repository, "Basics renders its listed types".
  it("renders every library section type its theme lists", () => {
    assert.ok(build.ok, build.output);
    assert.deepEqual(Object.keys(sectionSchemas).sort(), [...LIBRARY_TYPES].sort(), "the example registers exactly the library types");
    const { types } = themeCoverage("basics");
    assert.deepEqual(types, LIBRARY_TYPES.slice(0, 15), "basics lists the types it had before the interactive parts");
    for (const type of types) assert.ok(html.includes(`data-section="${type}"`), `no ${type} section`);
  });

  it("has the design's pages, the blog, a custom page and the 404 page", async () => {
    const pages = ["services", "services/kitchen-and-bath", "services/repairs", "services/painting", "about", "contact", "blog"];
    for (const page of ["index.html", "404.html", ...pages.map((page) => `${page}/index.html`)]) assert.ok(build.exists(page), `no ${page}`);
    assert.equal(build.exists("blog/spring-painting-dates/index.html"), false, "a draft post is built");

    // Posts are served at /blog/<slug>, with the breadcrumb through the blog page.
    const post = await build.read("blog/what-a-fixed-quote-should-include/index.html");
    assert.match(post, /<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<a href="\/blog"[^>]*>\s*Blog\s*<\/a>/);
    assert.match(post, /data-field="news\/what-a-fixed-quote-should-include\.en#category">\s*Planning\s*</);
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
      files: { "src/content/news/bad-category.en.md": '---\ntitle: Bad category\ndate: "2026-10-01"\ncategory: Gardening\n---\n\nText.\n' },
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

// site-kit-repository, "The `webflow` example" (site-kit-webflow-example design
// D101).
describe("webflow example content", () => {
  const WEBFLOW = join(EXAMPLES, "webflow");
  let build;
  let pages;
  let html;
  let webflowTypes;
  before(async () => {
    const { siteConfig: config } = await import("../examples/webflow/src/site.config.ts");
    webflowTypes = defineKitContent(config, await import("../examples/webflow/src/site.schema.ts")).sectionSchemas;
    build = await buildFixture(null, { example: "webflow" });
    pages = await Promise.all((await htmlFiles(build.dist)).map(async (file) => ({ file, html: await build.read(file) })));
    html = pages.map((page) => page.html).join("\n");
  });
  after(() => build.cleanup());

  // The values of a section prop's enum, through its default.
  const optionsOf = (schema) => schema?.unwrap?.().options ?? schema?.options ?? [];

  it("renders every library section type, in each variant and tone", () => {
    assert.ok(build.ok, build.output);
    const roots = [...html.matchAll(/<section data-section="([a-z-]+)"(?: data-reveal="[a-z-]+")? class="([^"]+)"/g)].map((m) => ({ type: m[1], classes: m[2].split(" ") }));
    for (const type of LIBRARY_TYPES) {
      const own = roots.filter((root) => root.type === type);
      assert.ok(own.length > 0, `no ${type} section`);
      for (const variant of optionsOf(webflowTypes[type].shape.variant)) {
        assert.ok(own.some((root) => root.classes.includes(`sk-${type}--${variant}`)), `no ${type} in the variant ${variant}`);
      }
      for (const tone of optionsOf(webflowTypes[type].shape.tone)) {
        assert.ok(own.some((root) => root.classes.includes(`sk-tone-${tone}`)), `no ${type} in the tone ${tone}`);
      }
    }
  });

  it("renders every interactive part, and the content model's additions", () => {
    for (const [part, marker] of [
      ["tabs", 'role="tablist"'],
      ["a rotating slider", 'class="sk-slider__pause"'],
      ["the lightbox", 'class="sk-lightbox"'],
      ["a background video", 'class="sk-video"'],
      ["a map embed", "Show map"],
      ["a video embed", "Play video"],
      ["nested nav items", 'class="sk-nav__item"'],
      ["a submenu button beside a link", 'aria-label="Interactive submenu"'],
      ["reveal", 'data-reveal="fade-up"'],
      ["a highlighted word", 'class="sk-highlight"'],
      ["a site icon", 'data-icon="square-dot"'],
      ["the brand block's own logo", 'src="/assets/images/logo-reversed.svg"'],
    ]) {
      assert.ok(html.includes(marker), `no ${part}`);
    }
    const post = pages.find((page) => page.file === "news/collection-entry/index.html").html;
    assert.match(post, /data-title="Big Buck Bunny, by the Blender Foundation"/, "no video link in a body");
  });

  it("renders every footer block type and header action", () => {
    const home = pages.find((page) => page.file === "index.html").html;
    for (const type of ["brand", "contact", "links", "hours", "text", "copyright", "locales"]) assert.ok(home.includes(`sk-footer__block--${type}`), `no ${type} footer block`);
    for (const hook of ["sk-header__phone", "sk-header__link", "sk-header__call"]) assert.ok(home.includes(hook), `no ${hook}`);
    assert.match(home.split("</header>")[0], /class="sk-button sk-button--primary"/);
  });

  it("holds no Webflow code", async () => {
    const files = [
      ...(await readdir(WEBFLOW, { recursive: true })).filter((file) => !/^(node_modules|dist|\.astro)\b/.test(file) && /\.(astro|css|md|ya?ml|ts|mjs|json|html|svg)$/.test(file)).map((file) => join(WEBFLOW, file)),
      ...(await readdir(build.dist, { recursive: true })).filter((file) => /\.(html|css|js)$/.test(file)).map((file) => join(build.dist, file)),
    ];
    // Webflow's runtime classes, such as w-nav or w--current. Tailwind's width
    // utilities, such as w-full, are no Webflow code.
    const webflowClass = /(?<![\w-])\.?w-(?:-current|nav|container|row|col|button|inline-block|richtext|form|input|select|checkbox|radio|tab|slider|slide|lightbox|dropdown|embed|video|background-video|layout|webflow|mod-|icon|clearfix|list-unstyled|condition|dyn-|pagination|commerce|iframe|widget|clearfix)/;
    for (const file of files) {
      const text = await readFile(file, "utf8");
      assert.doesNotMatch(text, webflowClass, `${file} has a Webflow class`);
      assert.doesNotMatch(text, /webflow\.js|jquery|website-files\.com|webflow\.com|\.webflow\.io|data-wf-/i, `${file} has Webflow code or loads from a Webflow host`);
    }
  });

  it("has nothing to credit, and media made for the example", async () => {
    const credits = await readFile(join(WEBFLOW, "CREDITS.md"), "utf8");
    assert.match(credits, /no third-party files/);
    assert.doesNotMatch(credits, /`public\/assets\/[^`]+\.[a-z0-9]+`/, "CREDITS.md lists a file");
    const assets = (await readdir(join(WEBFLOW, "public", "assets"), { recursive: true, withFileTypes: true })).filter((file) => file.isFile()).map((file) => file.name);
    assert.deepEqual(assets.filter((name) => !/^(placeholder-[a-z0-9-]+\.svg|logo(-reversed)?\.svg|clip\.(mp4|webm))$/.test(name)), [], "the example has media it didn't make");
    for (const clip of ["clip.mp4", "clip.webm"]) assert.ok((await stat(join(WEBFLOW, "public", "assets", "video", clip))).size < 300 * 1024, `${clip} is 300 KB or more`);
  });

  it("marks placeholder images as placeholders, and has no bracketed placeholders", async () => {
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      const src = tag.match(/src="([^"]*)"/)?.[1] ?? "";
      const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? "";
      if (src.includes("/placeholder-")) assert.ok(alt.startsWith("Placeholder"), `a placeholder without "Placeholder" in its alt text: ${tag}`);
    }
    const content = join(WEBFLOW, "src", "content");
    for (const file of await readdir(content, { recursive: true })) {
      if (!/\.(md|ya?ml)$/.test(file)) continue;
      const placeholder = (await readFile(join(content, file), "utf8")).match(/\[[^\]\n]+\](?!\()/);
      assert.equal(placeholder, null, `src/content/${file} has the placeholder ${placeholder?.[0]}`);
    }
  });

  it("documents every part it renders in the hook reference", () => {
    const rendered = new Set([...html.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((name) => name.startsWith("sk-")));
    const unknown = [...rendered].filter((name) => !hookReference().classes.has(name));
    assert.deepEqual(unknown, []);
  });
});
