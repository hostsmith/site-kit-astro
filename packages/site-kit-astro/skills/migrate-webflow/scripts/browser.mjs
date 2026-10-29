// The browser the skill's checks use: Playwright, from the folder where the
// skill installs it, never a dependency of the site or of the kit, with
// Playwright's Chromium or Google Chrome, and the server that gives it the
// pages on localhost. The scripts download nothing.
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, relative, resolve, sep } from "node:path";

const FONTS_PATH = "/assets/fonts/";
const FONTS_CSS = "/__fidelity/fonts.css";

const TYPES = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// Serves `root` on a free local port, the way Hostsmith serves a site:
// /about from about, about.html or about/index.html. The pages get the
// site's fonts when `fontsCss` is given, with `fontDir` at /assets/fonts/,
// and `rewrite` changes each page's HTML first, when it's given.
export async function serve(root, { fontDir, fontsCss, rewrite } = {}) {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (fontsCss && path === FONTS_CSS) return send(response, 200, "text/css", fontsCss);
    const file = fontDir && path.startsWith(FONTS_PATH) ? inside(fontDir, path.slice(FONTS_PATH.length)) : find(root, path);
    if (!file) {
      const notFound = inside(root, "404.html");
      return send(response, 404, "text/html", notFound ? await readFile(notFound) : "Not found");
    }
    const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
    let body = await readFile(file);
    if (rewrite && type === "text/html") body = rewrite(body.toString("utf8"));
    if (fontsCss && type === "text/html") {
      body = body.toString("utf8").replace(/<\/head>/i, `<link rel="stylesheet" href="${FONTS_CSS}"></head>`);
    }
    return send(response, 200, type, body);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}

// The file that serves `path` under `root`, if any.
export function find(root, path) {
  const candidates = path.endsWith("/") ? [`${path}index.html`] : [path, `${path}.html`, `${path}/index.html`];
  return candidates.map((candidate) => inside(root, candidate)).find(Boolean);
}

// The file at `path` under `root`, if it exists and doesn't leave `root`.
function inside(root, path) {
  const file = resolve(root, `.${sep}${path}`);
  if (relative(root, file).startsWith("..")) return undefined;
  return existsSync(file) && statSync(file).isFile() ? file : undefined;
}

function send(response, status, type, body) {
  response.writeHead(status, { "content-type": type });
  response.end(body);
}

// A problem the person fixes, shown as its message alone.
export class UsageError extends Error {}

// A package installed in `tools`, such as playwright, which messages call
// `label`.
export function loadTool(tools, name, label = name) {
  const require = createRequire(join(resolve(tools), "package.json"));
  try {
    return require(name);
  } catch {
    throw new UsageError(`${label} isn't installed in ${tools}. Install it there as the verify step says, never in the site.`);
  }
}

// Playwright's Chromium, or Google Chrome where it isn't installed.
export async function launch(chromium, tools) {
  if (existsSync(chromium.executablePath())) return chromium.launch();
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    throw new UsageError(
      `No browser for Playwright: neither its Chromium nor Google Chrome is installed. With the person's go-ahead, download Chromium (about 150 MB, outside the site): ${join(tools, "node_modules", ".bin", "playwright")} install chromium`,
    );
  }
}

// The site's `reducedMotion`, from --reduced-motion: "respect", the default,
// or "ignore" (site-kit-motion design D164).
export function reducedMotionOf(value) {
  if (value === undefined || value === "respect" || value === "ignore") return value ?? "respect";
  throw new UsageError(`--reduced-motion is "${value}". It is the site's reducedMotion from src/site.config.ts: respect, the default, or ignore.`);
}

// A page of a site that ignores reduced motion, as its visitors see it once
// they've scrolled to each part (site-kit-motion design D164): scrolled
// through a half screen at a time, so every element comes into view and its
// motion plays, then back to its top, and left until the motion has ended. A
// motion that loops is left as it is, and nothing waits more than 10 s.
export function settle(page, step) {
  return page.evaluate(async (half) => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
    for (let y = 0; y < document.documentElement.scrollHeight; y += half) {
      window.scrollTo(0, y);
      await frame();
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
    await frame();
    const ending = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.race([Promise.all(ending.map((animation) => animation.finished.catch(() => {}))), new Promise((done) => setTimeout(done, 10_000))]);
  }, step);
}
