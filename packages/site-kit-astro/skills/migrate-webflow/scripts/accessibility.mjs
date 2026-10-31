#!/usr/bin/env node
// The Webflow migration's accessibility check (site-kit-webflow-migration task
// 2.10): axe-core on each built page, for the notes in the report's
// "Accessibility". The migration carries the old design as it was, so it
// fixes none of what this finds in the old design: each finding becomes a
// note, with what falls short, where, the requirement and its level, and the
// change that would fix it.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/accessibility.mjs \
//     --tools .hostsmith/snapshot/fidelity/tools \
//     --build dist \
//     --pages .hostsmith/snapshot/fidelity/pages.txt \
//     --out .hostsmith/snapshot/fidelity/accessibility.json \
//     [--reduced-motion ignore]
//
// --pages is the fidelity check's list, of which only each line's build path
// is read. Each page is checked at 1440 px, under reduced motion unless
// --reduced-motion is the site's `ignore` (site-kit-motion design D164): the
// page then plays its motion, and is checked once each element rests where
// its motion ends. Every request to another host gets an empty answer.
//
// Playwright and @axe-core/playwright come from the folder --tools, where the
// skill installs them, never from the site. The script prints, and writes to
// --out:
// - each text and background pair below WCAG 1.4.3's contrast minimum (AA),
//   with its ratio, its pages, and the nearest shade of the text's color, in
//   its hue, that meets the minimum;
// - each other violation axe-core rates serious or critical, by rule, with
//   its pages.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { contrastRatio, linearRgb } from "../../../scripts/check-styles.mjs";
import { launch, loadTool, reducedMotionOf, serve, settle, UsageError } from "./browser.mjs";

const WIDTH = 1440;
const HEIGHT = 900;

async function main(args) {
  for (const name of ["tools", "build", "pages", "out"]) {
    if (!args[name]) throw new UsageError(`--${name} is missing. See the usage at the top of this script.`);
  }
  const motion = reducedMotionOf(args["reduced-motion"]);
  const paths = buildPaths(readFileSync(args.pages, "utf8"));
  if (paths.length === 0) throw new UsageError(`${args.pages} lists no pages.`);
  const { chromium } = loadTool(args.tools, "playwright", "Playwright");
  const axe = loadTool(args.tools, "@axe-core/playwright");
  const AxeBuilder = axe.default ?? axe.AxeBuilder ?? axe;

  const side = await serve(resolve(args.build));
  let browser;
  const found = [];
  try {
    browser = await launch(chromium, args.tools);
    for (const path of paths) {
      const plays = motion === "ignore";
      const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, reducedMotion: plays ? "no-preference" : "reduce" });
      try {
        await context.route("**/*", (route) => (new URL(route.request().url()).origin === side.origin ? route.continue() : route.fulfill({ status: 200, contentType: "text/html", body: "" })));
        const page = await context.newPage();
        await page.goto(`${side.origin}${path}`, { waitUntil: "networkidle" });
        if (plays) await settle(page, HEIGHT / 2);
        const { violations } = await new AxeBuilder({ page }).analyze();
        found.push({ path, violations });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await side.close();
  }

  const result = { reducedMotion: motion, width: WIDTH, pages: paths, ...findings(found) };
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
  for (const pair of result.contrast) {
    console.log(
      `Contrast below WCAG 1.4.3 (AA): ${pair.text} on ${pair.background}, ${pair.ratio}:1 where ${pair.minimum}:1 is the minimum, ${where(pair)}. ${pair.shade ? `The nearest shade of the text's color that meets it: ${pair.shade}.` : "No shade of the text's color meets it."}`,
    );
  }
  for (const rule of result.violations) console.log(`axe-core's ${rule.rule} (${rule.impact}): ${rule.help}, ${where(rule)}.`);
  console.log(
    `Checked ${paths.length} pages at ${WIDTH} px, ${motion === "ignore" ? "with their motion played, as the site ignores reduced motion" : "under reduced motion"}: ${result.contrast.length} contrast pairs, ${result.violations.length} other rules. Each finding the old design brings is a note in the report's "Accessibility": what falls short, where, the requirement and its level, and the change that would fix it. In ${args.out}`,
  );
}

// The build paths of a fidelity pages list: each line's second word.
function buildPaths(text) {
  const paths = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/)[1])
    .filter(Boolean);
  return [...new Set(paths)];
}

const where = ({ pages, elements }) => {
  const named = pages.slice(0, 5).join(", ");
  return `on ${pages.length} page${pages.length > 1 ? "s" : ""} (${named}${pages.length > 5 ? `, and ${pages.length - 5} more` : ""}), ${elements} element${elements > 1 ? "s" : ""}`;
};

/**
 * axe-core's violations of each page, as the notes need them: `contrast`,
 * each text and background pair below its minimum, with its ratio, pages,
 * number of elements, the first element's HTML and a shade that passes; and
 * `violations`, every other serious or critical rule, with its pages.
 */
export function findings(found) {
  const pairs = new Map();
  const rules = new Map();
  for (const { path, violations } of found) {
    for (const violation of violations) {
      if (violation.id === "color-contrast") {
        for (const node of violation.nodes) {
          const data = node.any.find((check) => check.id === "color-contrast")?.data;
          if (!data?.fgColor || !data?.bgColor) continue;
          const minimum = Number.parseFloat(data.expectedContrastRatio);
          const key = `${data.fgColor} ${data.bgColor} ${minimum}`;
          if (!pairs.has(key)) pairs.set(key, { text: data.fgColor, background: data.bgColor, ratio: data.contrastRatio, minimum, pages: [], elements: 0, example: node.html.slice(0, 120), shade: passingShade(data.fgColor, data.bgColor, minimum) });
          const pair = pairs.get(key);
          pair.ratio = Math.min(pair.ratio, data.contrastRatio);
          pair.elements++;
          if (!pair.pages.includes(path)) pair.pages.push(path);
        }
        continue;
      }
      if (violation.impact !== "serious" && violation.impact !== "critical") continue;
      if (!rules.has(violation.id)) rules.set(violation.id, { rule: violation.id, impact: violation.impact, help: violation.help, pages: [], elements: 0 });
      const rule = rules.get(violation.id);
      rule.elements += violation.nodes.length;
      if (!rule.pages.includes(path)) rule.pages.push(path);
    }
  }
  return { contrast: [...pairs.values()].sort((a, b) => b.pages.length - a.pages.length), violations: [...rules.values()].sort((a, b) => b.pages.length - a.pages.length) };
}

// A color's OKLCH lightness, chroma and hue, from its linear sRGB.
function oklchOf(color) {
  const [r, g, b] = linearRgb(color);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

const hexOf = (linear) =>
  `#${linear.map((c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)).toString(16).padStart(2, "0")).join("")}`;
const luminance = (color) => {
  const [r, g, b] = linearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The nearest shade of `text`, in its hue, that meets `minimum` on
 * `background`: darker on a lighter background, lighter on a darker one, as
 * a hex color. Null when none does.
 */
export function passingShade(text, background, minimum) {
  const { L, C, H } = oklchOf(text);
  const step = luminance(background) > luminance(text) ? -0.005 : 0.005;
  for (let lightness = L; lightness >= 0 && lightness <= 1; lightness += step) {
    const shade = hexOf(linearRgb(`oklch(${lightness} ${C} ${H})`));
    if (contrastRatio(shade, background) >= minimum) return shade;
  }
  return null;
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { tools: { type: "string" }, build: { type: "string" }, pages: { type: "string" }, out: { type: "string" }, "reduced-motion": { type: "string" } } });
    await main(values);
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
