// site-kit-section-library, "`gallery` section"; site-kit-interactive-parts,
// "Interactive parts follow the keyboard patterns" (the lightbox).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const GALLERY = '[data-section="gallery"]';

describe("gallery lightbox", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("opens an image in a modal dialog, with previous, next and close", async () => {
    const page = await browser.open("/gallery");
    const gallery = page.locator(GALLERY);
    const dialog = gallery.locator(".sk-lightbox");
    assert.equal(await gallery.getAttribute("data-ready"), "");
    assert.equal(await dialog.isVisible(), false);

    await gallery.locator(".sk-gallery__link").nth(2).click();
    assert.ok(await dialog.isVisible());
    assert.equal(await dialog.getAttribute("data-open"), "");
    assert.ok(await page.evaluate(() => document.querySelector(".sk-lightbox").matches(":modal")), "the dialog isn't modal");
    assert.equal(await dialog.locator(".sk-lightbox__image").getAttribute("alt"), "The third photo");
    assert.equal((await dialog.locator(".sk-lightbox__caption").textContent()).trim(), "The third caption");
    assert.equal(await dialog.getAttribute("aria-label"), "The third photo");

    await dialog.locator(".sk-lightbox__next").click();
    assert.equal(await dialog.locator(".sk-lightbox__image").getAttribute("alt"), "The fourth photo");
    assert.equal(await dialog.locator(".sk-lightbox__caption").isVisible(), false, "an image without a caption shows an empty one");
    await dialog.locator(".sk-lightbox__next").click();
    assert.equal(await dialog.locator(".sk-lightbox__image").getAttribute("alt"), "The first photo", "next wraps to the first image");
    await dialog.locator(".sk-lightbox__previous").click();
    assert.equal(await dialog.locator(".sk-lightbox__image").getAttribute("alt"), "The fourth photo");

    await dialog.locator(".sk-lightbox__close").click();
    assert.equal(await dialog.isVisible(), false);
    await page.waitForFunction(() => !document.querySelector(".sk-lightbox").hasAttribute("data-open"));
  });

  it("opens by keyboard, and Escape returns focus to the image", async () => {
    const page = await browser.open("/gallery");
    const link = page.locator(`${GALLERY} .sk-gallery__link`).nth(1);
    await link.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator(`${GALLERY} .sk-lightbox`);
    assert.ok(await dialog.isVisible(), "Enter doesn't open the dialog");
    assert.equal(await dialog.locator(".sk-lightbox__image").getAttribute("alt"), "The second photo");
    assert.ok(await page.evaluate(() => document.querySelector(".sk-lightbox").contains(document.activeElement)), "focus isn't in the dialog");
    await page.keyboard.press("ArrowRight");
    assert.equal(await dialog.locator(".sk-lightbox__image").getAttribute("alt"), "The third photo");
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), false);
    // The dialog's close event, a task after Escape, returns focus.
    await page.waitForFunction(() => !document.querySelector(".sk-lightbox").hasAttribute("data-open"));
    assert.ok(await link.evaluate((element) => element === document.activeElement), "focus isn't back on the image's link");
  });

  it("links each image to its file without scripts", async () => {
    const page = await browser.open("/gallery", { javaScriptEnabled: false });
    const links = page.locator(`${GALLERY} .sk-gallery__link`);
    assert.equal(await links.count(), 4);
    assert.equal(await links.first().getAttribute("href"), "/assets/test/photo.svg");
    assert.equal(await page.locator(`${GALLERY} .sk-lightbox`).isVisible(), false);
  });

  it("has no links, dialog or script without lightbox", async () => {
    const page = await browser.open("/gallery-plain");
    assert.equal(await page.locator(`${GALLERY} .sk-gallery__link`).count(), 0);
    assert.equal(await page.locator(".sk-lightbox").count(), 0);
    assert.ok(!(await page.content()).includes(".sk-gallery:not([data-ready])"), "the lightbox script is on the page");
  });
});
