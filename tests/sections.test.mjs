// site-kit-section-library: every library section type.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, count, innerHtml } from "./helpers.mjs";

const page = (sections) => `---\ntitle: Test\nsections:\n${sections}---\n`;

// The HTML of the section whose field attributes carry the given id.
function sectionHtml(html, entry, id) {
  const at = html.indexOf(`data-field="${entry}#sections[${id}]`);
  assert.ok(at > -1, `no fields of section ${id}`);
  return html.slice(html.lastIndexOf("<section", at), html.indexOf("</section>", at));
}

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

  describe("services-grid", () => {
    it("renders both variants", async () => {
      const cards = innerHtml(await build.read("index.html"), "section", 'data-section="services-grid"');
      assert.match(cards, /<ul class="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">/);
      assert.equal(count(cards, /<li\b/g), 2);
      const list = innerHtml(await build.read("library/index.html"), "section", 'data-section="services-grid"');
      assert.match(list, /<ul class="divide-y divide-border">/);
      assert.equal(count(list, /<li\b/g), 2);
    });

    it("renders the section and item fields", async () => {
      const html = await build.read("index.html");
      const at = (path) => `data-field="pages/home#sections\\[v3p8\\]\\.${path}"`;
      assert.match(html, new RegExp(`<h2[^>]*${at("title")}[^>]*>What we bake</h2>`));
      assert.match(html, new RegExp(`<p[^>]*${at("intro")}[^>]*>Bread for every day and every party\\.</p>`));
      assert.match(html, new RegExp(`<img src="/assets/test/photo\\.svg" alt="A loaf of rye bread"[^>]*${at("items\\[0\\]\\.image")}`));
      assert.match(html, new RegExp(`<h3[^>]*${at("items\\[0\\]\\.title")}[^>]*>\\s*Daily bread\\s*</h3>`));
      assert.match(html, new RegExp(`<p[^>]*${at("items\\[0\\]\\.text")}[^>]*>Rye and spelt from 7:00\\.</p>`));
    });

    it("renders a linked item title as the link", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<h3[^>]*>\s*<a href="\/catering"[^>]*data-field="pages\/home#sections\[v3p8\]\.items\[1\]\.title"[^>]*>\s*Catering\s*<\/a>/);
    });
  });

  describe("gallery", () => {
    it("renders both variants", async () => {
      const html = await build.read("library/index.html");
      const grid = sectionHtml(html, "pages/library", "g1r4");
      assert.match(grid, /^<section data-section="gallery"/);
      assert.match(grid, /<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">/);
      assert.equal(count(grid, /class="w-full rounded-md aspect-4\/3 object-cover"/g), 3);
      const masonry = sectionHtml(html, "pages/library", "g2m5");
      assert.match(masonry, /<ul class="gap-4 sm:columns-2 lg:columns-3">/);
      assert.equal(count(masonry, /<li class="mb-4 break-inside-avoid">/g), 2);
    });

    it("renders images and captions with field attributes", async () => {
      const html = await build.read("library/index.html");
      const at = (path) => `data-field="pages/library#sections\\[g1r4\\]\\.${path}"`;
      assert.match(html, /<h2[^>]*data-field="pages\/library#sections\[g1r4\]\.title"[^>]*>Inside the bakery<\/h2>/);
      assert.match(html, new RegExp(`<img src="/assets/test/photo\\.svg" alt="The oven" loading="lazy"[^>]*${at("images\\[0\\]\\.image")}`));
      assert.match(html, new RegExp(`<img src="/assets/test/photo\\.svg" alt="The shop front"[^>]*${at("images\\[2\\]\\.image")}`));
      assert.match(html, new RegExp(`<figcaption[^>]*${at("images\\[0\\]\\.caption")}[^>]*>\\s*Lit at 3:00\\s*</figcaption>`));
      assert.equal(count(sectionHtml(html, "pages/library", "g1r4"), /<figcaption\b/g), 1, "an image without a caption has no figcaption");
    });
  });

  describe("testimonials", () => {
    it("renders both variants", async () => {
      const html = await build.read("library/index.html");
      const grid = sectionHtml(html, "pages/library", "t1g3");
      assert.match(grid, /^<section data-section="testimonials"/);
      assert.match(grid, /<ul class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">/);
      assert.equal(count(grid, /<blockquote\b/g), 2);
      const single = sectionHtml(html, "pages/library", "t2s4");
      assert.match(single, /<div class="mx-auto max-w-3xl text-center">/);
      assert.match(single, /<ul class="flex flex-col gap-12">/);
    });

    it("gives the quote, name and role of each item a field attribute", async () => {
      const html = await build.read("library/index.html");
      const fields = [
        [0, "quote", "The best rye in town."],
        [0, "name", "Mari Tamm"],
        [0, "role", "Regular since 2005"],
        [1, "quote", "Great platters for our office."],
        [1, "name", "Jaan Kask"],
      ];
      for (const [i, prop, text] of fields) {
        const at = `data-field="pages/library#sections\\[t1g3\\]\\.items\\[${i}\\]\\.${prop}"`;
        assert.match(html, new RegExp(`<(p|span)[^>]*${at}[^>]*>\\s*${text.replace(".", "\\.")}\\s*</\\1>`), `items[${i}].${prop}`);
      }
      assert.match(html, /<blockquote[^>]*>\s*<p data-field="pages\/library#sections\[t1g3\]\.items\[0\]\.quote">/);
      assert.match(html, /<img src="\/assets\/test\/photo\.svg" alt="Mari Tamm"[^>]*data-field="pages\/library#sections\[t1g3\]\.items\[0\]\.image"/);
      assert.ok(!html.includes("sections[t1g3].items[1].role"), "an item without a role renders no role");
    });
  });

  describe("faq", () => {
    it("renders each item as a native disclosure with the question as its summary", async () => {
      const faq = sectionHtml(await build.read("index.html"), "pages/home", "q1m9");
      assert.match(faq, /^<section data-section="faq"/);
      assert.equal(count(faq, /<details>/g), 2, "two closed <details> without attributes");
      assert.match(faq, /<details>\s*<summary[^>]*data-field="pages\/home#sections\[q1m9\]\.items\[0\]\.question"[^>]*>\s*When do you open\?\s*<\/summary>/);
      assert.doesNotMatch(faq, /<script|\son[a-z]+=/, "the FAQ needs no script");
    });

    it("renders the answer as markdown with a field attribute", async () => {
      const html = await build.read("index.html");
      const first = innerHtml(html, "div", 'data-field="pages/home#sections[q1m9].items[0].answer"');
      assert.equal(first.trim(), "<p>Every day at 7:00.</p>");
      const second = innerHtml(html, "div", 'data-field="pages/home#sections[q1m9].items[1].answer"');
      assert.match(second, /<a href="mailto:test@example\.com">Email us<\/a>/);
      assert.equal(count(second, /<li>/g), 2);
    });
  });

  describe("cta", () => {
    it("renders both buttons as links, the main one first", async () => {
      const cta = sectionHtml(await build.read("library/index.html"), "pages/library", "c1b6");
      const links = [...cta.matchAll(/<a href="([^"]+)"[^>]*data-field="pages\/library#sections\[c1b6\]\.(\w+)\.label"[^>]*>\s*([^<]+?)\s*<\/a>/g)];
      assert.deepEqual(
        links.map((m) => m.slice(1)),
        [
          ["mailto:test@example.com", "button", "Email us"],
          ["tel:+15550100", "secondaryButton", "Call us"],
        ],
      );
      assert.match(cta, /<h2[^>]*data-field="pages\/library#sections\[c1b6\]\.title"[^>]*>Planning an event\?<\/h2>/);
      assert.match(cta, /<p[^>]*data-field="pages\/library#sections\[c1b6\]\.text"[^>]*>Tell us the date and the number of guests\.<\/p>/);
    });

    it("renders both variants", async () => {
      const html = await build.read("library/index.html");
      assert.match(sectionHtml(html, "pages/library", "c1b6"), /^<section data-section="cta" class="px-6 bg-primary py-16 text-primary-fg">/);
      const card = sectionHtml(html, "pages/library", "c2k7");
      assert.match(card, /^<section data-section="cta" class="px-6 py-12">/);
      assert.match(card, /rounded-lg border border-border/);
      assert.equal(count(card, /<a\b/g), 1, "a card without secondaryButton has one link");
    });
  });

  describe("hours-location", () => {
    it("renders the address, hours, note and map link with field attributes", async () => {
      const section = sectionHtml(await build.read("library/index.html"), "pages/library", "k7h2");
      const at = (path) => `data-field="pages/library#sections\\[k7h2\\]\\.${path}"`;
      assert.match(section, /^<section data-section="hours-location"/);
      assert.match(section, new RegExp(`<address[^>]*${at("address")}[^>]*>\\s*1 Test Street\\n12345 Testville\\s*</address>`));
      assert.match(section, new RegExp(`<dt[^>]*${at("hours\\[1\\]\\.days")}[^>]*>\\s*Saturday and Sunday\\s*</dt>\\s*<dd[^>]*${at("hours\\[1\\]\\.time")}[^>]*>8:00-16:00</dd>`));
      assert.match(section, new RegExp(`<p[^>]*${at("note")}[^>]*>Closed on public holidays\\.</p>`));
      assert.match(
        section,
        new RegExp(`<a href="https://www\\.openstreetmap\\.org/search\\?query=1%20Test%20Street"[^>]*${at("mapLink\\.label")}[^>]*>\\s*Show on map\\s*</a>`),
      );
    });

    it("links to the map and embeds none", async () => {
      const html = await build.read("library/index.html");
      assert.doesNotMatch(html, /<(iframe|embed|object)\b/);
      assert.doesNotMatch(html, /<script[^>]*\ssrc=/);
      assert.equal(count(html, /openstreetmap\.org/g), 1, "the map provider appears only in the link");
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

  it("names a services-grid item image without alt text, and an empty list", () =>
    expectFailure(
      [
        "  - id: v3p8",
        "    type: services-grid",
        "    items:",
        "      - { title: Bread }",
        "      - { title: Buns, image: /assets/test/photo.svg }",
        "  - { id: v4p9, type: services-grid, items: [] }",
        "",
      ].join("\n"),
      "test.md",
      'section "v3p8" (services-grid): items[1]: image "/assets/test/photo.svg" has no alt text. Set "imageAlt".',
      'section "v4p9" (services-grid): prop "items": needs at least one item',
    ));

  it("names a gallery image and a testimonial photo without alt text", () =>
    expectFailure(
      [
        "  - id: g1r4",
        "    type: gallery",
        "    images:",
        "      - { image: /assets/test/photo.svg, alt: One }",
        "      - { image: /assets/test/photo.svg, alt: Two }",
        "      - { image: /assets/test/photo.svg }",
        "  - id: t1g3",
        "    type: testimonials",
        "    items:",
        "      - { quote: Good bread, name: Mari, image: /assets/test/photo.svg }",
        "",
      ].join("\n"),
      "test.md",
      'section "g1r4" (gallery): images[2]: image "/assets/test/photo.svg" has no alt text. Set "alt".',
      'section "t1g3" (testimonials): items[0]: image "/assets/test/photo.svg" has no alt text. Set "imageAlt".',
    ));

  it("names a cta without a button, and hours-location without address and hours", () =>
    expectFailure(
      "  - { id: c1b6, type: cta, title: Hello }\n  - { id: k7h2, type: hours-location, title: Visit us, note: Closed }\n",
      "test.md",
      'section "c1b6" (cta): missing required prop "button"',
      'section "k7h2" (hours-location): needs an "address", "hours" or both',
    ));
});
