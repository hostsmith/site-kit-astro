// site-kit-routing, "Base layout"; site-kit-sections, "Accessibility baseline".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, count, htmlFiles } from "./helpers.mjs";

const SETTINGS_FILE = "src/content/settings/site.en.yml";

// The settings text without a top-level key and its indented lines.
const withoutKey = (text, key) => text.replace(new RegExp(`^${key}:\\n(?:  .*\\n)+`, "m"), "");

describe("base layout", () => {
  let build;
  let home;
  before(async () => {
    build = await buildFixture("base");
    home = await build.read("index.html");
  });
  after(() => build.cleanup());

  it("sets lang from settings", () => assert.match(home, /<html lang="en">/));

  it("has the landmarks", () => {
    for (const tag of ["header", "main", "footer"]) assert.equal(count(home, new RegExp(`<${tag}\\b`, "g")), 1, `one <${tag}>`);
    assert.match(home, /<main id="main"/);
  });

  it("names every nav", () => {
    const navs = [...home.matchAll(/<nav\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(navs.length >= 4, "main nav, two titled footer links blocks and the untitled one");
    for (const nav of navs) assert.match(nav, /aria-label(ledby)?="[^"]+"/, `${nav} has no name`);
  });

  it("puts the skip link first", () => {
    assert.match(home, /<body[^>]*>\s*<a href="#main"[^>]*data-field="settings\/site\.en#ui\.skipLink"[^>]*>Skip to content<\/a>/);
  });

  it("renders the nav from settings in order", () => {
    const labels = [...home.matchAll(/data-field="settings\/site\.en#nav\[(\d)\]\.label"[^>]*>([^<]+)</g)].map((m) => [Number(m[1]), m[2]]);
    assert.deepEqual(labels, [
      [0, "Home"],
      [1, "About"],
      [2, "Plumbing"],
      [3, "News"],
    ]);
  });

  it("has a menu button, hidden until the script runs", () => {
    const button = home.slice(home.indexOf("<button"), home.indexOf("</button>"));
    assert.match(button, /^<button type="button" hidden aria-expanded="false" aria-controls="sk-menu" class="sk-header__menu-button">/);
    assert.match(button, /data-icon="menu"[\s\S]*data-icon="x"/, "a menu and a close icon");
    assert.match(button, /<span class="sk-header__menu-label" data-field="settings\/site\.en#ui\.menu">\s*Menu\s*<\/span>/);
    assert.match(home, /<div id="sk-menu" class="sk-menu">\s*<nav class="sk-nav" aria-label="Main">/, "the menu holds the nav, open without scripts");
  });

  it("renders the header actions in order, and the call button of the phone action", () => {
    assert.match(home, /<a href="tel:\+15550100" class="sk-header__call" aria-label="Call \+1 555 0100">\s*<svg class="sk-icon" data-icon="phone"[^>]*aria-hidden="true"/);
    const menu = home.slice(home.indexOf('id="sk-menu"'), home.indexOf("</header>"));
    const actions = [
      /<a href="tel:\+15550100" class="sk-header__phone" data-field="settings\/site\.en#header\.actions\[0\]\.number">\s*\+1 555 0100\s*<\/a>/,
      /<a href="\/about" class="sk-button sk-button--primary" data-field="settings\/site\.en#header\.actions\[1\]\.label">\s*Get an estimate\s*<\/a>/,
      /<a href="\/news" class="sk-header__link" data-field="settings\/site\.en#header\.actions\[2\]\.label">\s*Latest news\s*<\/a>/,
    ].map((pattern) => menu.search(pattern));
    assert.ok(actions.every((at) => at > menu.indexOf('<div class="sk-header__actions">')), `actions not all in the menu: ${actions}`);
    assert.deepEqual([...actions].sort((a, b) => a - b), actions, "the actions keep their order");
    assert.equal(count(menu, /class="sk-button/g), 1, "the button is rendered once in the menu");
  });

  // site-kit-webflow-migration design D137.
  it("renders the pinned button beside the menu button, and in the menu", () => {
    const bar = home.slice(home.indexOf("</a>", home.indexOf("sk-header__brand")), home.indexOf('id="sk-menu"'));
    assert.match(
      bar,
      /<a href="\/about" class="sk-header__pinned sk-button sk-button--primary" data-field="settings\/site\.en#header\.actions\[1\]\.label">\s*Get an estimate\s*<\/a>\s*<button type="button" hidden aria-expanded="false" aria-controls="sk-menu" class="sk-header__menu-button">/,
    );
    assert.ok(bar.indexOf("sk-header__call") < bar.indexOf("sk-header__pinned"), "after the call button");
  });

  it("renders no pinned copy without pinned", async () => {
    const plain = await buildFixture("base", { edit: { [SETTINGS_FILE]: (text) => text.replace("      pinned: true\n", "") } });
    try {
      assert.ok(plain.ok, plain.output);
      const header = (await plain.read("index.html")).split("</header>")[0];
      assert.ok(!header.includes("sk-header__pinned"), "a pinned copy without pinned");
      assert.equal(count(header, /class="sk-button/g), 1, "the button only in the menu");
    } finally {
      await plain.cleanup();
    }
  });

  it("fails the build with two pinned buttons", async () => {
    const twice = await buildFixture("base", {
      edit: { [SETTINGS_FILE]: (text) => text.replace("    - type: link\n", "    - type: button\n      label: Call us back\n      link: /about\n      pinned: true\n    - type: link\n") },
    });
    try {
      assert.ok(!twice.ok, "the build passed");
      assert.match(twice.output, /header action 3 \(button\): only one button action may set "pinned"/);
    } finally {
      await twice.cleanup();
    }
  });

  it("renders no call button for a phone action without callLabel", async () => {
    const plain = await buildFixture("base", { edit: { [SETTINGS_FILE]: (text) => text.replace("      callLabel: Call\n", "") } });
    try {
      assert.ok(plain.ok, plain.output);
      const header = (await plain.read("index.html")).split("</header>")[0];
      assert.ok(!header.includes("sk-header__call"), "a call button without callLabel");
      assert.match(header, /class="sk-header__phone"/);
    } finally {
      await plain.cleanup();
    }
  });

  it("renders no empty parts without actions or footer blocks", async () => {
    const bare = await buildFixture("base", {
      edit: { [SETTINGS_FILE]: (text) => withoutKey(withoutKey(text, "header"), "footer") + "footer:\n  bottom:\n    - type: copyright\n" },
    });
    const none = await buildFixture("base", { edit: { [SETTINGS_FILE]: (text) => withoutKey(text, "footer") } });
    try {
      assert.ok(bare.ok, bare.output);
      const html = await bare.read("index.html");
      const header = html.split("</header>")[0];
      for (const hook of ["sk-header__call", "sk-header__phone", "sk-header__actions", "sk-button"]) assert.ok(!header.includes(hook), `${hook} without actions`);
      assert.match(header, /class="sk-header__menu-button"/, "the nav still has its menu");
      const footer = html.slice(html.indexOf("<footer"));
      assert.ok(!footer.includes("sk-footer__group"), "a group without footer.blocks");
      assert.match(footer, /<p class="sk-footer__block sk-footer__block--copyright">\s*© \d{4} <span data-field="settings\/site\.en#name">Test Bakery<\/span>/, "the site name stands in for the copyright text");

      assert.ok(none.ok, none.output);
      assert.ok(!(await none.read("index.html")).includes("<footer"), "a footer without blocks");
    } finally {
      await bare.cleanup();
      await none.cleanup();
    }
  });

  it("marks the menu's state with attributes", () => {
    const script = home.slice(home.indexOf("<script>", home.indexOf('id="sk-menu"')));
    assert.match(script, /menu\.setAttribute\("data-ready", ""\)/);
    assert.match(script, /menu\.toggleAttribute\("data-open", open\)/);
    assert.match(script, /button\.setAttribute\("aria-expanded", String\(open\)\)/);
    assert.match(script, /event\.key === "Escape"[\s\S]*?button\.focus\(\)/);
  });

  it("renders the footer blocks in groups", () => {
    const footer = home.slice(home.indexOf("<footer"));
    const groups = footer.split('<div class="sk-footer__group">').slice(1);
    assert.equal(groups.length, 5, "brand with contact, two links blocks, hours and text");
    assert.match(groups[0], /sk-footer__block--brand[\s\S]*sk-footer__block--contact/, "withPrevious keeps the contact block with the brand");

    const at = (path) => `data-field="settings/site.en#footer.blocks${path}"`;
    assert.match(footer, new RegExp(`<p class="sk-footer__text" ${at("\\[0\\]\\.text")}>\\s*A test site\\.`));
    assert.match(footer, new RegExp(`<address class="sk-footer__contact">[\\s\\S]*${at("\\[1\\]\\.address")}[\\s\\S]*href="tel:\\+15550100"[^>]*${at("\\[1\\]\\.phone")}[\\s\\S]*href="mailto:test@example\\.com"[^>]*${at("\\[1\\]\\.email")}`));
    assert.match(footer, /<nav class="sk-footer__block sk-footer__block--links" aria-labelledby="sk-footer-block-2">\s*<h2 id="sk-footer-block-2" class="sk-footer__title" data-field="settings\/site\.en#footer\.blocks\[2\]\.title">\s*Services\s*<\/h2>/);
    assert.ok(footer.includes(at("[3].links[1].label")), "the second links block's links carry fields");
    assert.equal(count(footer, /<div class="sk-footer__hours-row">/g), 3);
    assert.match(footer, new RegExp(`<dt ${at("\\[4\\]\\.rows\\[2\\]\\.days")}>Sunday</dt>\\s*<dd ${at("\\[4\\]\\.rows\\[2\\]\\.time")}>Closed</dd>`));
    assert.match(footer, new RegExp(`<h2 id="sk-footer-block-5" class="sk-footer__title" ${at("\\[5\\]\\.title")}>\\s*Since 1998`));
  });

  // site-kit-content-model, "Settings file": the reversed logo in the footer.
  it("shows the brand block's own logo in the footer, and the settings' logo in the header", async () => {
    const reversed = await buildFixture("base", {
      edit: {
        [SETTINGS_FILE]: (text) =>
          `${text}logo:\n  image: /assets/test/photo.svg\n  alt: Test logo\n`.replace("    - type: brand\n", "    - type: brand\n      logo: /assets/test/share.svg\n      logoAlt: Test Bakery, reversed\n"),
      },
    });
    try {
      assert.ok(reversed.ok, reversed.output);
      const html = await reversed.read("index.html");
      assert.match(html.split("</header>")[0], /<img src="\/assets\/test\/photo\.svg" alt="Test logo" class="sk-header__logo"/);
      assert.match(
        html.slice(html.indexOf("<footer")),
        /<div class="sk-footer__block sk-footer__block--brand">\s*<img src="\/assets\/test\/share\.svg" alt="Test Bakery, reversed" class="sk-footer__logo" data-field="settings\/site\.en#footer\.blocks\[0\]\.logo">/,
      );
    } finally {
      await reversed.cleanup();
    }
  });

  it("fails on a brand block's logo without alt text", async () => {
    const bad = await buildFixture("base", { edit: { [SETTINGS_FILE]: (text) => text.replace("    - type: brand\n", "    - type: brand\n      logo: /assets/test/share.svg\n") } });
    try {
      assert.equal(bad.ok, false);
      assert.match(bad.output, /footer block 1 \(brand\): image "\/assets\/test\/share\.svg" has no alt text\. Set "logoAlt"\./);
    } finally {
      await bad.cleanup();
    }
  });

  it("renders the bottom row", () => {
    const bottom = home.slice(home.indexOf('<div class="sk-footer__bottom">'));
    assert.match(bottom, /<p class="sk-footer__block sk-footer__block--copyright">\s*© \d{4} <span data-field="settings\/site\.en#footer\.bottom\[0\]\.text">Test Bakery LLC · License 12345<\/span>/);
    assert.match(bottom, /<nav class="sk-footer__block sk-footer__block--links" aria-label="Footer">/, "an untitled links block is named by ui.footerNav");
    assert.match(bottom, /href="https:\/\/social\.example\.com\/test"[^>]*data-field="settings\/site\.en#footer\.bottom\[1\]\.links\[1\]\.label"/);
  });

  for (const [name, edit, message] of [
    ["an unknown block type", (text) => text.replace("    - type: text\n", "    - type: map\n"), /footer block 6: unknown type "map"\. Footer block types: brand, contact, links, hours, text, copyright, locales\./],
    ["two call buttons", (text) => text.replace("      link: /news\nfooter:", "      link: /news\n    - type: phone\n      number: \"+1 555 0199\"\n      callLabel: Call\nfooter:"), /header action 4 \(phone\): only one phone action may set "callLabel"/],
    ["two untitled footer navs", (text) => text.replace("      title: Services\n", ""), /footer bottom block 2 \(links\): a second "links" block without a title/],
    ["withPrevious in the bottom row", (text) => text.replace("    - type: copyright\n", "    - type: copyright\n      withPrevious: true\n"), /footer bottom block 1 \(copyright\): "withPrevious" groups footer\.blocks only/],
  ]) {
    it(`fails the build on ${name}`, async () => {
      const bad = await buildFixture("base", { edit: { [SETTINGS_FILE]: edit } });
      try {
        assert.equal(bad.ok, false, `built with ${name}`);
        assert.match(bad.output, message);
      } finally {
        await bad.cleanup();
      }
    });
  }

  it("has exactly one h1 on every page", async () => {
    for (const file of await htmlFiles(build.dist)) {
      assert.equal(count(await build.read(file), /<h1\b/g), 1, `${file} has no single h1`);
    }
  });

  it("gives a page without a hero a visually hidden h1", async () => {
    assert.match(
      await build.read("about/index.html"),
      /<h1 style="position:absolute;width:1px;height:1px;[^"]*clip:rect\(0 0 0 0\)[^"]*" data-field="pages\/about\.en#title">\s*About us \| Bakery\s*<\/h1>/,
    );
  });
});

describe("breadcrumb", () => {
  // The base fixture has /services/plumbing and /news with its entries; the
  // test adds a /services page as the plumbing page's parent.
  let build;
  before(async () => {
    build = await buildFixture("base", { files: { "src/content/pages/services.en.md": "---\ntitle: Services\nsections: []\n---\n" } });
  });
  after(() => build.cleanup());

  const crumbs = (html) => {
    const nav = html.match(/<nav class="sk-breadcrumb" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/);
    assert.ok(nav, "no breadcrumb");
    return [...nav[1].matchAll(/<(a|span) (?:href="([^"]*)" )?(?:aria-current="page" )?class="sk-breadcrumb__(link|current)" data-field="([^"]+)">\s*([^<]+?)\s*</g)].map((m) => [
      m[2] ?? null,
      m[4],
      m[5],
    ]);
  };

  it("leads a nested page through its parent page", async () => {
    assert.ok(build.ok, build.output);
    const html = await build.read("services/plumbing/index.html");
    assert.deepEqual(crumbs(html), [
      ["/", "settings/site.en#ui.home", "Home"],
      ["/services", "pages/services.en#title", "Services"],
      [null, "pages/services/plumbing.en#title", "Plumbing"],
    ]);
    assert.match(html, /<main id="main" tabindex="-1" class="sk-main">\s*<nav class="sk-breadcrumb"/, "first in main");
    assert.match(html, /<span aria-current="page" class="sk-breadcrumb__current"/);
  });

  it("leads a collection entry through its list page", async () => {
    assert.deepEqual(crumbs(await build.read("news/fresh-rye/index.html")), [
      ["/", "settings/site.en#ui.home", "Home"],
      ["/news", "pages/news.en#title", "News"],
      [null, "news/fresh-rye.en#title", "Fresh rye"],
    ]);
  });

  it("is absent on top-level pages", async () => {
    for (const file of ["index.html", "about/index.html", "news/index.html", "404.html"]) {
      assert.ok(!(await build.read(file)).includes("sk-breadcrumb"), `${file} has a breadcrumb`);
    }
  });
});

// site-kit-routing, "Base layout": the switches in the site config
// (site-kit-webflow-migration design D132).
describe("breadcrumb switches", () => {
  const SITE_CONFIG = "src/site.config.ts";
  const has = async (build, file) => (await build.read(file)).includes('class="sk-breadcrumb"');

  it("turns off for one collection, and stays on elsewhere", async () => {
    const build = await buildFixture("base", { edit: { [SITE_CONFIG]: (text) => text.replace('news: { basePath: "/news" }', 'news: { basePath: "/news", breadcrumb: false }') } });
    try {
      assert.ok(build.ok, build.output);
      assert.equal(await has(build, "news/fresh-rye/index.html"), false, "a news entry has a breadcrumb");
      assert.equal(await has(build, "services/plumbing/index.html"), true, "the nested page lost its breadcrumb");
    } finally {
      await build.cleanup();
    }
  });

  it("turns off for the site, with a collection's own switch winning", async () => {
    const build = await buildFixture("base", {
      edit: {
        [SITE_CONFIG]: (text) => text.replace("  locales:", "  breadcrumb: false,\n  locales:").replace('news: { basePath: "/news" }', 'news: { basePath: "/news", breadcrumb: true }'),
      },
    });
    try {
      assert.ok(build.ok, build.output);
      assert.equal(await has(build, "services/plumbing/index.html"), false, "the nested page has a breadcrumb");
      assert.equal(await has(build, "news/fresh-rye/index.html"), true, "the news entry lost its breadcrumb");
    } finally {
      await build.cleanup();
    }
  });
});

describe("interface strings follow the site language", () => {
  it("shows the Estonian strings", async () => {
    const build = await buildFixture("base", {
      edit: {
        // The locale's tag sets the language (site-kit-locales design D54).
        "src/site.config.ts": (text) => text.replace('{ code: "en" }', '{ code: "en", tag: "et" }'),
        [SETTINGS_FILE]: (text) =>
          text
            .replace("skipLink: Skip to content", "skipLink: Liigu sisu juurde")
            .replace("menu: Menu", "menu: Menüü")
            .replace("readMore: Read more", "readMore: Loe edasi"),
      },
    });
    try {
      assert.ok(build.ok, build.output);
      const home = await build.read("index.html");
      assert.match(home, /<html lang="et">/);
      for (const text of ["Liigu sisu juurde", "Menüü", "Loe edasi"]) assert.ok(home.includes(text), `missing ${text}`);
    } finally {
      await build.cleanup();
    }
  });
});
