// site-kit-section-library, "`hero` section" and "`split` section" (video);
// site-kit-interactive-parts, "Rotation and playback stop under reduced motion".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const HERO = '[data-section="hero"] .sk-video';
const SPLIT = '[data-section="split"] .sk-video';

describe("video", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("has no autoplay attribute, and a poster", async () => {
    const page = await browser.open("/video", { javaScriptEnabled: false });
    const html = await page.content();
    assert.doesNotMatch(html, /<video[^>]*\sautoplay/);
    for (const video of [HERO, SPLIT]) {
      const media = page.locator(`${video} video`);
      assert.equal(await media.getAttribute("poster"), "/assets/test/photo.svg");
      assert.equal(await page.locator(`${video} .sk-video__button`).isVisible(), false, "the button shows without scripts");
      assert.ok(await media.evaluate((element) => element.paused), "a video plays without scripts");
    }
    assert.equal(await page.locator(`${HERO} video`).getAttribute("aria-hidden"), "true", "the background video is decorative");
    assert.equal(await page.locator(`${SPLIT} video`).getAttribute("aria-label"), "Gray light moving across a wall");
  });

  it("plays without reduced motion, and its button pauses it", async () => {
    const page = await browser.open("/video");
    const hero = page.locator(HERO);
    await page.waitForFunction((selector) => document.querySelector(selector).hasAttribute("data-playing"), HERO);
    const button = hero.locator(".sk-video__button");
    assert.equal(await button.getAttribute("aria-label"), "Pause the video");
    await button.click();
    await page.waitForFunction((selector) => !document.querySelector(selector).hasAttribute("data-playing"), HERO);
    assert.ok(await hero.locator("video").evaluate((element) => element.paused));
    assert.equal(await button.getAttribute("aria-label"), "Play the video");
  });

  it("doesn't start under reduced motion, but plays with its button", async () => {
    const page = await browser.open("/video", { reducedMotion: "reduce" });
    const hero = page.locator(HERO);
    assert.equal(await hero.getAttribute("data-ready"), "");
    // Give a wrongly started video the time to start.
    await page.waitForTimeout(500);
    assert.equal(await hero.getAttribute("data-playing"), null);
    assert.ok(await hero.locator("video").evaluate((element) => element.paused), "the video started by itself");
    const button = hero.locator(".sk-video__button");
    assert.equal(await button.getAttribute("aria-label"), "Play the video");
    await button.click();
    await page.waitForFunction((selector) => document.querySelector(selector).hasAttribute("data-playing"), HERO);
    assert.equal(await button.getAttribute("aria-label"), "Pause the video");
  });
});
