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
//
// For the review, it also puts both sides in one picture, the export on the
// left and the build on the right, each labelled (site-kit-webflow-migration
// design D139): <width>-overview.png, the whole page scaled to fit; and
// <width>-slice-01.png and on, a screen at a time at full size, at the same
// offset on both sides; and <width>-end.png, each side's last screen. A
// full-page screenshot is too tall for a vision model to see its detail.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const WIDTHS = [479, 767, 991, 1440];
const HEIGHT = 900;
// A slice is a screen tall, and the next starts 100 px before its end, so
// nothing falls on a cut.
const SLICE_STEP = 800;
// The long side a vision model keeps without shrinking a picture: the
// overview is scaled to it.
const OVERVIEW_HEIGHT = 1568;
const LABEL_HEIGHT = 24;
const GAP = 16;

// The page that composes the pictures: a pane for each side, holding its
// screenshot, which compose() moves and scales.
const SHEET = `<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; background: #808080; color: #fff; font: 600 14px/${LABEL_HEIGHT}px system-ui, sans-serif; }
      .sheet { display: flex; gap: ${GAP}px; }
      .pane { flex: none; width: var(--width); }
      .label { height: ${LABEL_HEIGHT}px; padding: 0 8px; overflow: hidden; white-space: nowrap; background: #000; }
      .view { position: relative; height: var(--height); overflow: hidden; }
      .view img { position: absolute; top: var(--top); left: 0; width: var(--width); }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="pane" id="export"><div class="label"></div><div class="view"><img alt=""></div></div>
      <div class="pane" id="build"><div class="label"></div><div class="view"><img alt=""></div></div>
    </div>
  </body>
</html>`;
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

  mkdirSync(args.out, { recursive: true });
  const exportSide = await serve(exportDir, { fontDir, fontsCss });
  const buildSide = await serve(buildDir);
  // The screenshots, for the page that composes the pictures.
  const shotsSide = await serve(resolve(args.out));
  let browser;
  try {
    browser = await launch(chromium, args.tools);
    const sheet = await browser.newPage();
    await sheet.setContent(SHEET);
    const result = { widths: WIDTHS, pages: [], missing: [], requested: { export: [], build: [] } };
    let pictures = 0;
    for (const page of pages) {
      const dir = join(args.out, page.name);
      mkdirSync(dir, { recursive: true });
      const shots = {};
      for (const width of WIDTHS) {
        shots[width] = {
          export: await shoot(browser, exportSide, page.exportPath, join(dir, `${width}-export.png`), { width, scripts: false }, result, "export"),
          build: await shoot(browser, buildSide, page.buildPath, join(dir, `${width}-build.png`), { width, scripts: true }, result, "build"),
        };
        Object.assign(shots[width], await compose(sheet, shotsSide, page.name, width, dir));
        pictures += shots[width].slices.length + 2;
      }
      result.pages.push({ name: page.name, export: page.exportPath, build: page.buildPath, shots });
    }
    result.missing = [...new Set(result.missing)];
    result.requested.export = [...new Set(result.requested.export)].sort();
    result.requested.build = [...new Set(result.requested.build)].sort();
    writeFileSync(join(args.out, "fidelity.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${result.pages.length} pages at ${WIDTHS.join(", ")} px: ${result.pages.length * WIDTHS.length * 2} screenshots in ${args.out}`);
    console.log(`To review, both sides in one picture: an overview, slices and an end for each page and width, ${pictures} in all.`);
    for (const missing of result.missing) console.log(`404: ${missing}`);
    for (const side of ["export", "build"]) {
      if (result.requested[side].length > 0) console.log(`The ${side}'s pages asked other hosts, which got nothing: ${result.requested[side].join(", ")}`);
    }
  } finally {
    await browser?.close();
    await exportSide.close();
    await buildSide.close();
    await shotsSide.close();
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

// One page at one width, both sides in each picture: the overview, scaled to
// fit; the slices, a screen at a time from the top, at the same offset on
// both sides, so where one page is longer they drift apart; and the end,
// each side's last screen, for the footers.
async function compose(sheet, shotsSide, name, width, dir) {
  const heights = { export: pngHeight(join(dir, `${width}-export.png`)), build: pngHeight(join(dir, `${width}-build.png`)) };
  const tall = Math.max(heights.export, heights.build);
  const url = (side) => `${shotsSide.origin}/${encodeURIComponent(name)}/${width}-${side}.png`;
  await sheet.evaluate(async (sources) => {
    for (const [side, src] of Object.entries(sources)) {
      const image = document.querySelector(`#${side} img`);
      image.src = src;
      await image.decode();
    }
  }, { export: url("export"), build: url("build") });

  const scale = Math.min(1, (OVERVIEW_HEIGHT - LABEL_HEIGHT) / tall);
  const overview = await picture(sheet, join(dir, `${width}-overview.png`), {
    width: Math.round(width * scale),
    height: Math.round(tall * scale),
    // A narrow page's overview has room for little more than the side.
    export: { top: 0, label: "export" },
    build: { top: 0, label: "build" },
  });
  const slices = [];
  for (let top = 0; ; top += SLICE_STEP) {
    const at = (side) => ({ top, label: top < heights[side] ? `${side}, ${top}-${Math.min(top + HEIGHT, heights[side])} px` : `${side}, ends at ${heights[side]} px` });
    const number = String(slices.length + 1).padStart(2, "0");
    slices.push(await picture(sheet, join(dir, `${width}-slice-${number}.png`), { width, height: HEIGHT, export: at("export"), build: at("build") }));
    if (top + HEIGHT >= tall) break;
  }
  const last = (side) => {
    const top = Math.max(0, heights[side] - HEIGHT);
    return { top, label: `${side}, last screen, ${top}-${heights[side]} px` };
  };
  const end = await picture(sheet, join(dir, `${width}-end.png`), { width, height: HEIGHT, export: last("export"), build: last("build") });
  return { overview, slices, end };
}

async function picture(sheet, file, layout) {
  await sheet.evaluate((layout) => {
    for (const side of ["export", "build"]) {
      const pane = document.getElementById(side);
      pane.style.setProperty("--width", `${layout.width}px`);
      pane.style.setProperty("--height", `${layout.height}px`);
      pane.style.setProperty("--top", `${-layout[side].top}px`);
      pane.querySelector(".label").textContent = layout[side].label;
    }
  }, layout);
  await sheet.setViewportSize({ width: layout.width * 2 + GAP, height: layout.height + LABEL_HEIGHT });
  await sheet.screenshot({ path: file });
  return relative(process.cwd(), file);
}

// A PNG's height, from its header.
function pngHeight(file) {
  return readFileSync(file).readUInt32BE(20);
}
