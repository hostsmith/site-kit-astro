#!/usr/bin/env node
// The Webflow migration's clean-up, step 11 (site-kit-migration-cost design
// D176): removes what the `webflow` example left that the migration didn't
// change, in one call instead of many turns.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/clean-up.mjs [--dry-run] [--from <commit>]
//
// Run it in the site's folder. --from is the commit that holds the example as
// the migration found it: by default, the parent of the first commit whose
// message starts with "Migrate from Webflow:". A file is the example's,
// unchanged, when it's the same there and now. It removes:
// - the unchanged pages in src/content/pages/, except the 404;
// - the `news` collection, when none of its entries changed and none was
//   added: src/content/news/ and src/components/collections/news.astro, and
//   its entry in src/site.schema.ts, src/site.config.ts and
//   public/admin/config.site.yml, where that text is still the example's;
// - the unchanged files in public/assets/ and src/icons/ that no text under
//   src/ or in public/admin/config.site.yml names: a file by its path, such
//   as assets/images/logo.svg, an icon by its name, such as square-dot.
//   public/admin/config.yml lists every icon there is, and `npm run
//   decap-config` writes it again.
// It prints what it removed and what it left for you. --dry-run prints the
// same and removes nothing. It runs git, and reads the site as text.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { UsageError } from "./browser.mjs";

const FIRST_COMMIT = "^Migrate from Webflow:";
const PAGES = "src/content/pages";
const NEWS = "src/content/news";
const NEWS_TEMPLATE = "src/components/collections/news.astro";
const DECAP_SITE = "public/admin/config.site.yml";
const TEXT = /\.(astro|css|html|js|json|jsx|md|mdx|mjs|svelte|ts|tsx|vue|ya?ml)$/;

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new UsageError(`git ${args.join(" ")} failed: ${result.stderr.trim() || `exit ${result.status}`}`);
  return result.stdout;
}

// The commit before the migration's first, or --from.
function startOf(root, from) {
  if (from) return git(root, ["rev-parse", "--verify", `${from}^{commit}`]).trim();
  const first = git(root, ["log", "--format=%H", "--reverse", `--grep=${FIRST_COMMIT}`]).split("\n")[0];
  if (!first) throw new UsageError('No commit starts with "Migrate from Webflow:". Name the commit that holds the example with --from.');
  const parent = spawnSync("git", ["rev-parse", "--verify", `${first}^`], { cwd: root, encoding: "utf8" });
  if (parent.status !== 0) throw new UsageError(`The migration's first commit, ${first.slice(0, 7)}, has no parent. Name the commit that holds the example with --from.`);
  return parent.stdout.trim();
}

// Each file under `dirs` at `commit`, with its blob's hash.
function treeOf(root, commit, dirs) {
  const tree = new Map();
  for (const line of git(root, ["ls-tree", "-r", commit, "--", ...dirs]).split("\n").filter(Boolean)) {
    const [info, path] = line.split("\t");
    tree.set(path, info.split(" ")[2]);
  }
  return tree;
}

function filesUnder(root, dir) {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir), { recursive: true })
    .map((file) => `${dir}/${String(file).split("\\").join("/")}`)
    .filter((file) => statSync(join(root, file)).isFile());
}

