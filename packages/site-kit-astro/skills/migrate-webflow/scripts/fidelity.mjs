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
//     --fonts src/styles/theme/fonts.css --font-files public/assets/fonts \
//     [--reduced-motion ignore] [--only home,about] [--fresh]
//
// --pages lists one page per line: the export's file, then the build's path,
// such as `about.html /about`. A line starting with # is a comment.
//
// Both sides are served on localhost by this script. Every request to another
// host gets an empty answer, so no page reaches Webflow's CDNs or an embed's
// provider. The export renders with scripts off: its scripts come from
// Webflow. Webflow writes the start of an animation on page load or on scroll
// into view into the page, as an inline style that hides or moves the element
// until the script plays it; the export's pages are served without those, so
// such an element shows where its animation ends. The script reads them from
// the export's interactions, as data, never running them, and leaves the
// start states of hover and click as they are. The build renders with its
// scripts, so its parts are set up. Both emulate reduced motion, unless
// --reduced-motion is the site's `ignore` (site-kit-motion design D164): the
// build then plays its motion as its visitors see it, scrolled through so
// every element comes into view, and is shot once the motion has ended.
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
// answered with 404, and the hosts each side's pages asked for. And
// <out>/review.md, the checklist of step 9's review.
//
// For the review, it also puts both sides in one picture, the export on the
// left and the build on the right, each labelled (site-kit-webflow-migration
// design D139): <width>-overview.png, the whole page scaled to fit; and
// <width>-slice-01.png and on, a screen at a time at full size, at the same
// offset on both sides; and <width>-end.png, each side's last screen. A
// full-page screenshot is too tall for a vision model to see its detail.
//
// It measures each page and width (D166): the share of the taller side that
// differs, with both screenshots scaled to 240 px wide. The checklist lists
// the overviews worst first, and the output prints the largest and the
// average, against the last run's, to show the review's rounds converging.
// The number decides nothing: the review opens every picture.
//
// A rerun, after a fix (D141), shoots the build again, but keeps the export's
// screenshots unless what they depend on changed: the export's page file, the
// fonts given, or the way this script shoots. --fresh shoots them again too.
// --only home,about shoots only those pages, by the names the script gives
// them, and keeps the others as they are, or leaves out those it hasn't shot
// yet, such as the pages step 5 hasn't built while it settles the theme on a
// sample. The checklist keeps its ticks, the slices added and the table of
// differences, but unticks every picture whose screenshots changed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { find, launch, loadTool, reducedMotionOf, serve, settle, UsageError } from "./browser.mjs";

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
// The width both screenshots are scaled to for the measured difference.
const MEASURE_WIDTH = 240;
// Part of each export screenshot's key: change it when the way the script
// shoots changes, so a rerun shoots the export again.
const SHOT_VERSION = `2 ${WIDTHS.join(",")} ${HEIGHT}`;
const SLICES = "Slices where an overview shows a difference";
const DIFFERENCES = "Differences found";
const DIFFERENCES_HEAD = ["| Page | Width | Difference | Cause, or how it was fixed |", "| --- | --- | --- | --- |"];

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
// Webflow's (IX2) triggers of an entrance: page load and scroll into view.
const ENTRANCES = new Set(["PAGE_START", "PAGE_FINISH", "SCROLL_INTO_VIEW"]);
// What an entrance's start state sets inline.
const START_PROPERTY = /^\s*(-(webkit|moz|ms)-)?(opacity|transform|filter)\s*$/i;

