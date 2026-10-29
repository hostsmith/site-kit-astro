// Browser tests of the interactive parts (site-kit-webflow-example design
// D104): a built site in a real browser, by keyboard, without scripts, under
// reduced motion and with its network log. Playwright is a devDependency of
// the kit repository, never of a site. CI installs its Chromium; on a machine
// without it, the tests use the installed Google Chrome.
//
// The site is the `interactive` fixture on the `webflow` example, so every
// part has its structural theme, or an example itself. It's built once per
// test file and served from dist/ the way Hostsmith serves it: /about from
// about/index.html. Requests to any other host get an empty page and are
// recorded, so a test can tell what a page would have loaded.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { assertBuilt, buildFixture } from "../helpers.mjs";

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".xml": "application/xml", ".txt": "text/plain" };

// Serves a build's dist/ on a free local port.
export async function serve(dist) {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://localhost").pathname)).replace(/^(\.\.[/\\])+/, "");
    const candidates = path.endsWith("/") ? [join(path, "index.html")] : [path, join(path, "index.html"), `${path}.html`];
    const file = candidates.map((candidate) => join(dist, candidate)).find((candidate) => existsSync(candidate) && extname(candidate));
    if (!file) {
      response.writeHead(404, { "content-type": "text/html" });
      response.end(existsSync(join(dist, "404.html")) ? await readFile(join(dist, "404.html")) : "Not found");
      return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(await readFile(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

// Playwright's Chromium, or Chrome where it isn't installed.
export function launch() {
  return chromium.launch(existsSync(chromium.executablePath()) ? {} : { channel: "chrome" });
}

/**
 * A built site in a browser: `fixture` on `example`, or the example itself
 * with `fixture: null`. open(path, options) opens a page in a new context,
 * with `javaScriptEnabled` and `reducedMotion` as Playwright takes them, and
 * returns it with `requests`, the URLs it asked other hosts for. `before`
 * runs on the page before it loads, such as page.clock.install(). `edit`
 * rewrites the site's files before the build, as buildFixture() takes it.
 * Call close() after the tests.
 */
export async function site({ fixture = "interactive", example = "webflow", edit = {} } = {}) {
  const build = await buildFixture(fixture, { example, edit });
  assertBuilt(build);
  const server = await serve(build.dist);
  const browser = await launch();
  const contexts = [];
  return {
    build,
    async open(path, { javaScriptEnabled = true, reducedMotion = "no-preference", viewport = { width: 1280, height: 800 }, before } = {}) {
      const context = await browser.newContext({ javaScriptEnabled, reducedMotion, viewport });
      contexts.push(context);
      const page = await context.newPage();
      const requests = [];
      // Another host's request gets an empty page, not an abort: Chrome would
      // show its error page in the frame, which then swallows mouse input.
      await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin)) return route.continue();
        requests.push(url);
        return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Blocked by the test</title>" });
      });
      await before?.(page);
      await page.goto(`${server.origin}${path}`);
      return Object.assign(page, { requests });
    },
    async close() {
      for (const context of contexts) await context.close();
      await browser.close();
      await server.close();
      await build.cleanup();
    },
  };
}

// The id of the element that has focus, or its tag and classes without an id.
export function focused(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    return element?.id || `${element?.tagName.toLowerCase()}.${[...(element?.classList ?? [])].join(".")}`;
  });
}
