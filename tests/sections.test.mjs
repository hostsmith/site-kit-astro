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
  const build = await buildFixture("base", { files: { "src/content/pages/test.en.md": page(sections) } });
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
      assert.equal(count(html, /data-section="hero"/g), 5);
      for (const title of ["Centered hero", "Left hero", "Right hero", "Background hero", "Page hero"]) assert.ok(html.includes(title), `${title} is missing`);
      for (const variant of ["centered", "image-left", "image-right", "background", "page"]) {
        assert.match(html, new RegExp(`<section data-section="hero" class="sk-section sk-hero sk-hero--${variant}">`), `${variant} modifier`);
      }
      assert.match(html, /<div class="sk-hero__content">[\s\S]*?<\/div>\s*<img[^>]*class="sk-hero__media"/, "the text comes before the image");
    });

    it("renders only the first hero title as h1", async () => {
      const html = await build.read("heroes/index.html");
      assert.equal(count(html, /<h1\b/g), 1);
      assert.match(html, /<h1[^>]*data-field="pages\/heroes\.en#sections\[h1a1\]\.title"[^>]*>Centered hero<\/h1>/);
      assert.match(html, /<h2[^>]*data-field="pages\/heroes\.en#sections\[h2b2\]\.title"[^>]*>Left hero<\/h2>/);
    });

    it("renders the call to action", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<a href="\/order"[^>]*data-field="pages\/home\.en#sections\[s7k2\]\.cta\.label"[^>]*>Order now<\/a>/);
      assert.match(html, /<section data-section="hero"/);
      assert.match(html, /<img src="\/assets\/test\/photo\.svg" alt="Loaves of rye bread on a wooden counter"[^>]*data-field="pages\/home\.en#sections\[s7k2\]\.image"/);
    });

    it("renders the badge, two buttons in order and the note", async () => {
      const hero = sectionHtml(await build.read("heroes/index.html"), "pages/heroes.en", "h3c3");
      const at = (path) => `data-field="pages/heroes.en#sections\\[h3c3\\]\\.${path}"`;
      assert.match(hero, new RegExp(`<p class="sk-hero__badge" ${at("badge")}>\\s*Serving Testville since 1998\\s*</p>\\s*<h2`), "the badge comes before the title");
      assert.match(
        hero,
        new RegExp(
          `<div class="sk-buttons">\\s*<a href="/about" class="sk-button sk-button--primary" ${at("cta\\.label")}>\\s*Get a quote\\s*</a>\\s*<a href="/services/plumbing" class="sk-button sk-button--secondary" ${at("secondaryCta\\.label")}>\\s*See services\\s*</a>`,
        ),
      );
      assert.match(hero, new RegExp(`</div>\\s*<p class="sk-hero__note" ${at("note")}>\\s*Typical jobs from \\$400\\s*</p>`), "the note follows the buttons");
    });

    it("renders the page variant's eyebrow before the title and the image after the text", async () => {
      const hero = sectionHtml(await build.read("heroes/index.html"), "pages/heroes.en", "h5e5");
      assert.match(hero, /^<section data-section="hero" class="sk-section sk-hero sk-hero--page">/);
      assert.match(hero, /<p class="sk-eyebrow" data-field="pages\/heroes\.en#sections\[h5e5\]\.eyebrow">\s*About us\s*<\/p>\s*<h2 class="sk-hero__title"/);
      assert.match(hero, /A page header with a wide photo\.\s*<\/p>\s*<\/div>\s*<img[^>]*class="sk-hero__media"/);
    });

    it("builds a page hero without an image", async () => {
      const build = await buildFixture("base", { files: { "src/content/pages/test.en.md": page("  - { id: s7k2, type: hero, title: Our story, variant: page }\n") } });
      try {
        assert.ok(build.ok, build.output);
      } finally {
        await build.cleanup();
      }
    });
  });

  describe("rich-text", () => {
    it("renders every variant", async () => {
      assert.match(await build.read("index.html"), /data-section="rich-text" class="sk-section sk-rich-text sk-rich-text--narrow"/);
      assert.match(await build.read("about/index.html"), /data-section="rich-text" class="sk-section sk-rich-text sk-rich-text--wide"/);
      assert.match(await build.read("library/index.html"), /data-section="rich-text" class="sk-section sk-rich-text sk-rich-text--title-aside"/);
    });

    it("keeps the title before the body, each its own part, in title-aside", async () => {
      const section = sectionHtml(await build.read("library/index.html"), "pages/library.en", "s4a8");
      assert.match(
        section,
        /<div class="sk-section__header">\s*<h2 class="sk-section__title"[^>]*>\s*Our story\s*<\/h2>\s*<\/div>\s*<div class="sk-rich-text__body sk-prose"[^>]*>\s*<p>The bakery opened in 1998\.<\/p>/,
      );
    });

    it("renders title and body with field attributes", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<h2[^>]*data-field="pages\/home\.en#sections\[r4t8\]\.title"[^>]*>About the bread<\/h2>/);
      assert.match(innerHtml(html, "div", 'data-field="pages/home.en#sections[r4t8].body"'), /<em>spelt<\/em>/);
    });
  });

  describe("collection-list", () => {
    it("renders the three newest non-draft entries, each linked", async () => {
      const html = await build.read("index.html");
      const section = html.slice(html.indexOf('data-section="collection-list"'));
      const titles = [...section.matchAll(/<a href="([^"]+)"[^>]*data-field="news\/([^"#]+)#title"[^>]*>\s*([^<]+?)\s*<\/a>/g)].map((m) => [m[1], m[2]]);
      assert.deepEqual(titles, [
        ["/news/fresh-rye", "fresh-rye.en"],
        ["/news/third", "third.en"],
        ["/news/second", "second.en"],
      ]);
    });

    it("renders the read-more text from settings", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<a href="\/news\/fresh-rye" aria-describedby="n2w6-fresh-rye"[^>]*data-field="settings\/site\.en#ui\.readMore"[^>]*>\s*Read more\s*<\/a>/);
    });

    it("renders the list variant with every entry", async () => {
      const html = await build.read("news/index.html");
      assert.match(html, /class="sk-section sk-collection-list sk-collection-list--list"/);
      assert.equal(count(html, /data-field="news\/[^"]+#title"/g), 4);
    });

    it("renders the link beside the title", async () => {
      const section = sectionHtml(await build.read("index.html"), "pages/home.en", "n2w6");
      assert.match(section, /<h2 class="sk-section__title"[^>]*>\s*Latest news\s*<\/h2>\s*<a href="\/news" class="sk-section__link" data-field="pages\/home\.en#sections\[n2w6\]\.link\.label">\s*All news\s*<\/a>/);
    });

    it("shows an entry's image, category and date in the site's language", async () => {
      const section = sectionHtml(await build.read("index.html"), "pages/home.en", "n2w6");
      const card = section.slice(section.indexOf("<li"), section.indexOf("</li>"));
      assert.match(card, /<img src="\/assets\/test\/photo\.svg" alt="A rye loaf" class="sk-card__media" data-field="news\/fresh-rye\.en#image">/);
      assert.match(card, /<p class="sk-card__category" data-field="news\/fresh-rye\.en#category">\s*Shop news\s*<\/p>\s*<h3/, "the category comes before the title");
      assert.match(card, /<time datetime="2026-04-01" class="sk-card__meta" data-field="news\/fresh-rye\.en#date">\s*April 1, 2026\s*<\/time>/);
    });

    it("shows only the title and date of an entry without image or category", async () => {
      const section = sectionHtml(await build.read("index.html"), "pages/home.en", "n2w6");
      const third = section.split("<li").find((card) => card.includes("news/third.en#title"));
      assert.ok(!third.includes("sk-card__media") && !third.includes("sk-card__category"));
      assert.match(third, /<time datetime="2026-03-01"[^>]*>\s*March 1, 2026\s*<\/time>/);
    });

    it("features the first entry of the featured variant", async () => {
      const section = sectionHtml(await build.read("library/index.html"), "pages/library.en", "n9f3");
      assert.match(section, /^<section data-section="collection-list" class="sk-section sk-collection-list sk-collection-list--featured">/);
      const cards = [...section.matchAll(/<li class="([^"]+)">/g)].map((m) => m[1]);
      assert.deepEqual(cards, ["sk-card sk-card--linked sk-card--featured", "sk-card sk-card--linked"]);
    });
  });

  describe("services-grid", () => {
    it("renders both variants", async () => {
      const home = await build.read("index.html");
      assert.match(home, /<section data-section="services-grid" class="sk-section sk-services-grid sk-services-grid--cards sk-tone-surface">/);
      assert.equal(count(innerHtml(home, "section", 'data-section="services-grid"'), /<li class="sk-card( sk-card--linked)?">/g), 2);
      const library = await build.read("library/index.html");
      assert.match(library, /<section data-section="services-grid" class="sk-section sk-services-grid sk-services-grid--list sk-tone-plain">/);
      assert.equal(count(innerHtml(library, "section", 'data-section="services-grid"'), /<li class="sk-card">/g), 2);
    });

    it("renders the eyebrow, title, intro and link in the section header", async () => {
      const section = sectionHtml(await build.read("index.html"), "pages/home.en", "v3p8");
      const at = (path) => `data-field="pages/home.en#sections\\[v3p8\\]\\.${path}"`;
      assert.match(
        section,
        new RegExp(
          `<div class="sk-section__header">\\s*<p class="sk-eyebrow" ${at("eyebrow")}>\\s*What we do\\s*</p>\\s*<h2 class="sk-section__title" ${at("title")}>[\\s\\S]*?<p class="sk-section__intro"[\\s\\S]*?<a href="/services/plumbing" class="sk-section__link" ${at("link\\.label")}>\\s*All services\\s*</a>\\s*</div>`,
        ),
      );
    });

    it("marks only linked items for a whole-card link", async () => {
      const section = sectionHtml(await build.read("index.html"), "pages/home.en", "v3p8");
      assert.match(section, /<li class="sk-card">[\s\S]*?Daily bread/, "an item without a link");
      assert.match(section, /<li class="sk-card sk-card--linked">[\s\S]*?<a href="\/catering"/, "an item with a link");
    });

    it("renders the section and item fields", async () => {
      const html = await build.read("index.html");
      const at = (path) => `data-field="pages/home.en#sections\\[v3p8\\]\\.${path}"`;
      assert.match(html, new RegExp(`<h2[^>]*${at("title")}[^>]*>What we bake</h2>`));
      assert.match(html, new RegExp(`<p[^>]*${at("intro")}[^>]*>Bread for every day and every party\\.</p>`));
      assert.match(html, new RegExp(`<img src="/assets/test/photo\\.svg" alt="A loaf of rye bread"[^>]*${at("items\\[0\\]\\.image")}`));
      assert.match(html, new RegExp(`<h3[^>]*${at("items\\[0\\]\\.title")}[^>]*>\\s*Daily bread\\s*</h3>`));
      assert.match(html, new RegExp(`<p[^>]*${at("items\\[0\\]\\.text")}[^>]*>Rye and spelt from 7:00\\.</p>`));
    });

    // site-kit-section-library, "Kit icon set".
    it("renders an item's icon as an inline SVG hidden from assistive technology", async () => {
      const html = await build.read("index.html");
      assert.match(
        html,
        /<span class="sk-card__icon">\s*<svg class="sk-icon" data-icon="users" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"[^>]*aria-hidden="true" focusable="false">/,
      );
      assert.equal(count(innerHtml(html, "section", 'data-section="services-grid"'), /class="sk-card__icon"/g), 1, "an item without an icon has no tile");
    });

    it("renders a linked item title as the link", async () => {
      const html = await build.read("index.html");
      assert.match(html, /<h3[^>]*>\s*<a href="\/catering"[^>]*data-field="pages\/home\.en#sections\[v3p8\]\.items\[1\]\.title"[^>]*>\s*Catering\s*<\/a>/);
    });
  });

  describe("gallery", () => {
    it("renders both variants", async () => {
      const html = await build.read("library/index.html");
      const grid = sectionHtml(html, "pages/library.en", "g1r4");
      assert.match(grid, /^<section data-section="gallery" class="sk-section sk-gallery sk-gallery--grid">/);
      assert.equal(count(grid, /class="sk-gallery__image"/g), 3);
      const masonry = sectionHtml(html, "pages/library.en", "g2m5");
      assert.match(masonry, /^<section data-section="gallery" class="sk-section sk-gallery sk-gallery--masonry">/);
      assert.equal(count(masonry, /<li class="sk-gallery__item">/g), 2);
    });

    it("renders images and captions with field attributes", async () => {
      const html = await build.read("library/index.html");
      const at = (path) => `data-field="pages/library.en#sections\\[g1r4\\]\\.${path}"`;
      assert.match(html, /<h2[^>]*data-field="pages\/library\.en#sections\[g1r4\]\.title"[^>]*>Inside the bakery<\/h2>/);
      assert.match(html, new RegExp(`<img src="/assets/test/photo\\.svg" alt="The oven" loading="lazy"[^>]*${at("images\\[0\\]\\.image")}`));
      assert.match(html, new RegExp(`<img src="/assets/test/photo\\.svg" alt="The shop front"[^>]*${at("images\\[2\\]\\.image")}`));
      assert.match(html, new RegExp(`<figcaption[^>]*${at("images\\[0\\]\\.caption")}[^>]*>\\s*Lit at 3:00\\s*</figcaption>`));
      assert.equal(count(sectionHtml(html, "pages/library.en", "g1r4"), /<figcaption\b/g), 1, "an image without a caption has no figcaption");
    });
  });

  describe("testimonials", () => {
    it("renders both variants", async () => {
      const html = await build.read("library/index.html");
      const grid = sectionHtml(html, "pages/library.en", "t1g3");
      assert.match(grid, /^<section data-section="testimonials" class="sk-section sk-testimonials sk-testimonials--grid sk-tone-surface">/);
      assert.equal(count(grid, /<blockquote\b/g), 2);
      const single = sectionHtml(html, "pages/library.en", "t2s4");
      assert.match(single, /^<section data-section="testimonials" class="sk-section sk-testimonials sk-testimonials--single sk-tone-dark">/);
    });

    it("puts a placeholder in the place of a missing photo", async () => {
      const grid = sectionHtml(await build.read("library/index.html"), "pages/library.en", "t1g3");
      const [first, second] = grid.split('<figure class="sk-testimonials__item">').slice(1);
      assert.match(first, /<img[^>]*class="sk-testimonials__avatar"/);
      assert.ok(!first.includes("sk-testimonials__placeholder"), "an item with a photo has no placeholder");
      assert.match(second, /<figcaption class="sk-testimonials__author">\s*<span class="sk-testimonials__placeholder" aria-hidden="true"><\/span>/);
      assert.ok(!second.includes("<img"), "the placeholder is no image");
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
        const at = `data-field="pages/library.en#sections\\[t1g3\\]\\.items\\[${i}\\]\\.${prop}"`;
        assert.match(html, new RegExp(`<(p|div)[^>]*${at}[^>]*>\\s*${text.replace(".", "\\.")}\\s*</\\1>`), `items[${i}].${prop}`);
      }
      assert.match(html, /<blockquote[^>]*>\s*<p data-field="pages\/library\.en#sections\[t1g3\]\.items\[0\]\.quote">/);
      assert.match(html, /<img src="\/assets\/test\/photo\.svg" alt="Mari Tamm"[^>]*data-field="pages\/library\.en#sections\[t1g3\]\.items\[0\]\.image"/);
      assert.ok(!html.includes("sections[t1g3].items[1].role"), "an item without a role renders no role");
    });
  });

  describe("faq", () => {
    it("renders each item as a native disclosure with the question as its summary", async () => {
      const faq = sectionHtml(await build.read("index.html"), "pages/home.en", "q1m9");
      assert.match(faq, /^<section data-section="faq"/);
      assert.equal(count(faq, /<details class="sk-faq__item">/g), 2, "two closed <details>");
      assert.match(faq, /<details class="sk-faq__item">\s*<summary[^>]*data-field="pages\/home\.en#sections\[q1m9\]\.items\[0\]\.question"[^>]*>\s*When do you open\?\s*<\/summary>/);
      assert.doesNotMatch(faq, /<script|\son[a-z]+=/, "the FAQ needs no script");
    });

    it("renders the answer as markdown with a field attribute", async () => {
      const html = await build.read("index.html");
      const first = innerHtml(html, "div", 'data-field="pages/home.en#sections[q1m9].items[0].answer"');
      assert.equal(first.trim(), "<p>Every day at 7:00.</p>");
      const second = innerHtml(html, "div", 'data-field="pages/home.en#sections[q1m9].items[1].answer"');
      assert.match(second, /<a href="mailto:test@example\.com">Email us<\/a>/);
      assert.equal(count(second, /<li>/g), 2);
    });
  });

  describe("cta", () => {
    it("renders both buttons as links, the main one first", async () => {
      const cta = sectionHtml(await build.read("library/index.html"), "pages/library.en", "c1b6");
      const links = [...cta.matchAll(/<a href="([^"]+)"[^>]*data-field="pages\/library\.en#sections\[c1b6\]\.(\w+)\.label"[^>]*>\s*([^<]+?)\s*<\/a>/g)];
      assert.deepEqual(
        links.map((m) => m.slice(1)),
        [
          ["mailto:test@example.com", "button", "Email us"],
          ["tel:+15550100", "secondaryButton", "Call us"],
        ],
      );
      assert.match(cta, /<h2[^>]*data-field="pages\/library\.en#sections\[c1b6\]\.title"[^>]*>Planning an event\?<\/h2>/);
      assert.match(cta, /<p[^>]*data-field="pages\/library\.en#sections\[c1b6\]\.text"[^>]*>Tell us the date and the number of guests\.<\/p>/);
    });

    it("renders both variants", async () => {
      const html = await build.read("library/index.html");
      const banner = sectionHtml(html, "pages/library.en", "c1b6");
      assert.match(banner, /^<section data-section="cta" class="sk-section sk-cta sk-cta--banner sk-tone-accent">/, "accent is the default tone");
      assert.match(banner, /<a href="mailto:test@example\.com" class="sk-button sk-button--primary"/);
      assert.match(banner, /<a href="tel:\+15550100" class="sk-button sk-button--secondary"/);
      const card = sectionHtml(html, "pages/library.en", "c2k7");
      assert.match(card, /^<section data-section="cta" class="sk-section sk-cta sk-cta--card sk-tone-dark">/);
      assert.equal(count(card, /<a\b/g), 1, "a card without secondaryButton has one link");
    });
  });

  describe("hours-location", () => {
    it("renders the address, hours, note and map link with field attributes", async () => {
      const section = sectionHtml(await build.read("library/index.html"), "pages/library.en", "k7h2");
      const at = (path) => `data-field="pages/library.en#sections\\[k7h2\\]\\.${path}"`;
      assert.match(section, /^<section data-section="hours-location"/);
      assert.match(section, new RegExp(`<address[^>]*${at("address")}[^>]*>\\s*1 Test Street<br>12345 Testville\\s*</address>`));
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

    it("shows its phone number and email address as links", async () => {
      const section = sectionHtml(await build.read("library/index.html"), "pages/library.en", "k7h2");
      assert.match(
        section,
        /<a href="tel:\+15550100" class="sk-hours-location__contact-link" data-field="pages\/library\.en#sections\[k7h2\]\.phone">\s*<svg class="sk-icon" data-icon="phone"[^>]*>[\s\S]*?<\/svg>\s*\+1 555 0100\s*<\/a>/,
      );
      assert.match(section, /<a href="mailto:test@example\.com" class="sk-hours-location__contact-link" data-field="pages\/library\.en#sections\[k7h2\]\.email">/);
    });

    it("shows no contact details without a phone or email", async () => {
      const build = await buildFixture("base", {
        files: { "src/content/pages/test.en.md": page("  - { id: k7h2, type: hours-location, address: 1 Test Street }\n") },
      });
      try {
        assert.ok(build.ok, build.output);
        assert.ok(!(await build.read("test/index.html")).includes("sk-hours-location__contact"));
      } finally {
        await build.cleanup();
      }
    });
  });

  describe("trust-bar", () => {
    it("renders each item with its field path, in both variants", async () => {
      const html = await build.read("blocks/index.html");
      const line = sectionHtml(html, "pages/blocks.en", "b1t1");
      assert.match(line, /^<section data-section="trust-bar" class="sk-section sk-trust-bar sk-trust-bar--line">/);
      assert.equal(count(line, /<li class="sk-trust-bar__item"/g), 4);
      assert.match(line, /<li class="sk-trust-bar__item" data-field="pages\/blocks\.en#sections\[b1t1\]\.items\[0\]\.text">\s*Licensed &amp; insured\s*<\/li>/);
      assert.match(sectionHtml(html, "pages/blocks.en", "b2t2"), /^<section data-section="trust-bar" class="sk-section sk-trust-bar sk-trust-bar--chips">/);
    });
  });

  describe("stats", () => {
    it("renders each figure's value and label with field paths", async () => {
      const stats = sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b4s4");
      assert.match(stats, /^<section data-section="stats" class="sk-section sk-stats sk-tone-dark">/);
      assert.equal(count(stats, /<li class="sk-stat">/g), 4);
      assert.match(
        stats,
        /<li class="sk-stat">\s*<p class="sk-stat__value" data-field="pages\/blocks\.en#sections\[b4s4\]\.items\[3\]\.value">4\.9<\/p>\s*<p class="sk-stat__label" data-field="pages\/blocks\.en#sections\[b4s4\]\.items\[3\]\.label">Average rating<\/p>/,
      );
      assert.match(sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b3s3"), /class="sk-section sk-stats sk-tone-plain"/);
    });
  });

  describe("steps", () => {
    it("renders the steps as an ordered list, in order, with no number text", async () => {
      const steps = sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b5p5");
      const titles = [...steps.matchAll(/<h3 class="sk-steps__title"[^>]*>\s*([^<]+?)\s*<\/h3>/g)].map((m) => m[1]);
      assert.deepEqual(titles, ["Free visit", "Written quote", "The work", "Walkthrough"]);
      assert.match(steps, /<ol class="sk-steps__list">(\s*<li class="sk-steps__item">[\s\S]*?<\/li>){4}\s*<\/ol>/);
      assert.doesNotMatch(steps, />\s*0\d\s*</, "no number text");
      assert.equal(count(steps, /class="sk-steps__text"/g), 3, "a step without text has none");
      assert.match(steps, /<p class="sk-eyebrow"[^>]*>\s*How it works\s*<\/p>/);
    });
  });

  describe("split", () => {
    it("renders the image first, then the text, figures and link", async () => {
      const split = sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b6l6");
      assert.match(split, /^<section data-section="split" class="sk-section sk-split sk-split--image-left sk-tone-plain">\s*<div class="sk-container">\s*<img src="\/assets\/test\/photo\.svg" alt="The founders at work" class="sk-split__media"/);
      assert.match(split, /<div class="sk-split__body sk-prose"[^>]*>\s*<p>Started by <strong>two friends<\/strong> in 1998\.<\/p>/);
      assert.equal(count(split, /<li class="sk-stat">/g), 3);
      assert.match(split, /<p class="sk-stat__value" data-field="pages\/blocks\.en#sections\[b6l6\]\.stats\[0\]\.value">500\+<\/p>/);
      assert.match(split, /<a href="\/about" class="sk-split__link" data-field="pages\/blocks\.en#sections\[b6l6\]\.link\.label">\s*Meet the team\s*<\/a>/);
    });

    it("keeps the image first in the image-right variant", async () => {
      const split = sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b7r7");
      assert.match(split, /^<section data-section="split" class="sk-section sk-split sk-split--image-right sk-tone-surface">\s*<div class="sk-container">\s*<img/);
      assert.ok(!split.includes("sk-split__stats") && !split.includes("sk-split__body"), "no empty parts");
    });
  });

  describe("team", () => {
    it("renders a placeholder for a member without a photo", async () => {
      const team = sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b8m8");
      const members = team.split('<li class="sk-team__member">').slice(1);
      assert.equal(members.length, 3);
      assert.match(members[0], /^\s*<img src="\/assets\/test\/photo\.svg" alt="Dana in the workshop" class="sk-team__photo"/);
      assert.match(members[1], /^\s*<span class="sk-team__placeholder" aria-hidden="true"><\/span>\s*<p class="sk-team__name"[^>]*>\s*Sam\s*<\/p>\s*<p class="sk-team__role"[^>]*>\s*Project lead\s*<\/p>/);
      assert.ok(!members[1].includes("<img"), "the placeholder is no image");
      assert.ok(!members[2].includes("sk-team__role"), "a member without a role has none");
    });
  });

  describe("pricing-list", () => {
    it("renders each price as written in a description list", async () => {
      const pricing = sectionHtml(await build.read("blocks/index.html"), "pages/blocks.en", "b9c9");
      assert.match(
        pricing,
        /<dt class="sk-pricing-list__label" data-field="pages\/blocks\.en#sections\[b9c9\]\.items\[1\]\.label">\s*Kitchen remodel\s*<\/dt>\s*<dd class="sk-pricing-list__price" data-field="pages\/blocks\.en#sections\[b9c9\]\.items\[1\]\.price">\s*from \$18,000\s*<\/dd>/,
      );
      assert.match(pricing, /<p class="sk-pricing-list__note"[^>]*>\s*Your fixed quote follows the free visit\.\s*<\/p>/);
    });
  });
});

describe("invalid sections fail the build", () => {
  it("names a stats section with more than four or fewer than two figures", () =>
    expectFailure(
      [
        "  - id: s1s1",
        "    type: stats",
        "    items: [{ value: '1', label: A }, { value: '2', label: B }, { value: '3', label: C }, { value: '4', label: D }, { value: '5', label: E }]",
        "  - id: s2s2",
        "    type: stats",
        "    items: [{ value: '1', label: A }]",
        "",
      ].join("\n"),
      "test.en.md",
      'section "s1s1" (stats): prop "items": has at most 4 items',
      'section "s2s2" (stats): prop "items": needs at least 2 items',
    ));

  it("names a split without an image", () =>
    expectFailure("  - { id: s3s3, type: split, title: About us }\n", "test.en.md", 'section "s3s3" (split): missing required prop "image"'));

  it("names an unknown hero variant", () =>
    expectFailure("  - { id: s7k2, type: hero, title: One, variant: diagonal }\n", "test.en.md", 'section "s7k2" (hero): prop "variant" has the value "diagonal"'));

  it("names a hero image without alt text", () =>
    expectFailure(
      "  - { id: s7k2, type: hero, title: One, image: /assets/test/photo.svg, variant: image-left }\n",
      "test.en.md",
      'section "s7k2" (hero): image "/assets/test/photo.svg" has no alt text',
    ));

  it("names an unknown collection", () =>
    expectFailure("  - { id: s7k2, type: collection-list, collection: events }\n", "test.en.md", 'prop "collection" has the value "events"'));

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
      "test.en.md",
      'section "v3p8" (services-grid): items[1]: image "/assets/test/photo.svg" has no alt text. Set "imageAlt".',
      'section "v4p9" (services-grid): prop "items": needs at least one item',
    ));

  it("names an unknown icon, its item and the allowed names", () =>
    expectFailure(
      "  - id: v3p8\n    type: services-grid\n    items:\n      - { title: Bread, icon: wrench }\n      - { title: Repairs, icon: hammmer }\n",
      "test.en.md",
      'section "v3p8" (services-grid): prop "items[1].icon" has the value "hammmer", expected one of "calendar", "check"',
      '"wrench"',
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
      "test.en.md",
      'section "g1r4" (gallery): images[2]: image "/assets/test/photo.svg" has no alt text. Set "alt".',
      'section "t1g3" (testimonials): items[0]: image "/assets/test/photo.svg" has no alt text. Set "imageAlt".',
    ));

  it("names a cta without a button, and hours-location without anything to show", () =>
    expectFailure(
      "  - { id: c1b6, type: cta, title: Hello }\n  - { id: k7h2, type: hours-location, title: Visit us, note: Closed }\n",
      "test.en.md",
      'section "c1b6" (cta): missing required prop "button"',
      'section "k7h2" (hours-location): needs an "address", "hours", "phone" or "email"',
    ));
});