const { values: options } = parseArgs({
  options: {
    tools: { type: "string" },
    export: { type: "string" },
    build: { type: "string" },
    pages: { type: "string" },
    out: { type: "string" },
    fonts: { type: "string" },
    "font-files": { type: "string" },
    only: { type: "string" },
    fresh: { type: "boolean" },
    "reduced-motion": { type: "string" },
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
  const only = args.only === undefined ? undefined : readOnly(args.only, pages);
  const motion = reducedMotionOf(args["reduced-motion"]);
  const { chromium } = loadTool(args.tools, "playwright", "Playwright");

  mkdirSync(args.out, { recursive: true });
  const resultFile = join(args.out, "fidelity.json");
  const reviewFile = join(args.out, "review.md");
  // The last run's pages, by name, for what a rerun keeps.
  const previous = new Map((existsSync(resultFile) ? (JSON.parse(readFileSync(resultFile, "utf8")).pages ?? []) : []).map((page) => [page.name, page]));
  const fonts = fontsKey(fontsCss, fontDir);
  const starts = entranceStartsOf(exportDir);
  const exportSide = await serve(exportDir, { fontDir, fontsCss, rewrite: starts ? (html) => withoutStarts(html, starts) : undefined });
  const buildSide = await serve(buildDir);
  // The screenshots, for the page that composes the pictures.
  const shotsSide = await serve(resolve(args.out));
  let browser;
  try {
    browser = await launch(chromium, args.tools);
    const sheet = await browser.newPage();
    // The sheet takes the screenshots' origin, so its canvas may read them.
    await sheet.goto(`${shotsSide.origin}/`);
    await sheet.setContent(SHEET);
    const result = { widths: WIDTHS, pages: [], missing: [], requested: { export: [], build: [] } };
    // The pictures whose screenshots changed, which lose their ticks.
    const changed = new Set();
    const counts = { shot: 0, exportsKept: 0, kept: 0, left: 0 };
    let pictures = 0;
    for (const page of pages) {
      const before = previous.get(page.name);
      const same = before?.export === page.exportPath && before?.build === page.buildPath;
      if (only && !only.has(page.name)) {
        if (same) {
          result.pages.push(before);
          counts.kept++;
        } else counts.left++;
        continue;
      }
      const dir = join(args.out, page.name);
      mkdirSync(dir, { recursive: true });
      const key = exportKey(exportDir, page.exportPath, fonts);
      const keepExport = !args.fresh && same && before.key === key && WIDTHS.every((width) => existsSync(join(dir, `${width}-export.png`)));
      const entry = { name: page.name, export: page.exportPath, build: page.buildPath, key, shots: {}, missing: [], requested: { export: [], build: [] } };
      if (keepExport) {
        entry.missing.push(...(before.missing ?? []).filter((missing) => missing.startsWith("export ")));
        entry.requested.export.push(...(before.requested?.export ?? []));
        counts.exportsKept++;
      }
      for (const width of WIDTHS) {
        const exportShot = keepExport
          ? { file: relative(process.cwd(), join(dir, `${width}-export.png`)), changed: false }
          : await shoot(browser, exportSide, page.exportPath, join(dir, `${width}-export.png`), { width, scripts: false }, entry, "export");
        const buildShot = await shoot(browser, buildSide, page.buildPath, join(dir, `${width}-build.png`), { width, scripts: true, motion }, entry, "build");
        const shots = { export: exportShot.file, build: buildShot.file, ...(await compose(sheet, shotsSide, page.name, width, dir)) };
        if (exportShot.changed || buildShot.changed) for (const picture of [shots.overview, ...shots.slices, shots.end]) changed.add(picture);
        entry.shots[width] = shots;
        pictures += shots.slices.length + 2;
      }
      entry.missing = [...new Set(entry.missing)];
      entry.requested.export = [...new Set(entry.requested.export)].sort();
      entry.requested.build = [...new Set(entry.requested.build)].sort();
      result.pages.push(entry);
      counts.shot++;
    }
    result.missing = [...new Set(result.pages.flatMap((page) => page.missing ?? []))];
    for (const side of ["export", "build"]) result.requested[side] = [...new Set(result.pages.flatMap((page) => page.requested?.[side] ?? []))].sort();
    writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`);
    const review = reviewList(result.pages, existsSync(reviewFile) ? readFileSync(reviewFile, "utf8") : "", changed);
    writeFileSync(reviewFile, review.text);
    // What went wrong first, and what to do next last, where a look at the
    // output's end finds it.
    if (starts === null) console.log("Webflow's interactions couldn't be read from the export's scripts, so what its entrance animations hide at first stays hidden in the export's screenshots.");
    else if (starts) console.log("Webflow's entrance animations start some elements hidden or moved: the export's screenshots show them where the animations end.");
    if (motion === "ignore") console.log("The build plays its motion for every visitor, as the site's reducedMotion says: its screenshots show each element where its motion ends.");
    for (const missing of result.missing) console.log(`404: ${missing}`);
    for (const side of ["export", "build"]) {
      if (result.requested[side].length > 0) console.log(`The ${side}'s pages asked other hosts, which got nothing: ${result.requested[side].join(", ")}`);
    }
    console.log(`To review, both sides in one picture: an overview, slices and an end for each page and width. New pictures: ${pictures}.`);
    console.log(`Pages shot at ${WIDTHS.join(", ")} px: ${counts.shot}, with the export's screenshots kept from the last run for ${counts.exportsKept}. Pages kept as they were: ${counts.kept}.${counts.left > 0 ? ` Pages left out by --only, not shot yet: ${counts.left}.` : ""} In ${args.out}`);
    const measured = measuredOf(result.pages);
    if (measured.length > 0) {
      // The last run's average, only when it measured the same pages and
      // widths: not after step 5's sample, which measured a few.
      const now = new Set(measured.map((m) => `${m.name} ${m.width}`));
      const before = measuredOf([...previous.values()]).filter((m) => now.has(`${m.name} ${m.width}`));
      const comparable = before.length === measured.length;
      const largest = measured.slice(0, 5).map((m) => `${m.name} at ${m.width} px, ${m.difference}%`).join("; ");
      console.log(`Measured, the share of each page that differs: the largest ${largest}. Average ${average(measured)}%${comparable ? `, against ${average(before)}% in the last run` : ""}.`);
    }
    console.log(`Pictures to open in ${reviewFile}, in its order, three or four at a time: ${review.open} of ${review.count}.`);
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

// --only's page names, such as `home,about`, each one a page of --pages.
function readOnly(list, pages) {
  const names = new Set(list.split(",").map((name) => name.trim()).filter(Boolean));
  const unknown = [...names].filter((name) => !pages.some((page) => page.name === name));
  if (names.size === 0 || unknown.length > 0) {
    throw new UsageError(`--only: ${unknown.length ? `no page named ${unknown.map((name) => `"${name}"`).join(", ")}` : "no page named"}. The pages are ${pages.map((page) => page.name).join(", ")}.`);
  }
  return names;
}

// The site's fonts, as the export's pages get them: the rules and the files.
function fontsKey(fontsCss, fontDir) {
  const hash = createHash("sha256").update(fontsCss ?? "");
  if (fontDir) {
    for (const name of readdirSync(fontDir, { recursive: true }).sort()) {
      const file = join(fontDir, name);
      if (statSync(file).isFile()) hash.update(`\n${name} ${statSync(file).size}`);
    }
  }
  return hash.digest("hex");
}

// What an export page's screenshots depend on, besides the rest of the
// snapshot, which a migration never changes: its file, the fonts, and the way
// the script shoots.
function exportKey(exportDir, path, fonts) {
  const file = find(exportDir, path);
  return createHash("sha256")
    .update(`${SHOT_VERSION}\n${fonts}\n`)
    .update(file ? readFileSync(file) : "404")
    .digest("hex")
    .slice(0, 16);
}

// The elements Webflow's entrance animations start hidden or moved, from the
// interactions (IX2) in the export's scripts, read as data: by data-w-id, and,
// for an animation on a page's load, by class on that page, as data-wf-page
// names it. Undefined when there are none, null when they can't be read.
function entranceStartsOf(exportDir) {
  const dir = join(exportDir, "js");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return undefined;
  for (const name of readdirSync(dir).filter((name) => /^webflow.*\.js$/i.test(name)).sort()) {
    const js = readFileSync(join(dir, name), "utf8");
    const call = /ix2["']\)\.init\(\s*\{/.exec(js);
    if (!call) continue;
    let interactions;
    try {
      interactions = JSON.parse(literalToJson(js, call.index + call[0].length - 1));
    } catch {
      return null;
    }
    const ids = new Set();
    const classes = new Map();
    for (const event of Object.values(interactions.events ?? {})) {
      if (!ENTRANCES.has(event.eventTypeId)) continue;
      const list = interactions.actionLists?.[event.action?.config?.actionListId];
      for (const item of (list?.actionItemGroups ?? []).flatMap((group) => group.actionItems ?? [])) {
        const target = item.config?.target ?? {};
        if (!target.selector) {
          const id = target.useEventTarget === true ? event.target?.id : target.id;
          if (id) ids.add(id.split("|").pop());
        } else if (event.target?.appliesTo === "PAGE" && !target.useEventTarget && /^(\.[\w-]+)+$/.test(target.selector)) {
          for (const page of event.targets ?? [event.target]) {
            classes.set(page.id, [...(classes.get(page.id) ?? []), target.selector.split(".").filter(Boolean)]);
          }
        }
      }
    }
    return ids.size > 0 || classes.size > 0 ? { ids, classes } : undefined;
  }
  return undefined;
}

// The object literal at `start`, a `{`, as JSON: its keys quoted, its strings
// in double quotes, `!0` and `!1` as true and false, and hexadecimal numbers
// as decimal. Throws on anything else, which a literal of data doesn't hold.
function literalToJson(js, start) {
  let json = "";
  let depth = 0;
  let i = start;
  do {
    const char = js[i];
    if (char === '"' || char === "'") {
      let text = '"';
      let end = i + 1;
      while (js[end] !== char) {
        if (end >= js.length) throw new Error("A string doesn't end.");
        if (js[end] === "\\") {
          text += js[end + 1] === "'" ? "'" : js.slice(end, end + 2);
          end += 2;
        } else {
          text += js[end] === '"' ? '\\"' : js[end];
          end++;
        }
      }
      json += `${text}"`;
      i = end + 1;
    } else if (/\s/.test(char)) {
      i++;
    } else if ("{[,:]}".includes(char)) {
      if (char === "{" || char === "[") depth++;
      if (char === "}" || char === "]") depth--;
      json += char;
      i++;
    } else if (char === "!" && (js[i + 1] === "0" || js[i + 1] === "1")) {
      json += js[i + 1] === "0" ? "true" : "false";
      i += 2;
    } else {
      const number = /^(-?)(0x[0-9a-f]+|\d*\.?\d+(?:e[+-]?\d+)?)/i.exec(js.slice(i, i + 40));
      const word = /^[A-Za-z_$][\w$]*/.exec(js.slice(i, i + 200));
      if (number) {
        json += number[1] + String(Number(number[2]));
        i += number[0].length;
      } else if (word && ["true", "false", "null"].includes(word[0])) {
        json += word[0];
        i += word[0].length;
      } else if (word && /^\s*:/.test(js.slice(i + word[0].length, i + word[0].length + 20))) {
        json += `"${word[0]}"`;
        i += word[0].length;
      } else {
        throw new Error(`Not data: ${js.slice(i, i + 30)}`);
      }
    }
  } while (depth > 0);
  return json;
}

// A page of the export without its entrances' start states: each element
// they start loses its inline opacity, transform and filter.
function withoutStarts(html, { ids, classes }) {
  const lists = classes.get(/<html[^>]*\sdata-wf-page="([^"]+)"/i.exec(html)?.[1]) ?? [];
  return html.replace(/<[a-zA-Z][^>]*\sstyle="[^"]*"[^>]*>/g, (tag) => {
    const id = /\sdata-w-id="([^"]+)"/.exec(tag)?.[1];
    const names = (/\sclass="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/);
    if (!ids.has(id) && !lists.some((list) => list.every((name) => names.includes(name)))) return tag;
    return tag.replace(/\sstyle="([^"]*)"/, (attribute, style) => {
      const kept = style.split(";").filter((declaration) => !START_PROPERTY.test(declaration.split(":")[0]));
      return kept.join(";").trim() ? ` style="${kept.join(";")}"` : "";
    });
  });
}

