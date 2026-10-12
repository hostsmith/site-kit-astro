// site-kit-section-library: hero, rich-text, collection-list.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, count, innerHtml } from "./helpers.mjs";

const page = (sections) => `---\ntitle: Test\nsections:\n${sections}---\n`;

async function expectFailure(sections, ...expected) {
  const build = await buildFixture("base", { files: { "src/content/pages/test.md": page(sections) } });
  await build.cleanup();
  assert.equal(build.ok, false, "the build should fail");
  for (const text of expected) assert.ok(build.output.includes(text), `output doesn't mention ${JSON.stringify(text)}:\n${build.output}`);
}

describe("library sections", () => {
  let build;
  before(async () => {
    build = await buildFixture("base");
  });
  after(() => build.cleanup());

  describe("hero", () => {
    it("renders each variant", async () => {
      const html = await build.read("heroes/index.html");
      assert.equal(count(html, /data-section="hero"/g), 4);
      for (const title of ["Centered hero", "Left hero", "Right hero", "Background hero"]) assert.ok(html.includes(title), `${title} is missing`);
      assert.match(html, /md:order-2/, "image-left puts the text second");
      assert.match(html, /class="absolute inset-0 h-full w-full object-cover"/, "background variant has a cover image");
    });

    it("renders only the first hero title as h1", async () => {
      const html = await build.read("heroes/index.html");
      assert.equal(count(html, /<h1\b/g), 1);
      assert.match(html, /<h1[^>]*data-field="pages\/heroes#sections\[h1a1\]\.title"[^>]*>Centered hero<\/h1>/);
      assert.match(html, /<h2[^>]*data-field="pages\/heroes#sections\[h2b2\]\.title"[^>]*>Left hero<\/h2>/);
    });

    it("renders the call to action", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<a href="\/order"[^>]*data-field="pages\/home#sections\[s7k2\]\.cta\.label"[^>]*>Order now<\/a>/);
      assert.match(html, /<section data-section="hero"/);
      assert.match(html, /<img src="\/assets\/test\/photo\.svg" alt="Loaves of rye bread on a wooden counter"[^>]*data-field="pages\/home#sections\[s7k2\]\.image"/);
    });
  });

  describe("rich-text", () => {
    it("renders both variants", async () => {
      assert.match(await build.read("index.html"), /data-section="rich-text"[\s\S]*?max-w-prose/);
      assert.match(await build.read("about/index.html"), /data-section="rich-text"[\s\S]*?max-w-5xl/);
    });

    it("renders title and body with field attributes", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<h2[^>]*data-field="pages\/home#sections\[r4t8\]\.title"[^>]*>About the bread<\/h2>/);
      assert.match(innerHtml(html, "div", 'data-field="pages/home#sections[r4t8].body"'), /<em>spelt<\/em>/);
    });
  });

  describe("collection-list", () => {
    it("renders the three newest non-draft entries, each linked", async () => {
      const html = await build.read("index.html");
      const section = html.slice(html.indexOf('data-section="collection-list"'));
      const titles = [...section.matchAll(/<a href="([^"]+)"[^>]*data-field="news\/([^"#]+)#title"[^>]*>\s*([^<]+?)\s*<\/a>/g)].map((m) => [m[1], m[2]]);
      assert.deepEqual(titles, [
        ["/news/fresh-rye", "fresh-rye"],
        ["/news/third", "third"],
        ["/news/second", "second"],
      ]);
    });

    it("renders the read-more text from settings", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<a href="\/news\/fresh-rye" aria-describedby="n2w6-fresh-rye"[^>]*data-field="settings\/site#ui\.readMore"[^>]*>\s*Read more\s*<\/a>/);
    });

    it("renders the list variant with every entry", async () => {
      const html = await build.read("news/index.html");
      assert.match(html, /divide-y/);
      assert.equal(count(html, /data-field="news\/[^"]+#title"/g), 4);
    });
  });
});

describe("invalid sections fail the build", () => {
  it("names an unknown hero variant", () =>
    expectFailure("  - { id: s7k2, type: hero, title: One, variant: diagonal }\n", "test.md", 'section "s7k2" (hero): prop "variant" has the value "diagonal"'));

  it("names a hero image without alt text", () =>
    expectFailure(
      "  - { id: s7k2, type: hero, title: One, image: /assets/test/photo.svg, variant: image-left }\n",
      "test.md",
      'section "s7k2" (hero): image "/assets/test/photo.svg" has no alt text',
    ));

  it("names an unknown collection", () =>
    expectFailure("  - { id: s7k2, type: collection-list, collection: events }\n", "test.md", 'prop "collection" has the value "events"'));
});
