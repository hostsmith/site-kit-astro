// site-kit-routing, "Base layout"; site-kit-sections, "Accessibility baseline".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, count, htmlFiles } from "./helpers.mjs";

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
    for (const tag of ["header", "nav", "main", "footer"]) assert.equal(count(home, new RegExp(`<${tag}\\b`, "g")), 1, `one <${tag}>`);
    assert.match(home, /<main id="main"/);
  });

  it("puts the skip link first", () => {
    assert.match(home, /<body[^>]*>\s*<a href="#main"[^>]*data-field="settings\/site#ui\.skipLink"[^>]*>Skip to content<\/a>/);
  });

  it("renders the nav from settings in order", () => {
    const labels = [...home.matchAll(/data-field="settings\/site#nav\[(\d)\]\.label"[^>]*>([^<]+)</g)].map((m) => [Number(m[1]), m[2]]);
    assert.deepEqual(labels, [
      [0, "Home"],
      [1, "About"],
      [2, "Plumbing"],
      [3, "News"],
    ]);
  });

  it("has a menu button for small screens", () => {
    assert.match(home, /<button[^>]*aria-controls="site-nav"[^>]*data-field="settings\/site#ui\.menu"[^>]*>Menu<\/button>/);
  });

  it("renders the footer from settings", () => {
    for (const path of ["footer.text", "footer.links[0].label", "contact.email", "contact.phone", "contact.address", "social[0].label", "name"]) {
      assert.ok(home.includes(`data-field="settings/site#${path}"`), `footer misses ${path}`);
    }
  });

  it("has exactly one h1 on every page", async () => {
    for (const file of await htmlFiles(build.dist)) {
      assert.equal(count(await build.read(file), /<h1\b/g), 1, `${file} has no single h1`);
    }
  });

  it("gives a page without a hero a visually hidden h1", async () => {
    assert.match(await build.read("about/index.html"), /<h1 class="sr-only" data-field="pages\/about#title">About us \| Bakery<\/h1>/);
  });
});

describe("interface strings follow the site language", () => {
  it("shows the Estonian strings", async () => {
    const build = await buildFixture("base", {
      edit: {
        "src/content/settings/site.yml": (text) =>
          text
            .replace("language: en", "language: et")
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