// A full-page screenshot into `file`, and whether it differs from the one
// there before, byte for byte. With `motion` "ignore", the page plays its
// motion and settles first.
async function shoot(browser, side, path, file, { width, scripts, motion = "respect" }, entry, name) {
  const plays = motion === "ignore";
  const context = await browser.newContext({ viewport: { width, height: HEIGHT }, reducedMotion: plays ? "no-preference" : "reduce", javaScriptEnabled: scripts });
  try {
    // Another host gets an empty page, not an abort: Chrome would show its
    // error page in a frame, such as a map's.
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === side.origin) return route.continue();
      entry.requested[name].push(url.host);
      return route.fulfill({ status: 200, contentType: "text/html", body: "" });
    });
    const page = await context.newPage();
    const response = await page.goto(`${side.origin}${path}`, { waitUntil: "networkidle" });
    if (response?.status() === 404) entry.missing.push(`${name} ${path}`);
    if (plays) await settle(page, HEIGHT / 2);
    const png = await page.screenshot({ fullPage: true });
    const changed = !existsSync(file) || !readFileSync(file).equals(png);
    writeFileSync(file, png);
    return { file: relative(process.cwd(), file), changed };
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
  const difference = await measure(sheet);

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
  return { overview, slices, end, difference };
}

// How much the build differs from the export (D166), in percent of the
// taller side: both screenshots, as the sheet holds them, scaled to
// MEASURE_WIDTH, the pixels of their overlap whose color differs by more than
// a small margin, and all of the part one side has beyond the other's end.
// It ranks the review and shows the rounds converging. It decides nothing.
function measure(sheet) {
  return sheet.evaluate((width) => {
    const images = ["export", "build"].map((side) => document.querySelector(`#${side} img`));
    const heights = images.map((image) => Math.max(1, Math.round((image.naturalHeight * width) / image.naturalWidth)));
    const pixels = images.map((image, i) => {
      const canvas = Object.assign(document.createElement("canvas"), { width, height: heights[i] });
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, heights[i]);
      return context.getImageData(0, 0, width, heights[i]).data;
    });
    const overlap = Math.min(...heights);
    const tall = Math.max(...heights);
    let differing = 0;
    for (let i = 0; i < width * overlap * 4; i += 4) {
      const most = Math.max(Math.abs(pixels[0][i] - pixels[1][i]), Math.abs(pixels[0][i + 1] - pixels[1][i + 1]), Math.abs(pixels[0][i + 2] - pixels[1][i + 2]));
      if (most > 32) differing++;
    }
    return Math.round(((differing + width * (tall - overlap)) / (width * tall)) * 1000) / 10;
  }, MEASURE_WIDTH);
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

