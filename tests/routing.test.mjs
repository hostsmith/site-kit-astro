// site-kit-routing: page URLs, base paths, one source per URL, custom pages, 404, no trailing slash.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, htmlFiles } from "./helpers.mjs";

const basePath = (path) => ({ "src/site.config.ts": (text) => text.replace('basePath: "/news"', `basePath: "${path}"`) });

describe("page and entry URLs", () => {
  let build;
  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  it("serves home at / and nested pages at their paths", () => {
    assert.ok(build.ok, build.output);
    for (const file of ["index.html", "about/index.html", "services/plumbing/index.html", "news/fresh-rye/index.html"]) {
      assert.ok(build.exists(file), `${file} is missing`);
    }
    assert.equal(build.exists("home/index.html"), false);
  });

  it("writes 404.html at the output root", () => {
    assert.ok(build.exists("404.html"));
    assert.equal(build.exists("404/index.html"), false);
  });

  it("renders entries with the detail template", async () => {
    const html = await build.read("news/fresh-rye/index.html");
    assert.match(html, /<h1[^>]*data-field="news\/fresh-rye\.en#title"[^>]*>Fresh rye<\/h1>/);
    assert.match(html, /<time datetime="2026-04-01"[^>]*data-field="news\/fresh-rye\.en#date"/);
  });

  it("links and lists nothing with a trailing slash, except home", async () => {
    for (const file of await htmlFiles(build.dist)) {
      const html = await build.read(file);
      for (const [, url] of html.matchAll(/(?:href|content)="(\/[^"]*|https:\/\/www\.example\.com[^"]*)"/g)) {
        const path = url.replace("https://www.example.com", "") || "/";
        if (path !== "/") assert.ok(!path.split(/[?#]/)[0].endsWith("/"), `${file} links to ${url}`);
      }
    }
    for (const [, url] of (await build.read("sitemap.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (url !== "https://www.example.com/") assert.ok(!url.endsWith("/"), `sitemap lists ${url}`);
    }
  });
});

describe("collection base paths", () => {
  it("serve entries and links under a Webflow-style base path", async () => {
    const build = await buildFixture("base", { edit: basePath("/post") });
    try {
      assert.ok(build.ok, build.output);
      assert.ok(build.exists("post/fresh-rye/index.html"));
      assert.equal(build.exists("news/fresh-rye/index.html"), false);
      assert.match(await build.read("index.html"), /<a href="\/post\/fresh-rye"/);
      assert.match(await build.read("sitemap.xml"), /<loc>https:\/\/www\.example\.com\/post\/fresh-rye<\/loc>/);
    } finally {
      await build.cleanup();
    }
  });

  it("may have several segments", async () => {
    const build = await buildFixture("base", { edit: basePath("/resources/blog") });
    try {
      assert.ok(build.ok, build.output);
      assert.ok(build.exists("resources/blog/fresh-rye/index.html"));
    } finally {
      await build.cleanup();
    }
  });
});

describe("one source per URL", () => {
  it("fails on a page and an entry with the same URL, naming both", async () => {
    const build = await buildFixture("base", {
      edit: basePath("/post"),
      files: { "src/content/pages/post/fresh-rye.en.md": "---\ntitle: Clash\nsections: []\n---\n" },
    });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /Two sources produce the URL \/post\/fresh-rye: page entry src\/content\/pages\/post\/fresh-rye\.en\.md and news entry src\/content\/news\/fresh-rye\.en\.md/);
  });

  it("fails on a page entry and a hand-written page with the same URL", async () => {
    const build = await buildFixture("base", { files: { "src/pages/about.astro": "<p>About</p>\n" } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /Two sources produce the URL \/about: hand-written page src\/pages\/about\.astro and page entry src\/content\/pages\/about\.en\.md/);
  });
});

describe("template: custom", () => {
  // A custom page has no props of its own: the markup shows its title and
  // the text of its first section, in its own markup (site-kit-locales design D53).
  const teamPage = [
    "---",
    'import Base from "@hostsmith/site-kit-astro/layouts/Base.astro";',
    'import { customPage } from "@hostsmith/site-kit-astro/custom-page";',
    'import { field, sectionFields } from "@hostsmith/site-kit-astro/field";',
    'const { ref, data } = await customPage("team.en");',
    "const [intro] = data.sections;",
    "---",
    '<Base title={data.title} path="/team"><h1 {...field(ref, "title")}>{data.title}</h1><p {...sectionFields(ref, intro).field("body")}>{intro.body}</p></Base>',
    "",
  ].join("\n");
  const teamEntry = "---\ntitle: Team\ntemplate: custom\nsections:\n  - { id: t3m1, type: rich-text, body: Meet the bakers }\n---\n";

  it("renders the hand-written page with field attributes", async () => {
    const build = await buildFixture("base", { files: { "src/pages/team.astro": teamPage, "src/content/pages/team.en.md": teamEntry } });
    try {
      assert.ok(build.ok, build.output);
      assert.match(await build.read("team/index.html"), /<p data-field="pages\/team\.en#sections\[t3m1\]\.body">Meet the bakers<\/p>/);
      assert.match(await build.read("sitemap.xml"), /<loc>https:\/\/www\.example\.com\/team<\/loc>/);
    } finally {
      await build.cleanup();
    }
  });

  // site-kit-locales, "Custom page props".
  it("fails on a prop of its own, saying to put the content in a section", async () => {
    const build = await buildFixture("base", {
      files: { "src/pages/team.astro": teamPage, "src/content/pages/team.en.md": teamEntry.replace("template: custom\n", "template: custom\nheading: Our team\n") },
    });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /unknown frontmatter key "heading"\. A page has title, description, ogImage, template, sections\. Content goes in sections, a custom page's too\./);
    assert.match(build.output, /team\.en/);
  });

  it("fails when nothing renders it", async () => {
    const build = await buildFixture("base", { files: { "src/content/pages/catering.en.md": "---\ntitle: Catering\ntemplate: custom\n---\n" } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /src\/content\/pages\/catering\.en\.md sets template: custom, but nothing renders it\. Add the page template src\/components\/pages\/catering\.astro, or the hand-written page src\/pages\/catering\.astro/);
  });

  // site-kit-sections, "Page template" (site-kit-locales design D53).
  const teamTemplate = teamPage
    .replace('customPage("team.en")', "customPage(Astro.props.entry)")
    .replace('path="/team"', "path={Astro.props.path} locale={Astro.props.locale}");

  it("renders a page template with the entry and its path", async () => {
    const build = await buildFixture("base", { files: { "src/components/pages/team.astro": teamTemplate, "src/content/pages/team.en.md": teamEntry } });
    try {
      assert.ok(build.ok, build.output);
      assert.match(await build.read("team/index.html"), /<p data-field="pages\/team\.en#sections\[t3m1\]\.body">Meet the bakers<\/p>/);
      assert.match(await build.read("sitemap.xml"), /<loc>https:\/\/www\.example\.com\/team<\/loc>/);
    } finally {
      await build.cleanup();
    }
  });

  it("fails when both a page template and a hand-written page render it", async () => {
    const build = await buildFixture("base", {
      files: { "src/components/pages/team.astro": teamTemplate, "src/pages/team.astro": teamPage, "src/content/pages/team.en.md": teamEntry },
    });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /team\.en\.md sets template: custom, and both src\/components\/pages\/team\.astro and src\/pages\/team\.astro render it/);
  });
});
