// The interactive parts on the built `webflow` example itself, with its
// content and theme (site-kit-webflow-example design D104): keyboard paths,
// every page without scripts, reduced motion, and the embeds' network log.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const PAGES = ["/", "/heroes", "/text", "/media", "/cards", "/interactive", "/interactive/embeds", "/interactive/reveal", "/news", "/news/collection-entry", "/contact"];
const PROVIDERS = ["openstreetmap.org", "youtube.com", "youtube-nocookie.com", "ytimg.com", "vimeo.com", "vimeocdn.com", "example.com"];

describe("the webflow example in a browser", () => {
  let browser;
  before(async () => {
    browser = await site({ fixture: null, example: "webflow" });
  });
  after(() => browser.close());

  it("shows all of every page's content without scripts", async () => {
    for (const path of PAGES) {
      const page = await browser.open(path, { javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
      for (const selector of ["[data-section]", ".sk-tabs__panel", ".sk-slider__slide", ".sk-nav__submenu", ".sk-nav__link", ".sk-faq__item"]) {
        for (const element of await page.locator(selector).all()) {
          await element.scrollIntoViewIfNeeded();
          assert.ok(await element.isVisible(), `${path}: a ${selector} is hidden without scripts`);
        }
      }
      for (const element of await page.locator("[data-reveal]").all()) {
        assert.equal(await element.evaluate((node) => getComputedStyle(node).opacity), "1", `${path}: a reveal section is hidden without scripts`);
      }
    }
  });

  it("works by keyboard: the submenu, the tabs, the slider and the lightbox", async () => {
    const home = await browser.open("/");
    const toggle = home.locator(".sk-nav__item").first().locator(".sk-nav__toggle");
    await toggle.focus();
    await home.keyboard.press("Enter");
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await home.keyboard.press("Escape");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");

    const interactive = await browser.open("/interactive");
    const tabs = interactive.locator('[data-section="tabs"]').first();
    await tabs.locator('[role="tab"]').first().focus();
    await interactive.keyboard.press("ArrowRight");
    assert.equal(await tabs.locator('[role="tab"]').nth(1).getAttribute("aria-selected"), "true");
    const slider = interactive.locator('[data-section="slider"]').first();
    await slider.locator(".sk-slider__next").focus();
    await interactive.keyboard.press("Enter");
    assert.equal((await slider.locator(".sk-slider__status").textContent()).trim(), "Slide 2 of 4");

    const media = await browser.open("/media");
    const link = media.locator(".sk-gallery__link").first();
    await link.focus();
    await media.keyboard.press("Enter");
    assert.ok(await media.locator(".sk-lightbox").isVisible());
    await media.keyboard.press("Escape");
    await media.waitForFunction(() => !document.querySelector(".sk-lightbox").hasAttribute("data-open"));
    assert.ok(await link.evaluate((element) => element === document.activeElement));
  });

  it("moves nothing by itself under reduced motion", async () => {
    const interactive = await browser.open("/interactive", { reducedMotion: "reduce", before: (page) => page.clock.install() });
    const rotating = interactive.locator('[data-section="slider"]').nth(1);
    await interactive.clock.runFor(20_000);
    assert.equal(await rotating.getAttribute("data-playing"), null);
    assert.equal((await rotating.locator(".sk-slider__status").textContent()).trim(), "Slide 1 of 5");

    const heroes = await browser.open("/heroes", { reducedMotion: "reduce" });
    await heroes.waitForTimeout(300);
    assert.ok(await heroes.locator(".sk-video video").evaluate((element) => element.paused), "the hero's video started");

    const reveal = await browser.open("/interactive/reveal", { reducedMotion: "reduce" });
    for (const element of await reveal.locator("[data-reveal]").all()) {
      assert.equal(await element.evaluate((node) => getComputedStyle(node).opacity), "1");
    }
  });

  // site-kit-themes, "Shared token roles": Webflow's breakpoints, and token
  // values per breakpoint.
  it("collapses the header below lg, applies md layouts from 768 px, and shrinks the text roles", async () => {
    const wide = await browser.open("/cards", { viewport: { width: 1280, height: 800 } });
    const fontSize = (page) => page.locator("h1").evaluate((element) => getComputedStyle(element).fontSize);
    const columns = (page) => page.locator(".sk-services-grid__list").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    assert.equal(await fontSize(wide), "56px", "the h1 role is 3.5rem from lg");
    assert.equal(await wide.locator(".sk-header__menu-button").isVisible(), false);

    const tablet = await browser.open("/cards", { viewport: { width: 900, height: 800 } });
    assert.equal(await fontSize(tablet), "48px", "the h1 role is 3rem below lg");
    assert.ok(await tablet.locator(".sk-header__menu-button").isVisible(), "the header isn't collapsed at 900 px");
    assert.equal(await columns(tablet), 2, "md layouts don't apply at 900 px");

    const phone = await browser.open("/cards", { viewport: { width: 375, height: 800 } });
    assert.equal(await fontSize(phone), "40px", "the h1 role is 2.5rem below md");
    assert.equal(await columns(phone), 1);
  });

  it("requests nothing from an embed's provider before a click", async () => {
    for (const path of ["/interactive/embeds", "/news/collection-entry"]) {
      const page = await browser.open(path);
      await page.waitForLoadState("networkidle");
      const provided = page.requests.filter((url) => PROVIDERS.some((host) => new URL(url).hostname.endsWith(host)));
      assert.deepEqual(provided, [], `${path} requested a provider before a click`);
    }
  });

  it("loads nothing from another host on any page", async () => {
    for (const path of PAGES) {
      const page = await browser.open(path);
      await page.waitForLoadState("networkidle");
      assert.deepEqual(page.requests, [], `${path} loaded something from another host`);
    }
  });
});
