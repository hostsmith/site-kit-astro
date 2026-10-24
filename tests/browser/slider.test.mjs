// site-kit-section-library, "`slider` section"; site-kit-interactive-parts,
// "Rotation and playback stop under reduced motion". Rotation is timed with
// Playwright's clock, so no test waits five seconds.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const SLIDER = '[data-section="slider"]';
const clock = (page) => page.clock.install();
const status = async (page) => (await page.locator(`${SLIDER} .sk-slider__status`).textContent()).trim();

describe("slider", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("has previous and next buttons and a status, and doesn't rotate without autoplay", async () => {
    const page = await browser.open("/slider", { before: clock });
    const slider = page.locator(SLIDER);
    assert.equal(await slider.getAttribute("data-ready"), "");
    assert.equal(await status(page), "Slide 1 of 4");
    assert.equal(await slider.locator(".sk-slider__pause").count(), 0, "a pause button without autoplay");
    assert.equal(await slider.locator(".sk-slider__previous").getAttribute("aria-label"), "Previous slide");
    assert.equal(await slider.locator(".sk-slider__next").getAttribute("aria-label"), "Next slide");
    assert.equal(await slider.locator(".sk-slider__slide").first().getAttribute("aria-label"), "Slide 1 of 4");

    await page.clock.runFor(30_000);
    assert.equal(await status(page), "Slide 1 of 4", "it rotated without autoplay");
    assert.equal(await slider.getAttribute("data-playing"), null);

    await slider.locator(".sk-slider__next").click();
    assert.equal(await status(page), "Slide 2 of 4");
    await slider.locator(".sk-slider__previous").click();
    await slider.locator(".sk-slider__previous").click();
    assert.equal(await status(page), "Slide 4 of 4", "previous wraps to the last slide");
  });

  it("reaches every slide by scrolling without scripts", async () => {
    const page = await browser.open("/slider", { javaScriptEnabled: false });
    const slider = page.locator(SLIDER);
    assert.equal(await slider.locator(".sk-slider__controls").isVisible(), false, "the controls show without scripts");
    const list = slider.locator(".sk-slider__list");
    assert.equal(await list.evaluate((element) => getComputedStyle(element).overflowX), "auto");
    const slides = slider.locator(".sk-slider__slide");
    assert.equal(await slides.count(), 4);
    for (let i = 0; i < 4; i++) {
      await slides.nth(i).scrollIntoViewIfNeeded();
      assert.ok(await slides.nth(i).isVisible(), `slide ${i + 1} can't be reached`);
    }
    // The third slide's link is reachable by keyboard.
    await page.locator(`${SLIDER} .sk-slider__link`).focus();
    assert.ok(await page.locator(`${SLIDER} .sk-slider__link`).isVisible());
  });

  it("rotates with autoplay, and pauses on hover, on focus and with its button", async () => {
    const page = await browser.open("/slider-autoplay", { before: clock });
    const slider = page.locator(SLIDER);
    const pause = slider.locator(".sk-slider__pause");
    assert.equal(await slider.getAttribute("data-playing"), "");
    assert.equal(await pause.getAttribute("aria-label"), "Stop the slides");
    assert.equal(await status(page), "Slide 1 of 3");
    await page.clock.runFor(5_100);
    assert.equal(await status(page), "Slide 2 of 3", "it didn't rotate");

    // Hover pauses it, and leaving resumes it.
    await slider.hover();
    await page.clock.runFor(12_000);
    assert.equal(await status(page), "Slide 2 of 3", "it rotated while hovered");
    await page.mouse.move(0, 0);
    await page.clock.runFor(5_100);
    assert.equal(await status(page), "Slide 3 of 3", "it didn't resume after the hover");

    // Focus in the slider, other than on the pause button, pauses it too.
    await slider.locator(".sk-slider__link").focus();
    await page.clock.runFor(12_000);
    assert.equal(await status(page), "Slide 3 of 3", "it rotated while focused");
    await page.locator("h1").focus();
    await page.evaluate(() => document.activeElement?.blur());

    // The pause button stops it, and names the play string.
    await pause.focus();
    await page.keyboard.press("Enter");
    assert.equal(await slider.getAttribute("data-playing"), null);
    assert.equal(await pause.getAttribute("aria-label"), "Play the slides");
    const stopped = await status(page);
    await page.clock.runFor(20_000);
    assert.equal(await status(page), stopped, "it rotated after the pause button");
  });

  it("never rotates by itself under reduced motion, but plays with its button", async () => {
    const page = await browser.open("/slider-autoplay", { before: clock, reducedMotion: "reduce" });
    const slider = page.locator(SLIDER);
    const pause = slider.locator(".sk-slider__pause");
    assert.equal(await slider.getAttribute("data-playing"), null);
    assert.equal(await pause.getAttribute("aria-label"), "Play the slides");
    await page.clock.runFor(20_000);
    assert.equal(await status(page), "Slide 1 of 3", "it rotated under reduced motion");
    await pause.click();
    await page.mouse.move(0, 0);
    assert.equal(await slider.getAttribute("data-playing"), "");
    await page.clock.runFor(5_100);
    assert.equal(await status(page), "Slide 2 of 3", "the play button didn't start it");
  });
});
