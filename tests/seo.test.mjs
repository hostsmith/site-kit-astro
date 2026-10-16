// site-kit-routing: "SEO output" and "No-index builds".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, htmlFiles } from "./helpers.mjs";

const SITE = "https://www.example.com";

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
      ["/", "/about", "/heroes", "/library", "/news", "/news/first", "/news/fresh-rye", "/news/second", "/news/third", "/services/plumbing"].map((p) => `${SITE}${p}`).sort(),
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
