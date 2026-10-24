// The browser tests' harness: the fixture builds, the server serves it the way
// Hostsmith does, and the browser opens it with scripts on and off.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

describe("browser harness", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("opens a page of the fixture, with and without scripts", async () => {
    for (const javaScriptEnabled of [true, false]) {
      const page = await browser.open("/tabs", { javaScriptEnabled });
      assert.equal(await page.locator("h1").count(), 1);
      assert.deepEqual(page.requests, [], "the page loaded something from another host");
    }
  });

  it("serves a page at its path without a trailing slash, and the 404 page", async () => {
    const page = await browser.open("/spaces/desks");
    assert.equal(await page.title(), "Desks");
    const missing = await browser.open("/nowhere");
    assert.equal(await missing.title(), "Page not found");
  });
});
