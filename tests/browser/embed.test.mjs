// site-kit-interactive-parts, "Embeds load on a click"; site-kit-section-library,
// "`embed` section"; site-kit-content-model, "Portable content dialect" (video
// links in a body). The page's requests to other hosts are blocked and logged.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { site } from "./helpers.mjs";

const fromHost = (requests, host) => requests.filter((url) => new URL(url).hostname.endsWith(host));
const PROVIDERS = ["openstreetmap.org", "youtube.com", "youtube-nocookie.com", "ytimg.com", "vimeo.com", "vimeocdn.com"];

describe("embeds", () => {
  let browser;
  before(async () => {
    browser = await site();
  });
  after(() => browser.close());

  it("request nothing from a provider before the click", async () => {
    const page = await browser.open("/embed");
    await page.waitForLoadState("networkidle");
    for (const host of PROVIDERS) assert.deepEqual(fromHost(page.requests, host), [], `the page requested ${host}`);
    const map = page.locator('[data-section="embed"]').first();
    assert.equal((await map.locator(".sk-embed__button").textContent()).trim(), "Show map");
    assert.equal((await map.locator(".sk-embed__notice").textContent()).trim(), "Loads content from openstreetmap.org");
    assert.equal((await map.locator(".sk-embed__link").textContent()).trim(), "Open on openstreetmap.org");
    assert.match(await map.locator(".sk-embed__link").getAttribute("href"), /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html/);
    assert.equal(await map.locator(".sk-embed__media").getAttribute("data-ready"), "");
  });

  it("load the map's frame on a click, and move focus to it", async () => {
    const page = await browser.open("/embed");
    const map = page.locator('[data-section="embed"]').first();
    const request = page.waitForRequest((sent) => new URL(sent.url()).hostname.endsWith("openstreetmap.org"));
    await map.locator(".sk-embed__button").click();
    await request;
    const frame = map.locator("iframe.sk-embed__iframe");
    assert.equal(await frame.getAttribute("title"), "The map");
    assert.ok(await frame.evaluate((element) => element === document.activeElement), "focus isn't on the frame");
    assert.equal(await map.locator(".sk-embed__placeholder").count(), 0);
  });

  it("play YouTube from youtube-nocookie.com, and Vimeo with dnt=1", async () => {
    const page = await browser.open("/embed");
    const youtube = page.locator('[data-section="embed"]').nth(1);
    assert.equal((await youtube.locator(".sk-embed__button").textContent()).trim(), "Play video");
    assert.equal((await youtube.locator(".sk-embed__notice").textContent()).trim(), "Loads content from youtube-nocookie.com");
    assert.equal((await youtube.locator(".sk-embed__link").textContent()).trim(), "Open on youtube.com");
    await youtube.locator(".sk-embed__button").click();
    assert.equal(await youtube.locator("iframe").getAttribute("src"), "https://www.youtube-nocookie.com/embed/3URtTIdnXIk");
    assert.equal(fromHost(page.requests, "youtube.com").length, 0, "the player loaded from youtube.com");

    const vimeo = page.locator('[data-section="embed"]').nth(2);
    await vimeo.locator(".sk-embed__button").click();
    assert.equal(await vimeo.locator("iframe").getAttribute("src"), "https://player.vimeo.com/video/76979871?dnt=1");
  });

  it("render a frame at once with load: direct, lazily, with its title", async () => {
    const page = await browser.open("/embed", { javaScriptEnabled: false });
    const direct = page.locator('[data-section="embed"]').nth(3);
    const frame = direct.locator("iframe.sk-embed__iframe");
    assert.equal(await frame.getAttribute("loading"), "lazy");
    assert.equal(await frame.getAttribute("title"), "A frame that loads at once");
    assert.equal(await direct.locator(".sk-embed__placeholder").count(), 0);
  });

  it("keep the placeholder and its link without scripts, and hide the button", async () => {
    const page = await browser.open("/embed", { javaScriptEnabled: false });
    const map = page.locator('[data-section="embed"]').first();
    assert.equal(await map.locator(".sk-embed__button").isVisible(), false);
    assert.ok(await map.locator(".sk-embed__link").isVisible());
    assert.ok(await map.locator(".sk-embed__notice").isVisible());
  });

  it("render a video link alone in a body's paragraph as an embed, and leave other links as links", async () => {
    const page = await browser.open("/news/video-post");
    await page.waitForLoadState("networkidle");
    for (const host of PROVIDERS) assert.deepEqual(fromHost(page.requests, host), [], `the post requested ${host}`);
    const body = page.locator('[data-field="news/video-post.en#body"]');
    const embeds = body.locator(".sk-embed__media");
    assert.equal(await embeds.count(), 2);
    assert.equal(await embeds.first().locator(".sk-embed__button").getAttribute("data-title"), "A tour of the mill");
    assert.equal((await embeds.first().locator(".sk-embed__caption").textContent()).trim(), "A tour of the mill");
    assert.equal(await embeds.nth(1).locator(".sk-embed__button").getAttribute("data-src"), "https://player.vimeo.com/video/76979871?dnt=1");
    // The links in running text, and a link that isn't a video, stay links.
    assert.equal(await body.locator('p > a[href="https://www.youtube.com/watch?v=3URtTIdnXIk"]').count(), 1);
    assert.equal(await body.locator('p > a[href="https://example.com/watch"]').count(), 1);
    // The layout adds the script once.
    assert.equal((await page.content()).split(".sk-embed__media:not([data-ready]) .sk-embed__button").length - 1, 1);
    await embeds.first().locator(".sk-embed__button").click();
    assert.equal(await embeds.first().locator("iframe").getAttribute("title"), "A tour of the mill");
  });

  it("aren't on a page without embeds", async () => {
    const page = await browser.open("/tabs");
    assert.ok(!(await page.content()).includes(".sk-embed__media:not([data-ready])"), "the embed script is on a page without embeds");
  });
});
