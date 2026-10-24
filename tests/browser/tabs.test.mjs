// site-kit-section-library, "`tabs` section"; site-kit-interactive-parts,
// "Interactive parts work without scripts" and "Interactive parts follow the
// keyboard patterns".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { focused, site } from "./helpers.mjs";

const TABS = '[data-section="tabs"]';

describe("tabs", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("show every panel under its label without scripts", async () => {
    const page = await browser.open("/tabs", { javaScriptEnabled: false });
    const tabs = page.locator(TABS).first();
    assert.equal(await tabs.getAttribute("data-ready"), null);
    assert.equal(await tabs.locator(".sk-tabs__list").isVisible(), false, "the tab list shows without scripts");
    const panels = tabs.locator(".sk-tabs__panel");
    assert.equal(await panels.count(), 3);
    for (const [i, label] of ["Ground floor", "Main floor", "Mezzanine"].entries()) {
      assert.ok(await panels.nth(i).isVisible(), `panel ${i + 1} is hidden`);
      assert.equal((await panels.nth(i).locator(".sk-tabs__label").textContent()).trim(), label);
    }
  });

  it("follow the tabs pattern: arrow keys, Home and End, one panel at a time", async () => {
    const page = await browser.open("/tabs");
    const tabs = page.locator(TABS).first();
    const tab = (i) => tabs.locator('[role="tab"]').nth(i);
    const panel = (i) => tabs.locator(".sk-tabs__panel").nth(i);
    assert.equal(await tabs.getAttribute("data-ready"), "");
    assert.equal(await tabs.locator('[role="tablist"]').isVisible(), true);
    assert.equal(await tab(0).getAttribute("aria-selected"), "true");
    assert.equal(await panel(0).getAttribute("role"), "tabpanel");
    assert.equal(await panel(0).getAttribute("aria-labelledby"), "t1b1-tab-0");
    assert.equal(await panel(0).locator(".sk-tabs__label").isVisible(), false, "the theme hides a panel's own label");

    await tab(0).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await focused(page), "t1b1-tab-1");
    assert.equal(await tab(1).getAttribute("aria-selected"), "true");
    assert.equal(await tab(0).getAttribute("aria-selected"), "false");
    assert.ok(await panel(1).isVisible());
    assert.equal(await panel(0).isVisible(), false);
    assert.equal(await panel(2).isVisible(), false);

    await page.keyboard.press("End");
    assert.equal(await focused(page), "t1b1-tab-2");
    assert.ok(await panel(2).isVisible());
    await page.keyboard.press("ArrowRight");
    assert.equal(await focused(page), "t1b1-tab-0", "the right arrow wraps to the first tab");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await focused(page), "t1b1-tab-2", "the left arrow wraps to the last tab");
    await page.keyboard.press("Home");
    assert.equal(await focused(page), "t1b1-tab-0");
    assert.equal(await tab(0).getAttribute("tabindex"), "0");
    assert.equal(await tab(1).getAttribute("tabindex"), "-1", "only the selected tab is in the tab order");

    await tab(2).click();
    assert.equal(await tab(2).getAttribute("aria-selected"), "true");
    assert.ok(await panel(2).isVisible());
  });

  it("move with the up and down arrows in the vertical variant", async () => {
    const page = await browser.open("/tabs");
    const vertical = page.locator(TABS).nth(1);
    await vertical.locator('[role="tab"]').first().focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await focused(page), "t2b2-tab-1");
    assert.equal(await vertical.locator('[role="tablist"]').getAttribute("aria-orientation"), "vertical");
  });

  it("ship no tabs script on a page without tabs", async () => {
    const tabsPage = await (await browser.open("/tabs")).content();
    const other = await (await browser.open("/slider")).content();
    assert.ok(tabsPage.includes('.sk-tabs:not([data-ready])'), "the tabs page has no tabs script");
    assert.ok(!other.includes('.sk-tabs:not([data-ready])'), "a page without tabs has the tabs script");
  });
});
