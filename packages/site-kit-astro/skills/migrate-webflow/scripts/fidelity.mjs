#!/usr/bin/env node
// The Webflow migration's fidelity check (site-kit-webflow-migration design
// D117): a full-page screenshot of each page of the Webflow export and of the
// built site, at Webflow's widths, for the agent to compare pair by pair.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/fidelity.mjs \
//     --tools .hostsmith/snapshot/fidelity/tools \
//     --export .hostsmith/snapshot/code \
//     --build dist \
//     --pages .hostsmith/snapshot/fidelity/pages.txt \
//     --out .hostsmith/snapshot/fidelity/shots \
//     --fonts src/styles/theme/fonts.css --font-files public/assets/fonts
//
// --pages lists one page per line: the export's file, then the build's path,
// such as `about.html /about`. A line starting with # is a comment.
//
// Both sides are served on localhost by this script. Every request to another
// host gets an empty answer, so no page reaches Webflow's CDNs or an embed's
// provider. The export renders with scripts off: its scripts come from
// Webflow, and without them its interactions hide nothing. The build renders
// with its scripts, so its parts are set up, and both emulate reduced motion.
// --fonts adds the site's @font-face rules to the export's pages, with
// --font-files served at /assets/fonts/, so a font the export lacks doesn't
// count as a difference.
//
// Playwright isn't a dependency of the site or of the kit: it's imported from
// the folder --tools, where the skill installs it. The script downloads
// nothing. It uses Playwright's Chromium, or Google Chrome where that isn't
// installed.
//
// It writes <out>/<page>/<width>-export.png and <width>-build.png, and
// <out>/fidelity.json, which lists the screenshots, the pages either side
// answered with 404, and the hosts each side's pages asked for.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const WIDTHS = [479, 767, 991, 1440];
const HEIGHT = 900;
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

class UsageError extends Error {}

const { values: options } = parseArgs({
  options: {
    tools: { type: "string" },
    export: { type: "string" },
    build: { type: "string" },
    pages: { type: "string" },
    out: { type: "string" },
    fonts: { type: "string" },
    "font-files": { type: "string" },
  },
});

try {
  await main(options);
} catch (error) {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = 1;
}

async function main(args) {
  for (const name of ["tools", "export", "build", "pages", "out"]) {
    if (!args[name]) throw new UsageError(`--${name} is missing. See the usage at the top of this script.`);
  }
  if (Boolean(args.fonts) !== Boolean(args["font-files"])) throw new UsageError("--fonts and --font-files go together.");
  const exportDir = folder(args.export, "--export");
  const buildDir = folder(args.build, "--build");
  const fontDir = args["font-files"] ? folder(args["font-files"], "--font-files") : undefined;
  const fontsCss = args.fonts ? readFileSync(args.fonts, "utf8") : undefined;
  const pages = readPages(args.pages);
  const { chromium } = loadPlaywright(args.tools);

  const exportSide = await serve(exportDir, { fontDir, fontsCss });
  const buildSide = await serve(buildDir);
  let browser;
  try {
    browser = await launch(chromium, args.tools);
    const result = { widths: WIDTHS, pages: [], missing: [], requested: { export: [], build: [] } };
    for (const page of pages) {
      const dir = join(args.out, page.name);
      mkdirSync(dir, { recursive: true });
      const shots = {};
      for (const width of WIDTHS) {
        shots[width] = {
          export: await shoot(browser, exportSide, page.exportPath, join(dir, `${width}-export.png`), { width, scripts: false }, result, "export"),
          build: await shoot(browser, buildSide, page.buildPath, join(dir, `${width}-build.png`), { width, scripts: true }, result, "build"),
        };
      }
      result.pages.push({ name: page.name, export: page.exportPath, build: page.buildPath, shots });
    }
    result.missing = [...new Set(result.missing)];
    result.requested.export = [...new Set(result.requested.export)].sort();
    result.requested.build = [...new Set(result.requested.build)].sort();
    writeFileSync(join(args.out, "fidelity.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${result.pages.length} pages at ${WIDTHS.join(", ")} px: ${result.pages.length * WIDTHS.length * 2} screenshots in ${args.out}`);
    for (const missing of result.missing) console.log(`404: ${missing}`);
    for (const side of ["export", "build"]) {
      if (result.requested[side].length > 0) console.log(`The ${side}'s pages asked other hosts, which got nothing: ${result.requested[side].join(", ")}`);
    }
  } finally {
    await browser?.close();
    await exportSide.close();
    await buildSide.close();
  }
}

function folder(path, flag) {
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new UsageError(`${flag}: ${path} isn't a folder.`);
  return resolve(path);
}

// `about.html /about` gives the page `about`, and `index.html /` the page `home`.
function readPages(path) {
  const pages = readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [exportFile, buildPath, ...rest] = line.split(/\s+/);
      if (!buildPath || rest.length > 0 || !buildPath.startsWith("/")) {
        throw new UsageError(`${path}: "${line}" isn't "<export file> <build path>", such as "about.html /about".`);
      }
      const name = buildPath === "/" ? "home" : buildPath.replace(/^\/|\/$/g, "").replaceAll("/", "-");
      return { name, exportPath: `/${exportFile.replace(/^\//, "")}`, buildPath };
    });
  if (pages.length === 0) throw new UsageError(`${path} lists no pages.`);
  const names = pages.map((page) => page.name);
  const twice = names.find((name, i) => names.indexOf(name) !== i);
  if (twice) throw new UsageError(`${path} lists the build path of "${twice}" twice.`);
  return pages;
}

function loadPlaywright(tools) {
  const require = createRequire(join(resolve(tools), "package.json"));
  try {
    return require("playwright");
  } catch {
    throw new UsageError(`Playwright isn't installed in ${tools}. Install it there as the fidelity step says, never in the site.`);
  }
}

// Playwright's Chromium, or Google Chrome where it isn't installed.
async function launch(chromium, tools) {
  if (existsSync(chromium.executablePath())) return chromium.launch();
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    throw new UsageError(
      `No browser for Playwright: neither its Chromium nor Google Chrome is installed. With the person's go-ahead, download Chromium (about 150 MB, outside the site): ${join(tools, "node_modules", ".bin", "playwright")} install chromium`,
    );
  }
}

// Serves `root` on a free local port, the way Hostsmith serves a site:
// /about from about, about.html or about/index.html. The export's pages get
// the site's fonts when `fontsCss` is given.
async function serve(root, { fontDir, fontsCss } = {}) {
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
    if (fontsCss && type === "text/html") {
      body = body.toString("utf8").replace(/<\/head>/i, `<link rel="stylesheet" href="${FONTS_CSS}"></head>`);
    }
    return send(response, 200, type, body);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}

function find(root, path) {
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

async function shoot(browser, side, path, file, { width, scripts }, result, name) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT }, reducedMotion: "reduce", javaScriptEnabled: scripts });
  try {
    // Another host gets an empty page, not an abort: Chrome would show its
    // error page in a frame, such as a map's.
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === side.origin) return route.continue();
      result.requested[name].push(url.host);
      return route.fulfill({ status: 200, contentType: "text/html", body: "" });
    });
    const page = await context.newPage();
    const response = await page.goto(`${side.origin}${path}`, { waitUntil: "networkidle" });
    if (response?.status() === 404) result.missing.push(`${name} ${path}`);
    await page.screenshot({ path: file, fullPage: true });
    return relative(process.cwd(), file);
  } finally {
    await context.close();
  }
}
