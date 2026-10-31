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
//     --fill .hostsmith/snapshot/fidelity/fill.json \
//     [--reduced-motion ignore] [--only home,about] [--fresh]
//
// --pages lists one page per line: the export's file, then the build's path,
// such as `about.html /about`. A line starting with # is a comment. A third
// word, `anew`, marks a page step 5 wrote anew, such as a 404 page when the
// export has only Webflow's near-default one (site-kit-fidelity-cms-stubs
// design D184): it's shot and reviewed for the site's look, but left out of
// the measured average and the rounds' rule. A template is listed up to three
// times, each with one of its entries (D183).
//
// --fill is step 6's fill file (D181, D182): the export's CMS templates and
// collection lists, which Webflow exports empty, are served filled with the
// entries the build shows, from the CSVs in the snapshot's cms/ folder,
// beside --export, with the images that its work/cms-images.txt names, from
// the build. A template or list the file doesn't account for is shot as it
// is, and named. Without the file, as in step 5's sample, every page is shot
// as exported. fill.mjs says what the file holds.
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
// <out>/review.md, the checklist of step 9's review, and <out>/results.md,
// the results per page that step 10 copies into the report
// (site-kit-webflow-migration design D197).
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
// the overviews worst first. Of a template listed with several entries, it
// puts up at each width the entry that differs most, and lists the others as
// measured. The output prints the largest and the average over the pages it
// counts, which leave out those written anew and count a template once per
// width, by that entry, and each counted page's average over its widths
// against the last run's, to show the review's rounds converging. The numbers
// decide only when the rounds stop (site-kit-fidelity-cms-stubs D185,
// revising site-kit-migration-cost D177): from the third rerun of every page,
// when no counted page's average moved by 1 point or more against the run
// before. Until then, the review opens every picture.
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
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { find, launch, loadTool, reducedMotionOf, serve, settle, UsageError } from "./browser.mjs";
import { fillPage, readFill, readImages } from "./fill.mjs";

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
// The review's rounds stop when a rerun moves no counted page's average by
// this much, in points, from the third rerun of every page, round 4
// (site-kit-fidelity-cms-stubs D185): the first two reruns, which check the
// first rounds' fixes, are always reviewed.
const PAGE_MOVE = 1;
const STOP_FROM_ROUND = 4;
// Part of each export screenshot's key: change it when the way the script
// shoots changes, so a rerun shoots the export again.
const SHOT_VERSION = `2 ${WIDTHS.join(",")} ${HEIGHT}`;
const SLICES = "Slices where an overview shows a difference";
const DIFFERENCES = "Differences found";
const ANEW = "Pages written anew";
const ENTRIES = "Other entries of the templates, measured";
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
    fill: { type: "string" },
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
  const fill = readFill(args.fill);
  // The snapshot beside the export holds the CSVs, and step 6's list of the
  // images they link to.
  const cms = join(dirname(exportDir), "cms");
  const images = readImages(join(dirname(exportDir), "work", "cms-images.txt"));

  mkdirSync(args.out, { recursive: true });
  const resultFile = join(args.out, "fidelity.json");
  const reviewFile = join(args.out, "review.md");
  // The last run's pages, by name, for what a rerun keeps.
  const last = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, "utf8")) : {};
  const previous = new Map((last.pages ?? []).map((page) => [page.name, page]));
  const fonts = fontsKey(fontsCss, fontDir);
  const starts = entranceStartsOf(exportDir);
  // The pages filled from the CMS, as their export screenshots show them, by
  // the page's name, which the URL's ?fill= gives.
  const served = new Map();
  const exportSide = await serve(exportDir, {
    fontDir,
    fontsCss,
    fillDir: buildDir,
    rewrite: (html, url) => {
      const page = served.get(url.searchParams.get("fill"))?.html ?? html;
      return starts ? withoutStarts(page, starts) : page;
    },
  });
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
    // `fill`: whether it read a fill file (D182).
    const result = { widths: WIDTHS, fill: Boolean(fill), pages: [], missing: [], requested: { export: [], build: [] } };
    // The pictures whose screenshots changed, which lose their ticks.
    const changed = new Set();
    const counts = { shot: 0, exportsKept: 0, kept: 0, left: 0 };
    // What the fill did on each page shot, for the output.
    const fills = [];
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
      const filled = fillOf(exportDir, page, { fill, cms, images });
      if (filled?.parts.length) fills.push(filled);
      if (filled?.changed) served.set(page.name, filled);
      const key = exportKey(exportDir, page.exportPath, fonts, filled?.changed ? filledKey(filled, buildDir) : undefined);
      const keepExport = !args.fresh && same && before.key === key && WIDTHS.every((width) => existsSync(join(dir, `${width}-export.png`)));
      const entry = { name: page.name, export: page.exportPath, build: page.buildPath, ...(page.anew ? { anew: true } : {}), key, shots: {}, missing: [], requested: { export: [], build: [] } };
      if (filled?.parts.length) {
        entry.filled = filled.parts.every((part) => part.filled);
        entry.fill = filled.parts.map(({ part, filled, problem }) => ({ part, filled, ...(problem ? { problem } : {}) }));
      }
      const exportPath = filled?.changed ? `${page.exportPath}?fill=${encodeURIComponent(page.name)}` : page.exportPath;
      if (keepExport) {
        entry.missing.push(...(before.missing ?? []).filter((missing) => missing.startsWith("export ")));
        entry.requested.export.push(...(before.requested?.export ?? []));
        counts.exportsKept++;
      }
      for (const width of WIDTHS) {
        const exportShot = keepExport
          ? { file: relative(process.cwd(), join(dir, `${width}-export.png`)), changed: false }
          : await shoot(browser, exportSide, exportPath, join(dir, `${width}-export.png`), { width, scripts: false }, entry, "export");
        const buildShot = await shoot(browser, buildSide, page.buildPath, join(dir, `${width}-build.png`), { width, scripts: true, motion }, entry, "build");
        const shots = { export: exportShot.file, build: buildShot.file, ...(await compose(sheet, shotsSide, page.name, width, dir)) };
        if (exportShot.changed || buildShot.changed) for (const picture of [shots.overview, ...shots.slices, shots.end]) changed.add(picture);
        entry.shots[width] = shots;
        pictures += shots.slices.length + 2;
      }
      // A page written anew needn't be in the export.
      entry.missing = [...new Set(entry.missing)].filter((missing) => !page.anew || !missing.startsWith("export "));
      entry.requested.export = [...new Set(entry.requested.export)].sort();
      entry.requested.build = [...new Set(entry.requested.build)].sort();
      result.pages.push(entry);
      counts.shot++;
    }
    result.missing = [...new Set(result.pages.flatMap((page) => page.missing ?? []))];
    for (const side of ["export", "build"]) result.requested[side] = [...new Set(result.pages.flatMap((page) => page.requested?.[side] ?? []))].sort();
    // The pages counted (D183, D184), and the last run's, only when it
    // measured the same pages and widths: not after step 5's sample, which
    // measured a few.
    const units = unitsOf(result.pages);
    const measured = cellsOf(units);
    const now = new Set(measured.map((m) => `${m.name} ${m.width}`));
    const lastUnits = unitsOf([...previous.values()]);
    const before = cellsOf(lastUnits).filter((m) => now.has(`${m.name} ${m.width}`));
    const comparable = measured.length > 0 && before.length === measured.length;
    // Step 9's round: its first run of every page is round 1, and each rerun
    // of the same pages the next. Step 5's sample, --only some pages, is none.
    const sample = only !== undefined && pages.some((page) => !only.has(page.name));
    result.round = sample ? 0 : comparable && last.round ? last.round + 1 : 1;
    writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`);
    const review = reviewList(result.pages, existsSync(reviewFile) ? readFileSync(reviewFile, "utf8") : "", changed);
    writeFileSync(reviewFile, review.text);
    writeFileSync(join(args.out, "results.md"), resultsTable(result.pages, result.round));
    // What went wrong first, and what to do next last, where a look at the
    // output's end finds it.
    if (starts === null) console.log("Webflow's interactions couldn't be read from the export's scripts, so what its entrance animations hide at first stays hidden in the export's screenshots.");
    else if (starts) console.log("Webflow's entrance animations start some elements hidden or moved: the export's screenshots show them where the animations end.");
    if (motion === "ignore") console.log("The build plays its motion for every visitor, as the site's reducedMotion says: its screenshots show each element where its motion ends.");
    for (const line of fillLines(fills, fill, args.fill)) console.log(line);
    for (const missing of result.missing) console.log(`404: ${missing}`);
    for (const side of ["export", "build"]) {
      if (result.requested[side].length > 0) console.log(`The ${side}'s pages asked other hosts, which got nothing: ${result.requested[side].join(", ")}`);
    }
    console.log(`To review, both sides in one picture: an overview, slices and an end for each page and width. New pictures: ${pictures}.`);
    console.log(`Pages shot at ${WIDTHS.join(", ")} px: ${counts.shot}, with the export's screenshots kept from the last run for ${counts.exportsKept}. Pages kept as they were: ${counts.kept}.${counts.left > 0 ? ` Pages left out by --only, not shot yet: ${counts.left}.` : ""} In ${args.out}`);
    if (measured.length > 0) {
      const largest = [...measured].sort((a, b) => b.difference - a.difference).slice(0, 5).map((m) => `${m.page} at ${m.width} px, ${m.difference}%`).join("; ");
      const anew = result.pages.filter((page) => page.anew).map((page) => page.name);
      const against = comparable ? `, against ${average(before)}% in the last run` : "";
      console.log(`Measured, the share of each page that differs: the largest ${largest}. Average ${average(measured)}%${against}${anew.length > 0 ? `, without the pages written anew, ${anew.join(", ")}` : ""}.`);
      if (comparable) {
        const changes = changesOf(units, lastUnits);
        console.log(`Each page's average over its widths, against the last run: ${changes.map((c) => `${c.name} ${c.now}%, ${c.change > 0 ? `up ${c.change}` : c.change < 0 ? `down ${-c.change}` : "the same"}`).join("; ")}.`);
        if (!sample) console.log(`Round ${result.round}: ${roundsVerdict(changes, result.round)}`);
      }
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

// `about.html /about` gives the page `about`, and `index.html /` the page
// `home`. `404.html /404 anew` marks the page 404 as written anew (D184).
function readPages(path) {
  const pages = readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [exportFile, buildPath, mark, ...rest] = line.split(/\s+/);
      if (!buildPath || rest.length > 0 || !buildPath.startsWith("/") || (mark !== undefined && mark !== "anew")) {
        throw new UsageError(`${path}: "${line}" isn't "<export file> <build path>", such as "about.html /about", with "anew" after them for a page written anew.`);
      }
      const name = buildPath === "/" ? "home" : buildPath.replace(/^\/|\/$/g, "").replaceAll("/", "-");
      return { name, exportPath: `/${exportFile.replace(/^\//, "")}`, buildPath, anew: mark === "anew" };
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
// snapshot, which a migration never changes: its file, or, filled from the
// CMS, filledKey(), the fonts, and the way the script shoots.
function exportKey(exportDir, path, fonts, filled) {
  const file = find(exportDir, path);
  return createHash("sha256")
    .update(`${SHOT_VERSION}\n${fonts}\n`)
    .update(filled ?? (file ? readFileSync(file) : "404"))
    .digest("hex")
    .slice(0, 16);
}

// The export page of `page`, filled from the CMS (D182), as fillPage() gives
// it, with its file in the export and whether the fill changed it. Undefined
// when the export has no such page.
function fillOf(exportDir, page, options) {
  const path = find(exportDir, page.exportPath);
  if (!path) return undefined;
  const html = readFileSync(path, "utf8");
  const file = relative(exportDir, path).split(sep).join("/");
  const filled = fillPage(html, { file, buildPath: page.buildPath, ...options });
  return { ...filled, file, changed: filled.html !== html };
}

// What a filled page's screenshots depend on: its HTML as served, with the
// values it read, and the images it shows from the build.
function filledKey(filled, buildDir) {
  const sizes = filled.images.map((name) => {
    const file = join(buildDir, "assets", "images", name);
    return `${name} ${existsSync(file) ? statSync(file).size : "missing"}`;
  });
  return `${filled.html}\n${sizes.join("\n")}`;
}

// What the fill did, once for each export file and part: its fields by
// element, for a glance at the map, or why it couldn't fill.
function fillLines(fills, fill, path) {
  const lines = new Set();
  const unmapped = new Set();
  let empty = false;
  for (const { file, parts, unmapped: urls } of fills) {
    for (const url of urls) unmapped.add(url);
    for (const part of parts) {
      if (part.filled) lines.add(`Filled from the CSVs, each element by its field: ${file}, ${part.part}: ${part.map.join("; ")}.`);
      else if (fill) lines.add(`Not filled, shot as exported: ${file}, ${part.part}: ${part.problem}.`);
      else empty = true;
    }
  }
  if (empty) lines.add(`The export's CMS templates and collection lists are shot empty: there's no fill file${path ? ` at ${path}` : ""} yet. Step 6 writes it, and --fill names it.`);
  if (unmapped.size > 0) {
    const urls = [...unmapped];
    lines.add(`Images of the CSVs that cms-images.txt doesn't name, shown empty: ${urls.slice(0, 5).join(", ")}${urls.length > 5 ? `, and ${urls.length - 5} more` : ""}.`);
  }
  return [...lines];
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

// Step 9's checklist (D139, D141): every page's overview at every width, of a
// template listed with several entries the one that differs most at each
// width (D183), then the pages written anew (D184), then the header and the
// footer at every width, on the home page or else the first page, then room
// for the slices the agent opens, and the table of the differences it finds.
// The other entries of the templates are listed as measured, without a box to
// tick. The paths are as fidelity.json gives them, so each opens as it
// stands. A rerun keeps the ticks, the slices added and the table, but
// unticks the pictures in `changed`, whose screenshots changed, and drops a
// slice added that no longer exists.
function reviewList(pages, previous, changed) {
  const first = pages.find((page) => page.name === "home") ?? pages[0];
  const ticked = new Set([...previous.matchAll(/^- \[x\] (\S+)/gim)].map((match) => match[1]).filter((path) => !changed.has(path)));
  const part = (title) => previous.split(`\n## ${title}\n`)[1]?.split("\n## ")[0] ?? "";
  const added = [...part(SLICES).matchAll(/^- \[[ x]\] (\S+)/gim)].map((match) => match[1]).filter((path) => existsSync(path));
  const rows = part(DIFFERENCES)
    .split("\n")
    .filter((line) => line.startsWith("|") && !DIFFERENCES_HEAD.includes(line.trim()));
  const item = (path, note = "") => `- [${ticked.has(path) ? "x" : " "}] ${path}${note}`;
  const share = (difference) => (typeof difference === "number" ? ` (${difference}% different)` : "");
  // The overviews worst first, by their measured difference (D166).
  const measured = unitsOf(pages).flatMap((unit) => [...unit.cells.values()]);
  measured.sort((a, b) => (b.difference ?? -1) - (a.difference ?? -1));
  const overviews = measured.map((m) => m.overview);
  const reviewed = new Set(overviews);
  const others = pages
    .filter((page) => !page.anew)
    .flatMap((page) => WIDTHS.map((width) => page.shots[width]))
    .filter((shots) => !reviewed.has(shots.overview));
  const anew = pages.filter((page) => page.anew).flatMap((page) => WIDTHS.map((width) => page.shots[width].overview));
  const ends = WIDTHS.flatMap((width) => [first.shots[width].slices[0], first.shots[width].end]);
  const listed = [...overviews, ...anew, ...ends];
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
    ...measured.map((m) => item(m.overview, share(m.difference))),
    "",
    ...(anew.length > 0
      ? [`## ${ANEW}`, "", "Step 5 wrote these anew, so the export has no page of theirs to match: open each for the site's look, its header, footer, type and colors, not for its differences.", "", ...anew.map((path) => item(path)), ""]
      : []),
    `## The header and the footer, at every width, on ${first.name}`,
    "",
    "Every page shares them, and they change the most between widths: a button beside the menu button, a menu that collapses, columns that stack.",
    "",
    ...ends.map((path) => item(path)),
    "",
    ...(others.length > 0
      ? [`## ${ENTRIES}`, "", "Not to open: at each width, the entry of its template that differs most is on the list above.", "", ...others.map((shots) => `- ${shots.overview}${share(shots.difference)}`), ""]
      : []),
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

// The pages the average and the rounds' rule count, from their entries in
// fidelity.json (D183, D184): each page not written anew, by its name, and a
// template listed with several entries once, by its export file. Each holds
// a cell per width: its overview, its measured difference, which entries
// from before D166 lack, and, of a template's entries, the one that differs
// most.
function unitsOf(pages) {
  const entries = new Map();
  for (const page of pages) entries.set(page.export, (entries.get(page.export) ?? 0) + 1);
  const units = new Map();
  for (const page of pages) {
    if (page.anew || !page.shots) continue;
    const name = entries.get(page.export) > 1 ? page.export.replace(/^\//, "") : page.name;
    if (!units.has(name)) units.set(name, { name, cells: new Map() });
    const cells = units.get(name).cells;
    for (const width of WIDTHS) {
      const shots = page.shots[width];
      if (!shots) continue;
      const cell = { width, page: page.name, overview: shots.overview, difference: shots.difference };
      if (!cells.has(width) || (cell.difference ?? -1) > (cells.get(width).difference ?? -1)) cells.set(width, cell);
    }
  }
  return [...units.values()];
}

// The counted pages' measured cells, each with its page's name in the count.
function cellsOf(units) {
  return units.flatMap((unit) => [...unit.cells.values()].filter((cell) => typeof cell.difference === "number").map((cell) => ({ ...cell, name: unit.name })));
}

// Each counted page's average over its widths, against the last run's, and
// its change, up when it differs more, the largest change first.
function changesOf(units, lastUnits) {
  const last = new Map(lastUnits.map((unit) => [unit.name, unit]));
  return units
    .filter((unit) => cellsOf([unit]).length > 0 && cellsOf([last.get(unit.name) ?? { cells: new Map() }]).length > 0)
    .map((unit) => {
      const now = average(cellsOf([unit]));
      const change = Math.round((now - average(cellsOf([last.get(unit.name)]))) * 10) / 10;
      return { name: unit.name, now, change };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

// Whether the review's rounds go on, from each counted page's change and the
// round (site-kit-fidelity-cms-stubs D185).
function roundsVerdict(changes, round) {
  const rose = changes.filter((c) => c.change >= PAGE_MOVE).map((c) => c.name);
  if (rose.length > 0) {
    return `${rose.join(", ")} differ${rose.length === 1 ? "s" : ""} more, by ${PAGE_MOVE} point or more: the last fixes broke something. Review the pictures it unticked, ${rose.length === 1 ? "that page's" : "those pages'"} for what the fixes broke.`;
  }
  if (changes.some((c) => -c.change >= PAGE_MOVE)) return "Review the pictures it unticked.";
  if (round >= STOP_FROM_ROUND) return `no page moved by ${PAGE_MOVE} point or more, so the review's rounds stop here. Open none of the pictures it unticked: list them under the report's "Not compared".`;
  return `no page moved by ${PAGE_MOVE} point or more, but the first two reruns are always reviewed. Review the pictures it unticked.`;
}

// A declaration, not a const: main() runs before this point of the file.
function average(measured) {
  return Math.round((measured.reduce((sum, m) => sum + m.difference, 0) / measured.length) * 10) / 10;
}

// The results per page for the report (site-kit-webflow-migration design
// D197), as Markdown: each page's measured difference at each width and its
// average, by its path in the build; a template listed with several entries on
// one row, by its entry that differs most at each width, with each entry on a
// row under it; a page written anew, not counted; then the average over the
// pages counted.
function resultsTable(pages, round) {
  const cell = (difference) => (typeof difference === "number" ? `${difference}%` : "-");
  const row = (label, cells) => {
    const measured = cells.filter((c) => typeof c?.difference === "number");
    return `| ${label} | ${WIDTHS.map((width) => cell(cells.find((c) => c?.width === width)?.difference)).join(" | ")} | ${measured.length ? `${average(measured)}%` : "-"} |`;
  };
  const cellsOfPage = (page) => WIDTHS.map((width) => ({ width, difference: page.shots?.[width]?.difference }));
  const entries = new Map();
  for (const page of pages) entries.set(page.export, [...(entries.get(page.export) ?? []), page]);
  const units = new Map(unitsOf(pages).map((unit) => [unit.name, unit]));
  const lines = [`| Page | ${WIDTHS.map((width) => `${width} px`).join(" | ")} | Average |`, `| --- |${WIDTHS.map(() => " --- |").join("")} --- |`];
  for (const [file, group] of entries) {
    if (group.length === 1) {
      const [page] = group;
      lines.push(row(page.anew ? `${page.build}, written anew, not counted` : page.build, cellsOfPage(page)));
      continue;
    }
    lines.push(row(`${file.replace(/^\//, "")}, a template: its entry that differs most`, [...(units.get(file.replace(/^\//, ""))?.cells.values() ?? [])]));
    for (const page of group) lines.push(row(`an entry: ${page.build}`, cellsOfPage(page)));
  }
  const counted = cellsOf([...units.values()]);
  const when = round > 0 ? `after round ${round} of the review` : "on step 5's sample";
  const summary = counted.length ? `The share of each page's screenshot that differs from the export's, ${when}. Average over the pages counted: ${average(counted)}%.` : "Nothing was measured.";
  return `${lines.join("\n")}\n\n${summary}\n`;
}

// A PNG's height, from its header.
function pngHeight(file) {
  return readFileSync(file).readUInt32BE(20);
}