// The lines of `text` from the one that `start` matches, through the first
// line that `end` matches, or, without `end`, through its last line indented
// deeper than it.
function blockOf(text, start, end) {
  const lines = text.split("\n");
  const from = lines.findIndex((line) => start.test(line));
  if (from === -1) return undefined;
  let to = from;
  if (end) {
    to = lines.findIndex((line, i) => i > from && end.test(line));
    if (to === -1) return undefined;
  } else {
    const indent = lines[from].match(/^\s*/)[0].length;
    for (let i = from + 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      if (lines[i].match(/^\s*/)[0].length <= indent) break;
      to = i;
    }
  }
  return `${lines.slice(from, to + 1).join("\n")}\n`;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function cleanUp(root, { from, dryRun = false } = {}) {
  const start = startOf(root, from);
  const example = treeOf(root, start, [PAGES, NEWS, NEWS_TEMPLATE, "public/assets", "src/icons"]);
  const now = (path) => (existsSync(join(root, path)) ? git(root, ["hash-object", "--", path]).trim() : undefined);
  const unchanged = (path) => example.has(path) && now(path) === example.get(path);
  const removed = [];
  const edited = [];
  const left = [];
  // The text of each file, as this run leaves it.
  const texts = new Map();
  const textOf = (path) => (texts.has(path) ? texts.get(path) : existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined);
  const remove = (path) => {
    removed.push(path);
    texts.set(path, undefined);
  };

  // Pages
  for (const path of example.keys()) {
    if (path.startsWith(`${PAGES}/`) && !basename(path).startsWith("404.") && unchanged(path)) remove(path);
  }

  // The news collection
  const entries = filesUnder(root, NEWS);
  if (entries.length > 0 && entries.every(unchanged)) {
    entries.forEach(remove);
    if (unchanged(NEWS_TEMPLATE)) remove(NEWS_TEMPLATE);
    else if (existsSync(join(root, NEWS_TEMPLATE))) left.push(`${NEWS_TEMPLATE} isn't the example's any more: remove it if nothing uses it.`);
    const parts = [
      ["src/site.schema.ts", (text) => blockOf(text, /^\s*news: \{\s*$/, /^\s{2}\},\s*$/)],
      ["src/site.config.ts", (text) => text.match(/^[ \t]*news: \{[^\n]*\},?[ \t]*\n/m)?.[0]],
      [DECAP_SITE, (text) => blockOf(text, /^\s*- name: news\s*$/)],
    ];
    for (const [path, find] of parts) {
      const before = spawnSync("git", ["show", `${start}:${path}`], { cwd: root, encoding: "utf8" });
      const block = before.status === 0 ? find(before.stdout) : undefined;
      const text = textOf(path);
      if (block && text?.includes(block)) {
        let after = text.replace(block, "");
        if (path.endsWith(".yml") && !/^collections:[ \t]*\n(?:[ \t]*(?:#.*)?\n)*[ \t]+- /m.test(after)) after = after.replace(/^collections:[ \t]*$/m, "collections: []");
        texts.set(path, after);
        edited.push(`${path}: the news collection's entry`);
      } else if (text && /\bnews\b/.test(text)) {
        left.push(`${path} names news in text that isn't the example's: remove its news entry yourself.`);
      }
    }
  } else if (entries.length > 0) {
    left.push(`${NEWS}/ has entries the migration changed or added, so the news collection stays.`);
  }

  // Media and icons nothing names
  const corpus = [...filesUnder(root, "src"), DECAP_SITE]
    .filter((path) => TEXT.test(path) && !path.startsWith("src/icons/"))
    .map(textOf)
    .filter((text) => text !== undefined)
    .join("\n");
  for (const path of example.keys()) {
    if (!unchanged(path)) continue;
    if (path.startsWith("public/assets/")) {
      if (!corpus.includes(path.slice("public/".length))) remove(path);
    } else if (path.startsWith("src/icons/")) {
      const name = basename(path).replace(/\.svg$/, "");
      if (!new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`).test(corpus)) remove(path);
    }
  }

  const credits = textOf("CREDITS.md") ?? "";
  const credited = removed.filter((path) => !path.endsWith(".md") && credits.includes(basename(path)));
  if (credited.length) left.push(`CREDITS.md still names ${credited.map((path) => basename(path)).join(", ")}.`);

  if (!dryRun) {
    for (const [path, text] of texts) {
      if (text === undefined) rmSync(join(root, path), { force: true });
      else writeFileSync(join(root, path), text);
    }
    // Folders the removals emptied, such as src/content/news/.
    for (const dir of new Set(removed.map((path) => dirname(path)))) {
      for (let at = dir; at !== "." && existsSync(join(root, at)) && readdirSync(join(root, at)).length === 0; at = dirname(at)) rmSync(join(root, at), { recursive: true });
    }
  }
  return { start, removed, edited, left };
}

function main(args) {
  const { start, removed, edited, left } = cleanUp(process.cwd(), { from: args.from, dryRun: args["dry-run"] });
  const list = (items) => (items.length ? items.map((item) => `- ${item}`).join("\n") : "- nothing");
  console.log(`The example as the migration found it: ${start.slice(0, 7)}.${args["dry-run"] ? " A dry run: nothing was changed." : ""}

${args["dry-run"] ? "Would remove" : "Removed"}, as the example left them:
${list(removed)}

${args["dry-run"] ? "Would edit" : "Edited"}:
${list(edited)}

Left for you:
${list(left)}`);
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { from: { type: "string" }, "dry-run": { type: "boolean" } } });
    main(values);
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
