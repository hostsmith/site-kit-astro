// site-kit-locales: locales in the site config, which every site lists, and a
// localized site's content, URLs, links, switcher, SEO and 404 pages.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ASSEMBLED } from "../packages/site-kit-astro/scripts/decap-config.mjs";
import { resolveLocales } from "../packages/site-kit-astro/src/lib/locales.ts";
import { buildFixture } from "./helpers.mjs";

// A build of the localized fixture that should fail, mentioning each text.
async function expectFailure(options, ...expected) {
  const build = await buildFixture("locales", options);
  try {
    assert.equal(build.ok, false, "the build should fail");
    for (const text of expected) assert.ok(build.output.includes(text), `output doesn't mention ${JSON.stringify(text)}:\n${build.output.slice(-3000)}`);
  } finally {
    await build.cleanup();
  }
}

// The inner HTML of the element with this id.
const byId = (html, id) => html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1];

// site-kit-locales, "Locales are configured in the site config".
describe("locales in the site config", () => {
  it("fill in the defaults", () => {
    const [en, de] = resolveLocales([{ code: "en", tag: "en-US" }, { code: "de" }]);
    assert.deepEqual(en, { code: "en", tag: "en-US", path: "", label: "English", dir: "ltr", isDefault: true });
    assert.deepEqual(de, { code: "de", tag: "de", path: "/de", label: "Deutsch", dir: "ltr", isDefault: false });
  });

  it("default the path to the tag lowercased, as Webflow does", () => {
    assert.equal(resolveLocales([{ code: "en" }, { code: "es-mx", tag: "es-MX" }])[1].path, "/es-mx");
  });

  it("name two locales of one language with their regions", () => {
    assert.deepEqual(
      resolveLocales([{ code: "en", tag: "en-US" }, { code: "en-gb", tag: "en-GB" }]).map((l) => l.label),
      ["American English", "British English"],
    );
  });

  it("set the direction of a right-to-left language", () => {
    assert.equal(resolveLocales([{ code: "en" }, { code: "ar" }])[1].dir, "rtl");
  });

  // site-kit-locales, "One locale".
  it("take a single locale, served at the root", () => {
    assert.deepEqual(resolveLocales([{ code: "en", tag: "en-US" }]), [{ code: "en", tag: "en-US", path: "", label: "English", dir: "ltr", isDefault: true }]);
  });

  const fails = (list, pattern) => assert.throws(() => resolveLocales(list), pattern);

  it("fail on a path for the default locale", () => fails([{ code: "en", path: "/en" }, { code: "de" }], /default locale "en".*served at the root/));
  it("fail without locales", () => fails(undefined, /Every site lists its locales/));
  it("fail on an empty list", () => fails([], /Every site lists its locales/));
  it("fail on an invalid code", () => fails([{ code: "EN" }, { code: "de" }], /lowercase BCP 47 code/));
  it("fail on a duplicate code", () => fails([{ code: "en" }, { code: "de" }, { code: "de" }], /"de" .* listed twice/));
  it("fail on an invalid tag", () => fails([{ code: "en" }, { code: "de", tag: "not a tag" }], /isn't a BCP 47 tag/));
  it("fail on a path of more than one segment", () => fails([{ code: "en" }, { code: "de", path: "/de/x" }], /one lowercase segment/));
  it("fail on two locales with one path", () => fails([{ code: "en" }, { code: "de", path: "/x" }, { code: "fr", path: "/x" }], /"de" and "fr" .* both have the path "\/x"/));

  // site-kit-locales, "No locales".
  it("fail the build, naming what to fix", async () => {
    const build = await buildFixture("base", {
      edit: {
        "src/site.config.ts": (config) => config.replace('  locales: [{ code: "en" }],\n', ""),
        // The example's config as it is: the integration checks the locales.
        [ASSEMBLED]: (config) => config,
      },
    });
    try {
      assert.equal(build.ok, false, "the build should fail");
      assert.match(build.output, /"locales" in src\/site\.config\.ts is missing or empty\. Every site lists its locales/);
    } finally {
      await build.cleanup();
    }
  });
});

describe("a localized site", () => {
  let build;
  const page = (path) => build.read(path === "/" ? "index.html" : `${path.slice(1)}/index.html`);
  before(async () => {
    build = await buildFixture("locales");
  });
  after(() => build.cleanup());

  it("builds", () => assert.ok(build.ok, build.output));

  // "The locale in content file names", "Localized URLs".
  it("serves each locale's pages under its prefix, with their local slugs", () => {
    for (const path of ["/", "/about", "/services/painting", "/careers", "/de", "/de/ueber-uns", "/de/leistungen", "/de/leistungen/malerarbeiten", "/de/kontakt"]) {
      assert.ok(build.exists(path === "/" ? "index.html" : `${path.slice(1)}/index.html`), `${path} is missing`);
    }
    assert.equal(build.exists("de/careers/index.html"), false, "an English-only page has a German URL");
  });

  it("gives a hand-written page the locale whose path starts its URL", async () => {
    const html = await page("/de/impressum");
    assert.match(html, /<a href="\/de" class="sk-header__brand"/);
    assert.match(html, /Über uns/, "the German nav");
  });

  it("names a translation's entry by its file, with its locale", async () => {
    assert.match(await page("/de/ueber-uns"), /data-field="pages\/about\.de#sections\[a1b2\]\.body"/);
  });

  it("serves entries under each locale's base path", () => {
    for (const path of ["/blog/fresh-rye", "/blog/opening-hours", "/de/aktuelles/frisches-roggenbrot"]) {
      assert.ok(build.exists(`${path.slice(1)}/index.html`), `${path} is missing`);
    }
  });

  // "Settings, facts and interface strings per locale".
  it("fills each locale's facts, in frontmatter and in Markdown bodies", async () => {
    assert.match(await page("/"), /1 Test Street/);
    assert.match(await page("/de"), /Teststraße 1/);
    assert.doesNotMatch(await page("/de"), /1 Test Street/);
    assert.match(await page("/de/aktuelles/frisches-roggenbrot"), /in der Teststraße 1/);
  });

  it("uses each locale's settings and interface strings", async () => {
    const de = await page("/de/aktuelles/frisches-roggenbrot");
    assert.match(de, /Über uns/, "the German nav");
    assert.equal(byId(de, "min-read"), "2 Minuten");
    assert.match(de, /data-field="settings\/site\.de#ui\.minRead"/);
    assert.equal(byId(await page("/blog/fresh-rye"), "min-read"), "2 minutes");
  });

  // "Collections list the page's locale".
  it("lists a collection's entries in the page's locale", async () => {
    const de = await page("/de/aktuelles");
    assert.match(de, /href="\/de\/aktuelles\/frisches-roggenbrot"/);
    assert.doesNotMatch(de, /opening-hours/, "an English-only post in the German list");
    const en = await page("/blog");
    assert.match(en, /href="\/blog\/fresh-rye"/);
    assert.match(en, /href="\/blog\/opening-hours"/);
  });

  // "Language switcher".
  it("links the switcher to the current page in each locale, marking the current one", async () => {
    const html = await page("/about");
    const nav = html.slice(html.indexOf('<nav class="sk-locales"'), html.indexOf("</nav>", html.indexOf('<nav class="sk-locales"')));
    assert.match(nav, /aria-label="Language"/);
    assert.match(nav, /<a href="\/about" class="sk-locales__link" lang="en-US" hreflang="en-US" aria-current="page">English<\/a>/);
    assert.match(nav, /<a href="\/de\/ueber-uns" class="sk-locales__link" lang="de-DE" hreflang="de-DE">Deutsch<\/a>/);
  });

  it("links the switcher to a locale's home page when the page has no translation", async () => {
    assert.match(await page("/careers"), /<a href="\/de" class="sk-locales__link" lang="de-DE" hreflang="de-DE">Deutsch<\/a>/);
  });

  it("leaves the switcher's links unlocalized, on a translated page", async () => {
    const html = await page("/de/ueber-uns");
    assert.match(html, /<a href="\/about" class="sk-locales__link" lang="en-US" hreflang="en-US">English<\/a>/);
    assert.match(html, /aria-label="Sprache"/);
  });

  it("puts the switcher in the footer too", async () => {
    assert.match(await page("/about"), /<div class="sk-footer__block sk-footer__block--locales"><nav class="sk-locales"/);
  });

  it("sets lang and dir from the locale", async () => {
    assert.match(await page("/de"), /<html lang="de-DE" dir="ltr"/);
    assert.match(await page("/"), /<html lang="en-US" dir="ltr"/);
  });

  // "Language from the tag": the settings' language, which templates format
  // dates with, is the locale's tag.
  it("gives site code the locale's tag as the settings' language", async () => {
    assert.match(await page("/de/aktuelles/frisches-roggenbrot"), /<time datetime="2026-04-01"[^>]*>1\. April 2026<\/time>/);
    assert.match(await page("/blog/fresh-rye"), /<time datetime="2026-04-01"[^>]*>April 1, 2026<\/time>/);
  });

  // "SEO per locale".
  it("links a translated page to each translation and x-default", async () => {
    for (const path of ["/about", "/de/ueber-uns"]) {
      const html = await page(path);
      assert.match(html, /<link rel="alternate" hreflang="en-US" href="https:\/\/www\.example\.com\/about">/, path);
      assert.match(html, /<link rel="alternate" hreflang="de-DE" href="https:\/\/www\.example\.com\/de\/ueber-uns">/, path);
      assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/www\.example\.com\/about">/, path);
    }
    const de = await page("/de/ueber-uns");
    assert.match(de, /<meta property="og:locale" content="de_DE">/);
    assert.match(de, /<meta property="og:locale:alternate" content="en_US">/);
  });

  it("gives a page in one locale no alternates", async () => {
    const html = await page("/careers");
    assert.doesNotMatch(html, /<link rel="alternate"/);
    assert.match(html, /<meta property="og:locale" content="en_US">/);
  });

  it("lists every locale's URLs in the sitemap, with alternates", async () => {
    const sitemap = await build.read("sitemap.xml");
    assert.match(sitemap, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    const about = sitemap.slice(sitemap.indexOf("<loc>https://www.example.com/about</loc>"), sitemap.indexOf("</url>", sitemap.indexOf("<loc>https://www.example.com/about</loc>")));
    assert.match(about, /<xhtml:link rel="alternate" hreflang="en-US" href="https:\/\/www\.example\.com\/about"\/>/);
    assert.match(about, /<xhtml:link rel="alternate" hreflang="de-DE" href="https:\/\/www\.example\.com\/de\/ueber-uns"\/>/);
    assert.match(about, /hreflang="x-default"/);
    assert.match(sitemap, /<loc>https:\/\/www\.example\.com\/de\/ueber-uns<\/loc>/);
    assert.match(sitemap, /<url><loc>https:\/\/www\.example\.com\/careers<\/loc><\/url>/, "a page in one locale has no alternates");
    assert.doesNotMatch(sitemap, /404/);
  });

  // "A 404 page per locale".
  it("writes a 404 page per locale, no-index and without alternates", async () => {
    const en = await build.read("404.html");
    const de = await build.read("de/404.html");
    assert.match(en, /<html lang="en-US"/);
    assert.match(de, /<html lang="de-DE"/);
    assert.match(de, /Nicht gefunden/);
    for (const html of [en, de]) {
      assert.match(html, /<meta name="robots" content="noindex">/);
      assert.doesNotMatch(html, /<link rel="alternate"/);
    }
    assert.equal(build.exists("de/404/index.html"), false);
  });

  // "Custom pages in every locale".
  it("renders a custom page in each locale with its page template", async () => {
    assert.equal(byId(await page("/story"), "story-title"), "Our story");
    const de = await page("/de/geschichte");
    assert.equal(byId(de, "story-title"), "Unsere Geschichte");
    assert.match(de, /<html lang="de-DE"/);
  });

  // site-kit-package, the locale helpers.
  it("gives site code a link's path in the page's locale", async () => {
    assert.match(await page("/story"), /data-contact="\/contact\?from=story#form" data-careers="\/careers"/);
    assert.match(await page("/de/geschichte"), /data-contact="\/de\/kontakt\?from=story#form" data-careers="\/careers"/);
  });

  // "Content links are localized".
  it("localizes a section's link, a nav link and a Markdown link", async () => {
    const html = await page("/de");
    assert.match(html, /<a href="\/de\/kontakt" class="sk-button/, "the hero button");
    assert.match(html, /<a href="\/de\/ueber-uns"[^>]*class="sk-nav__link"/, "the nav");
    assert.match(html, /<a href="\/de\/leistungen#painting">Malerarbeiten<\/a>/, "the Markdown link, with its fragment");
  });

  it("leaves a link to a page without a translation, and external links, as written", async () => {
    const html = await page("/de");
    assert.match(html, /<a href="\/blog\/opening-hours">Öffnungszeiten<\/a>/);
    assert.match(html, /<a href="https:\/\/example\.org\/story">/);
  });

  it("leaves the default locale's links as written", async () => {
    const html = await page("/");
    assert.match(html, /<a href="\/contact" class="sk-button/);
    assert.match(html, /<a href="\/services#painting">/);
  });

  // site-kit-routing, "Breadcrumb in a second locale".
  it("starts a translation's breadcrumb at its locale's home page", async () => {
    const html = await page("/de/leistungen/malerarbeiten");
    const nav = html.slice(html.indexOf('class="sk-breadcrumb"'), html.indexOf("</nav>", html.indexOf('class="sk-breadcrumb"')));
    assert.match(nav, /<a href="\/de" class="sk-breadcrumb__link"[^>]*>\s*Startseite\s*<\/a>/);
    assert.match(nav, /<a href="\/de\/leistungen" class="sk-breadcrumb__link"[^>]*>\s*Leistungen\s*<\/a>/);
    assert.doesNotMatch(await page("/de/leistungen"), /class="sk-breadcrumb"/, "a top-level translation has a breadcrumb");
  });
});

describe("a localized site's checks", () => {
  it("fail on a locale without its home page", () => expectFailure({ remove: ["src/content/pages/home.de.md"] }, "src/content/pages/home.de.md"));

  // "File without a locale".
  it("fail on a page without a locale in its name", () =>
    expectFailure(
      { files: { "src/content/pages/stray.md": "---\ntitle: Stray\n---\n" } },
      "src/content/pages/stray.md has no locale in its name. A content file's name ends in its locale code, such as src/content/pages/stray.en.md. The site's locales are en, de.",
    ));

  it("fail on an entry without a locale in its name", () =>
    expectFailure({ files: { "src/content/news/stray.md": '---\ntitle: Stray\ndate: "2026-01-01"\n---\n\nText.\n' } }, "src/content/news/stray.md has no locale in its name"));

  // "File in a locale the site doesn't have".
  it("fail on a file in a locale the site doesn't have, listing the site's", () =>
    expectFailure(
      { files: { "src/content/news/fresh-rye.fr.md": '---\ntitle: Seigle\ndate: "2026-01-01"\n---\n\nTexte.\n' } },
      `src/content/news/fresh-rye.fr.md is in the locale "fr", which isn't one of the site's locales in src/site.config.ts: en, de.`,
    ));

  // A locale's facts are in its settings, so its content fails on its first
  // fact, naming the file as the route table does.
  it("fail on a locale without its settings, as with 0.5's site.yml", () =>
    expectFailure(
      { remove: ["src/content/settings/site.de.yml"], files: { "src/content/settings/site.yml": "name: Old\n" } },
      "Missing src/content/settings/site.de.yml. Every locale has its settings",
    ));

  // site-kit-content-model, "Collection with its own loader".
  it("fail on a collection that sets its own loader", () =>
    expectFailure(
      { edit: { "src/site.schema.ts": (schema) => schema.replace("  news: {\n", '  news: {\n    loader: { name: "own", load: async () => {} },\n') } },
      'Collection "news" in src/site.schema.ts sets "loader". Declare it by its schema alone',
    ));

  it("fail on a local slug in the default locale", () =>
    expectFailure({ edit: { "src/content/pages/about.en.md": (text) => text.replace("title: About us", "title: About us\nlocalSlug: about-us") } }, "about.en.md", "the filename is the slug"));

  it("fail on a page whose path is a locale's prefix", () =>
    expectFailure({ files: { "src/content/pages/de.en.md": "---\ntitle: De\n---\n" } }, "Two sources produce the URL /de:", "src/content/pages/de.en.md"));

  // "Settings that still set the language".
  it("fail on settings that still set the language, naming the tag", () =>
    expectFailure(
      { edit: { "src/content/settings/site.de.yml": (text) => text.replace("nav:\n", "language: de-AT\nnav:\n") } },
      "site.de",
      `"language" isn't a setting: the locale's tag in src/site.config.ts sets it, here "de-DE"`,
    ));

  it("fail when a locale lacks an interface string", () =>
    expectFailure({ edit: { "src/content/settings/site.de.yml": (text) => text.replace(/  minRead:\n(    .*\n)+/, "") } }, 'missing "minRead"', "settings/site.de.yml"));

  it("fail when a locale doesn't name its switcher", () =>
    expectFailure({ edit: { "src/content/settings/site.de.yml": (text) => text.replace("  locales: Sprache\n", "") } }, 'src/content/settings/site.de.yml has no "locales" under "ui"'));

  it("warn, and build, without a switcher", async () => {
    const noSwitcher = (text) => text.replaceAll("    - type: locales\n", "");
    const build = await buildFixture("locales", { edit: { "src/content/settings/site.en.yml": noSwitcher, "src/content/settings/site.de.yml": noSwitcher } });
    try {
      assert.ok(build.ok, build.output);
      assert.match(build.output, /no "locales" header action or footer block in its settings, so visitors can't change the language/);
    } finally {
      await build.cleanup();
    }
  });

  it("fail when a locale lacks a fact the others define", () =>
    expectFailure(
      { edit: { "src/content/settings/site.en.yml": (text) => text.replace("facts:\n", "facts:\n  - name: license\n    value: BC555142\n") } },
      'The fact "license" is missing from src/content/settings/site.de.yml',
    ));
});

// site-kit-locales, "Single-locale sites render as before"; site-kit-content-model,
// "Local slug in a single-locale site".
describe("a single-locale site", () => {
  // site-kit-routing, "No alternates on a single-locale site".
  it("has no alternates, no og:locale, no dir and no sitemap alternates", async () => {
    const build = await buildFixture("base");
    try {
      assert.ok(build.ok, build.output);
      const html = await build.read("index.html");
      assert.doesNotMatch(html, /hreflang|og:locale|<html[^>]*dir=/);
      assert.doesNotMatch(await build.read("sitemap.xml"), /xhtml/);
    } finally {
      await build.cleanup();
    }
  });

  it("renders no switcher, and needs no switcher name", async () => {
    const build = await buildFixture("base", { edit: { "src/content/settings/site.en.yml": (text) => text.replace("  actions:\n", "  actions:\n    - type: locales\n") } });
    try {
      assert.ok(build.ok, build.output);
      assert.doesNotMatch(await build.read("index.html"), /sk-locales/);
    } finally {
      await build.cleanup();
    }
  });

  it("fails on a local slug, saying it's only for translations", async () => {
    const build = await buildFixture("base", { edit: { "src/content/pages/about.en.md": (text) => text.replace(/^title: (.*)$/m, "title: $1\nlocalSlug: about-us") } });
    try {
      assert.equal(build.ok, false, "the build should fail");
      assert.match(build.output, /about\.en/);
      assert.match(build.output, /"localSlug": a page sets its own URL segment only as a translation/);
    } finally {
      await build.cleanup();
    }
  });
});
