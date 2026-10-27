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

  // site-kit-webflow-migration design D143: revealItems.
  it("gives the items that come into view together their place in their row", async () => {
    // Tall enough for the whole team at once, so both rows come in together.
    const page = await browser.open("/reveal-items", { viewport: { width: 1280, height: 2000 } });
    await page.waitForFunction(() => [...document.querySelectorAll(".sk-team__member")].every((item) => item.hasAttribute("data-revealed")));
    const items = await page.locator(".sk-team__member").evaluateAll((elements) =>
      elements.map((element) => ({ top: Math.round(element.getBoundingClientRect().top), order: element.style.getPropertyValue("--sk-reveal-order"), delay: getComputedStyle(element).transitionDelay })),
    );
    assert.ok(new Set(items.map((item) => item.top)).size > 1, "the team fits in one row, so no row starts again");
    const places = items.map((item, i) => String(items.slice(0, i).filter((before) => before.top === item.top).length));
    assert.deepEqual(
      items.map((item) => item.order),
      places,
    );
    const third = items.findIndex((item) => item.order === "2");
    assert.ok(third > 0 && items[third].delay.startsWith("0.4s"), `the third of a row waits ${items[third]?.delay}`);
  });

  it("shows a list's items at once without scripts, and under reduced motion", async () => {
    for (const options of [{ javaScriptEnabled: false }, { reducedMotion: "reduce" }]) {
      const page = await browser.open("/reveal-items", { ...options, viewport: SHORT });
      for (const item of await page.locator(".sk-team__member").all()) assert.equal(await opacity(item), 1, JSON.stringify(options));
    }
  });

  it("isn't on a page without reveal", async () => {
    const page = await browser.open("/tabs");
    assert.equal(await page.locator("html").getAttribute("data-sk-ready"), null);
    assert.ok(!(await page.content()).includes("data-sk-ready"), "the reveal script is on a page without reveal");
  });
});
