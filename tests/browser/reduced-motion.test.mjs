// site-kit-interactive-parts, "The site's reduced motion setting" and
// "Rotation and playback stop under reduced motion" (site-kit-motion design
// D164): a site with `reducedMotion: "ignore"` plays its motion for a visitor
// who asks for reduced motion, keeps its buttons, and hides nothing without
// scripts. The same parts on a site that respects the setting are in
// reveal.test.mjs, slider.test.mjs and video.test.mjs.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const opacity = (locator) => locator.evaluate((element) => Number(getComputedStyle(element).opacity));
const SHORT = { width: 1280, height: 500 };
const REDUCE = { reducedMotion: "reduce" };
const SLIDER = '[data-section="slider"]';
const HERO = '[data-section="hero"] .sk-video';
const status = async (page) => (await page.locator(`${SLIDER} .sk-slider__status`).textContent()).trim();

describe("a site that ignores reduced motion", () => {
  let browser;
  before(async () => {
    browser = await site({ edit: { "src/site.config.ts": (text) => text.replace("  collections: {", '  reducedMotion: "ignore",\n  collections: {') } });
  });
  after(() => browser.close());

  it("marks <html> before the page renders, and only with scripts", async () => {
    assert.equal(await (await browser.open("/reveal", REDUCE)).locator("html").getAttribute("data-sk-motion"), "always");
    assert.equal(await (await browser.open("/video", REDUCE)).locator("html").getAttribute("data-sk-motion"), "always", "a page without reveals");
    assert.equal(await (await browser.open("/reveal", { ...REDUCE, javaScriptEnabled: false })).locator("html").getAttribute("data-sk-motion"), null);
  });

  it("reveals a section as it scrolls into view, under reduced motion", async () => {
    const page = await browser.open("/reveal", { ...REDUCE, viewport: SHORT });
    const last = page.locator("[data-reveal]").last();
    assert.equal(await opacity(last), 0, "a section below the fold shows before it's in view");
    await last.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll("[data-reveal]")[2].hasAttribute("data-revealed"));
    const halfway = await page.evaluate(() => document.querySelectorAll("[data-reveal]")[2].getAnimations().length);
    assert.ok(halfway > 0, "the section didn't move: the reduced motion reset still holds");
    await page.waitForFunction(() => getComputedStyle(document.querySelectorAll("[data-reveal]")[2]).opacity === "1");
  });

  it("shows every section at once without scripts", async () => {
    const page = await browser.open("/reveal", { ...REDUCE, javaScriptEnabled: false, viewport: SHORT });
    for (const section of await page.locator("[data-reveal]").all()) assert.equal(await opacity(section), 1);
  });

  it("rotates a slider with autoplay under reduced motion, and keeps its pause button", async () => {
    const page = await browser.open("/slider-autoplay", { ...REDUCE, before: (p) => p.clock.install() });
    const slider = page.locator(SLIDER);
    const pause = slider.locator(".sk-slider__pause");
    assert.equal(await slider.getAttribute("data-playing"), "");
    await page.clock.runFor(5_100);
    assert.equal(await status(page), "Slide 2 of 3", "it didn't rotate");
    await pause.click();
    await page.mouse.move(0, 0);
    assert.equal(await slider.getAttribute("data-playing"), null);
    await page.clock.runFor(20_000);
    assert.equal(await status(page), "Slide 2 of 3", "it rotated after the pause button");
  });

  it("starts a background video under reduced motion, and keeps its button", async () => {
    const page = await browser.open("/video", REDUCE);
    const hero = page.locator(HERO);
    await page.waitForFunction((selector) => document.querySelector(selector).hasAttribute("data-playing"), HERO);
    const button = hero.locator(".sk-video__button");
    assert.equal(await button.getAttribute("aria-label"), "Pause the video");
    await button.click();
    await page.waitForFunction((selector) => !document.querySelector(selector).hasAttribute("data-playing"), HERO);
  });
});

describe("a site without the setting", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("leaves <html> unmarked", async () => {
    assert.equal(await (await browser.open("/reveal", REDUCE)).locator("html").getAttribute("data-sk-motion"), null);
  });
});
