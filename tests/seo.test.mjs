// site-kit-routing: "SEO output" and "No-index builds".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, htmlFiles } from "./helpers.mjs";

const SITE = "https://www.example.com";

// A collection's patterns are site interface strings (site-kit-webflow-migration
// design D134): declared in siteUi, written in the settings' ui, with a Decap field.
const SCHEMA = "src/site.schema.ts";
const SETTINGS = "src/content/settings/site.en.yml";
const SITE_PART = "public/admin/config.site.yml";
const withSiteUi = (declarations) => (schema) =>
  `${schema.replace(/import \{ ([^}]*) \} from "@hostsmith\/site-kit-astro\/schema";/, 'import { $1, uiString } from "@hostsmith/site-kit-astro/schema";')}\nexport const siteUi = {\n${declarations}\n};\n`;
const withUi = (lines) => (settings) => settings.replace(/^ui:\n/m, `ui:\n${lines}\n`);
const withDecapUi = (keys) => (part) => `${part}\nui:\n${keys.map((key) => `  - { name: ${key}, label: ${key}, widget: string }`).join("\n")}\n`;

describe("SEO output", () => {
  let build;
  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  it("writes the page metadata", async () => {
    assert.ok(build.ok, build.output);
    const html = await build.read("about/index.html");
    assert.match(html, /<title>About us \| Bakery<\/title>/);
    assert.match(html, /<meta name="description" content="Since 1998">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.example\.com\/about">/);
    assert.match(html, /<meta property="og:title" content="About us \| Bakery">/);
    assert.match(html, /<meta property="og:description" content="Since 1998">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/www\.example\.com\/about">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/www\.example\.com\/assets\/test\/share\.svg">/);
  });

  it("falls back to the settings description", async () => {
    assert.match(await build.read("services/plumbing/index.html"), /<meta name="description" content="Default description">/);
  });

  it("uses an entry's image as its Open Graph image", async () => {
    assert.match(await build.read("news/fresh-rye/index.html"), /<meta property="og:image" content="https:\/\/www\.example\.com\/assets\/test\/photo\.svg">/);
  });

  it("writes a single sitemap at /sitemap.xml", async () => {
    const urls = [...(await build.read("sitemap.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(
      urls.sort(),
      ["/", "/about", "/blocks", "/heroes", "/library", "/news", "/news/first", "/news/fresh-rye", "/news/second", "/news/third", "/services/plumbing"]
        .map((p) => `${SITE}${p}`)
        .sort(),
    );
  });

  it("names the sitemap in robots.txt", async () => {
    assert.equal(await build.read("robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  });

  it("puts a robots meta only on the 404 page", async () => {
    for (const file of await htmlFiles(build.dist)) {
      const robots = (await build.read(file)).match(/<meta name="robots" content="([^"]+)">/)?.[1];
      assert.equal(robots, file === "404.html" ? "noindex" : undefined, file);
    }
  });
});

describe("a collection's patterns", () => {
  let build;
  before(async () => {
    build = await buildFixture("base", {
      edit: {
        [SCHEMA]: withSiteUi(
          ['  newsPageTitle: uiString({ params: ["title"] }),', '  newsPageDescription: uiString({ params: ["description", "date"] }),', '  newsOgTitle: uiString({ params: ["title", "category"] }),'].join(
            "\n",
          ),
        ),
        [SETTINGS]: withUi(['  newsPageTitle: "{title} | Bakery"', '  newsPageDescription: "{description}, from {date}."', '  newsOgTitle: "{title} ({category})"'].join("\n")),
        [SITE_PART]: withDecapUi(["newsPageTitle", "newsPageDescription", "newsOgTitle"]),
      },
    });
  });
  after(() => build.cleanup());

  it("fills an entry's title, description and Open Graph title from them", async () => {
    assert.ok(build.ok, build.output);
    const html = await build.read("news/fresh-rye/index.html");
    assert.match(html, /<title>Fresh rye \| Bakery<\/title>/);
    assert.match(html, /<meta name="description" content="The newest post, from April 1, 2026\.">/);
    assert.match(html, /<meta property="og:title" content="Fresh rye \(Shop news\)">/);
    assert.match(html, /<meta property="og:description" content="The newest post, from April 1, 2026\.">/);
  });

  it("leaves pages and the list page their own titles", async () => {
    assert.match(await build.read("about/index.html"), /<title>About us \| Bakery<\/title>/);
    assert.match(await build.read("news/index.html"), /<title>News<\/title>/);
  });

  it("fails on a parameter that isn't a field, naming the key and the fields", async () => {
    const failed = await buildFixture("base", {
      edit: {
        [SCHEMA]: withSiteUi('  newsPageTitle: uiString({ params: ["name"] }),'),
        [SETTINGS]: withUi('  newsPageTitle: "{name} | Bakery"'),
        [SITE_PART]: withDecapUi(["newsPageTitle"]),
      },
    });
    try {
      assert.equal(failed.ok, false, "the build succeeded");
      assert.match(failed.output, /Interface string "newsPageTitle" in siteUi in src\/site\.schema\.ts has the parameter \{name\}, which isn't a field of the collection "news"/);
      assert.match(failed.output, /\{title\}, \{date\}/);
    } finally {
      await failed.cleanup();
    }
  });
});

describe("SITE_NOINDEX=true", () => {
  let build;
  before(async () => {
    build = await buildFixture("base", { env: { SITE_NOINDEX: "true" } });
  });
  after(() => build.cleanup());

  it("marks every page noindex, nofollow", async () => {
    assert.ok(build.ok, build.output);
    for (const file of await htmlFiles(build.dist)) {
      assert.match(await build.read(file), /<meta name="robots" content="noindex, nofollow">/, file);
    }
  });

  it("disallows everything in robots.txt", async () => {
    assert.equal(await build.read("robots.txt"), "User-agent: *\nDisallow: /\n");
  });
});

describe("production site URL", () => {
  it("fails the build when src/site.config.ts has none", async () => {
    const build = await buildFixture("base", { edit: { "src/site.config.ts": (text) => text.replace('url: "https://www.example.com"', 'url: ""') } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /Set `url` in src\/site\.config\.ts to the production site URL/);
  });
});