// "An eyebrow on every titled section" (site-kit-webflow-migration design
// D130): each type that gained one renders it right before its title, in the
// shared section header.
describe("an eyebrow on every titled section", () => {
  // Each type with the least it needs besides its eyebrow and title.
  const SECTIONS = [
    ["rich-text", "body: Text"],
    ["collection-list", "collection: news"],
    ["gallery", "images: [{ image: /assets/test/photo.svg, alt: A loaf }]"],
    ["testimonials", "items: [{ quote: Good bread., name: Ana }]"],
    ["faq", "items: [{ question: Open on Sunday?, answer: No. }]"],
    ["cta", "button: { label: Visit, link: /about }"],
    ["hours-location", "address: 1 Mill Lane"],
    ["trust-bar", "items: [{ text: Local flour }]"],
    ["stats", 'items: [{ value: "20", label: Years }, { value: "3", label: Ovens }]'],
    ["team", "items: [{ name: Ana }]"],
    ["pricing-list", "items: [{ label: Loaf, price: $5 }]"],
  ];
  // The interactive parts need their interface strings, which the interactive fixture has.
  const PARTS = [
    ["tabs", "items: [{ label: One, body: First }, { label: Two, body: Second }]"],
    ["slider", "slides: [{ title: One }]"],
    ["embed", "url: https://example.com/"],
  ];
  const sectionsOf = (list) => list.map(([type, props], i) => `  - { id: y${String(i).padStart(2, "0")}a, type: ${type}, eyebrow: Eyebrow ${type}, title: Title ${type}, ${props} }\n`).join("");

  async function expectEyebrows(fixture, list, options = {}) {
    const build = await buildFixture(fixture, { ...options, files: { "src/content/pages/test.en.md": page(sectionsOf(list)) } });
    try {
      assert.ok(build.ok, build.output);
      const html = await build.read("test/index.html");
      list.forEach(([type], i) => {
        const id = `y${String(i).padStart(2, "0")}a`;
        assert.match(
          sectionHtml(html, "pages/test.en", id),
          new RegExp(`<div class="sk-section__header">\\s*<p class="sk-eyebrow" data-field="pages/test\\.en#sections\\[${id}\\]\\.eyebrow">\\s*Eyebrow ${type}\\s*</p>\\s*<h2 class="sk-section__title"`),
          type,
        );
      });
    } finally {
      await build.cleanup();
    }
  }

  it("renders it in the eleven types without a script", () => expectEyebrows("base", SECTIONS));
  it("renders it in tabs, slider and embed", () => expectEyebrows("interactive", PARTS, { example: "webflow" }));
});