// Step 9's checklist (D139, D141): every page's overview at every width, then
// the header and the footer at every width, on the home page or else the
// first page, then room for the slices the agent opens, and the table of the
// differences it finds. The paths are as fidelity.json gives them, so each
// opens as it stands. A rerun keeps the ticks, the slices added and the
// table, but unticks the pictures in `changed`, whose screenshots changed, and
// drops a slice added that no longer exists.
function reviewList(pages, previous, changed) {
  const first = pages.find((page) => page.name === "home") ?? pages[0];
  const ticked = new Set([...previous.matchAll(/^- \[x\] (\S+)/gim)].map((match) => match[1]).filter((path) => !changed.has(path)));
  const part = (title) => previous.split(`\n## ${title}\n`)[1]?.split("\n## ")[0] ?? "";
  const added = [...part(SLICES).matchAll(/^- \[[ x]\] (\S+)/gim)].map((match) => match[1]).filter((path) => existsSync(path));
  const rows = part(DIFFERENCES)
    .split("\n")
    .filter((line) => line.startsWith("|") && !DIFFERENCES_HEAD.includes(line.trim()));
  const item = (path, note = "") => `- [${ticked.has(path) ? "x" : " "}] ${path}${note}`;
  // The overviews worst first, by their measured difference (D166).
  const measured = pages.flatMap((page) => WIDTHS.map((width) => ({ path: page.shots[width].overview, difference: page.shots[width].difference })));
  measured.sort((a, b) => (b.difference ?? -1) - (a.difference ?? -1));
  const overviews = measured.map((m) => m.path);
  const ends = WIDTHS.flatMap((width) => [first.shots[width].slices[0], first.shots[width].end]);
  const listed = [...overviews, ...ends];
  const text = [
    "# Fidelity review",
    "",
    "Open the pictures in this order, three or four at a time, and tick each one once you've looked at it. Each holds the export on the left and the build on the right. Write each difference into the table at the end as you go, and fix nothing until you've opened them all. A rerun unticks the pictures whose screenshots changed: open those again.",
    "",
    'The report\'s "Compared" lists the ticked pictures, "Not compared" the rest, and its table the differences left.',
    "",
    "## Every page's overview, at every width",
    "",
    "The order of the sections, a section missing or added, and the columns at that width. Worst first, each with the share of the page that differs, as measured: a small share can still hide a missing button, so open every one.",
    "",
    ...measured.map((m) => item(m.path, typeof m.difference === "number" ? ` (${m.difference}% different)` : "")),
    "",
    `## The header and the footer, at every width, on ${first.name}`,
    "",
    "Every page shares them, and they change the most between widths: a button beside the menu button, a menu that collapses, columns that stack.",
    "",
    ...ends.map((path) => item(path)),
    "",
    `## ${SLICES}`,
    "",
    "Add each slice you open here, ticked.",
    "",
    ...added.map((path) => item(path)),
    ...(added.length ? [""] : []),
    `## ${DIFFERENCES}`,
    "",
    "One row for each difference, by page and width, or `all` for every width. Once it's fixed, say how in the last column. The rows not fixed go into the report.",
    "",
    ...DIFFERENCES_HEAD,
    ...rows,
    "",
  ].join("\n");
  return { text, count: listed.length + added.length, open: [...listed, ...added].filter((path) => !ticked.has(path)).length };
}

// Each page and width's measured difference, the largest first, from the
// pages' entries in fidelity.json. Entries from before D166 have none.
function measuredOf(pages) {
  return pages
    .flatMap((page) => WIDTHS.map((width) => ({ name: page.name, width, difference: page.shots?.[width]?.difference })))
    .filter((m) => typeof m.difference === "number")
    .sort((a, b) => b.difference - a.difference);
}

// A declaration, not a const: main() runs before this point of the file.
function average(measured) {
  return Math.round((measured.reduce((sum, m) => sum + m.difference, 0) / measured.length) * 10) / 10;
}

// A PNG's height, from its header.
function pngHeight(file) {
  return readFileSync(file).readUInt32BE(20);
}
