// site-kit-interactive-parts, "Reveal animations"; site-kit-themes, "Theme
// accessibility duties" (reveal under reduced motion).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const opacity = (locator) => locator.evaluate((element) => Number(getComputedStyle(element).opacity));
// A short window, so the last section starts below the fold.
const SHORT = { width: 1280, height: 500 };

describe("reveal", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("marks each section's root with its preset", async () => {
    const page = await browser.open("/reveal");
    assert.deepEqual(await page.locator("[data-reveal]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-reveal"))), ["fade", "fade-up", "scale"]);
  });

  it("shows every section at once without scripts", async () => {
    const page = await browser.open("/reveal", { javaScriptEnabled: false, viewport: SHORT });
    assert.equal(await page.locator("html").getAttribute("data-sk-ready"), null);
    for (const section of await page.locator("[data-reveal]").all()) assert.equal(await opacity(section), 1);
  });

  it("reveals a section as it scrolls into view", async () => {
    const page = await browser.open("/reveal", { viewport: SHORT });
    assert.equal(await page.locator("html").getAttribute("data-sk-ready"), "");
    const last = page.locator("[data-reveal]").last();
    assert.equal(await last.getAttribute("data-revealed"), null);
    assert.equal(await opacity(last), 0, "a section below the fold shows before it's in view");
    await last.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll("[data-reveal]")[2].hasAttribute("data-revealed"));
    await page.waitForFunction(() => getComputedStyle(document.querySelectorAll("[data-reveal]")[2]).opacity === "1");
  });

  it("hides nothing under reduced motion", async () => {
    const page = await browser.open("/reveal", { reducedMotion: "reduce", viewport: SHORT });
    assert.equal(await page.locator("html").getAttribute("data-sk-ready"), "");
    for (const section of await page.locator("[data-reveal]").all()) assert.equal(await opacity(section), 1);
  });

  it("isn't on a page without reveal", async () => {
    const page = await browser.open("/tabs");
    assert.equal(await page.locator("html").getAttribute("data-sk-ready"), null);
    assert.ok(!(await page.content()).includes("data-sk-ready"), "the reveal script is on a page without reveal");
  });
});
