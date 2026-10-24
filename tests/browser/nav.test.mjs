// site-kit-interactive-parts, "Nested nav items" and "Interactive parts follow
// the keyboard patterns" (the submenu).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { focused, site } from "./helpers.mjs";

const ITEM = ".sk-nav__item";

describe("nested nav items", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("render a link and a submenu button, or a button with the label", async () => {
    const page = await browser.open("/");
    const [spaces, parts] = [page.locator(ITEM).first(), page.locator(ITEM).nth(1)];
    assert.equal(await spaces.locator(".sk-nav__link").getAttribute("href"), "/spaces");
    assert.equal(await spaces.locator(".sk-nav__toggle").getAttribute("aria-label"), "Spaces submenu");
    assert.equal((await parts.locator(".sk-nav__toggle").textContent()).trim(), "Parts");
    assert.equal(await parts.locator(".sk-nav__link").count(), 0);
    for (const item of [spaces, parts]) {
      assert.equal(await item.getAttribute("data-ready"), "");
      assert.equal(await item.locator(".sk-nav__toggle").getAttribute("aria-expanded"), "false");
      assert.equal(await item.locator(".sk-nav__submenu").isVisible(), false, "a closed submenu shows");
    }
  });

  it("open by keyboard, and close with Escape, focus back on the button", async () => {
    const page = await browser.open("/");
    const item = page.locator(ITEM).first();
    const button = item.locator(".sk-nav__toggle");
    await button.focus();
    await page.keyboard.press("Enter");
    assert.equal(await button.getAttribute("aria-expanded"), "true");
    assert.equal(await item.getAttribute("data-open"), "");
    assert.ok(await item.locator(".sk-nav__submenu").isVisible());
    await page.keyboard.press("Tab");
    assert.equal((await page.evaluate(() => document.activeElement.textContent)).trim(), "Desks");
    await page.keyboard.press("Escape");
    assert.equal(await button.getAttribute("aria-expanded"), "false");
    assert.equal(await item.locator(".sk-nav__submenu").isVisible(), false);
    assert.ok(await button.evaluate((element) => element === document.activeElement), "focus isn't on the button");
  });

  it("close on a click outside, and when focus leaves", async () => {
    const page = await browser.open("/");
    const item = page.locator(ITEM).nth(1);
    const button = item.locator(".sk-nav__toggle");
    await button.click();
    assert.equal(await button.getAttribute("aria-expanded"), "true");
    await page.locator("h1").click();
    assert.equal(await button.getAttribute("aria-expanded"), "false", "a click outside doesn't close it");

    await button.click();
    await item.locator(".sk-nav__sublink").last().focus();
    await page.keyboard.press("Tab");
    assert.equal(await button.getAttribute("aria-expanded"), "false", "focus leaving doesn't close it");
    assert.notEqual(await focused(page), "");
  });

  it("mark the current child and its parent's button", async () => {
    const page = await browser.open("/spaces/desks");
    const spaces = page.locator(ITEM).first();
    assert.equal(await spaces.locator('.sk-nav__sublink[href="/spaces/desks"]').getAttribute("aria-current"), "page");
    assert.equal(await spaces.locator('.sk-nav__sublink[href="/spaces/rooms"]').getAttribute("aria-current"), null);
    assert.equal(await spaces.locator(".sk-nav__toggle").getAttribute("data-current"), "");
    assert.equal(await page.locator(ITEM).nth(1).locator(".sk-nav__toggle").getAttribute("data-current"), null);
  });

  it("show the children as a list under their parent without scripts", async () => {
    const page = await browser.open("/", { javaScriptEnabled: false });
    const [spaces, parts] = [page.locator(ITEM).first(), page.locator(ITEM).nth(1)];
    assert.ok(await spaces.locator(".sk-nav__submenu").isVisible());
    assert.ok(await parts.locator(".sk-nav__submenu").isVisible());
    assert.equal(await spaces.locator(".sk-nav__toggle").isVisible(), false, "the linked item's button shows without scripts");
    assert.ok(await parts.locator(".sk-nav__toggle").isVisible(), "the item without a link loses its label");
    assert.equal(await spaces.getAttribute("data-ready"), null);
  });

  it("show the children as a nested list in the narrow menu", async () => {
    const page = await browser.open("/", { viewport: { width: 375, height: 800 } });
    await page.locator(".sk-header__menu-button").click();
    const item = page.locator(ITEM).first();
    assert.ok(await item.locator(".sk-nav__link").isVisible());
    await item.locator(".sk-nav__toggle").click();
    const submenu = item.locator(".sk-nav__submenu");
    assert.ok(await submenu.isVisible());
    // In the panel, the list sits under its parent, not over the page.
    assert.equal(await submenu.evaluate((element) => getComputedStyle(element).position), "static");
    // Escape in the submenu closes it, not the menu.
    await item.locator(".sk-nav__sublink").first().focus();
    await page.keyboard.press("Escape");
    assert.equal(await submenu.isVisible(), false);
    assert.equal(await page.locator(".sk-menu").getAttribute("data-open"), "");
  });
});
