// site-kit-migration-cost design D176: the migration skill's clean-up script,
// on a copy of the `webflow` example that a migration changed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";
import { cleanUp } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/clean-up.mjs";
import { EXAMPLES, PACKAGE, run } from "./helpers.mjs";

const SCRIPT = join(PACKAGE, "skills", "migrate-webflow", "scripts", "clean-up.mjs");
const EXAMPLE = join(EXAMPLES, "webflow");
const NOT_COPIED = new Set(["node_modules", "dist", ".astro"]);
const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const git = (dir, ...args) => execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd: dir, encoding: "utf8" });

async function edit(dir, path, from, to) {
  const text = await readFile(join(dir, path), "utf8");
  assert.ok(text.includes(from), `${path} has no ${from}`);
  await writeFile(join(dir, path), text.replace(from, to));
}

// The example as created, then a migration's commit: new home, contact and 404
// pages, a posts collection, and the site's own logos in the settings.
async function migratedSite({ news = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "site-kit-clean-up-"));
  dirs.push(dir);
  await cp(EXAMPLE, dir, { recursive: true, filter: (src) => !NOT_COPIED.has(relative(EXAMPLE, src).split(/[\\/]/)[0]) });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "Initial commit from Astro");
  git(dir, "checkout", "-q", "-b", "migrate-webflow");
  for (const page of ["home", "contact", "404"]) await writeFile(join(dir, `src/content/pages/${page}.en.md`), `---\ntitle: The mill's ${page}\nsections: []\n---\n`);
  await mkdir(join(dir, "src/content/posts"));
  await writeFile(join(dir, "src/content/posts/first-post.en.md"), "---\ntitle: The mill's first post\ndate: 2026-10-01\n---\nLooms, then laptops.\n");
  await edit(dir, "src/site.schema.ts", "export const siteCollections = {\n", "export const siteCollections = {\n  posts: { schema: z.strictObject({ title: z.string() }) },\n");
  await edit(dir, "src/site.config.ts", "  collections: {\n", '  collections: {\n    posts: { basePath: "/blog" },\n');
  await edit(dir, "public/admin/config.site.yml", "collections:\n", "collections:\n  - name: posts\n    label: Posts\n    folder: src/content/posts\n");
  await edit(dir, "src/content/settings/site.en.yml", "/assets/images/logo.svg", "/assets/images/mill-logo.svg");
  await edit(dir, "src/content/settings/site.en.yml", "/assets/images/logo-reversed.svg", "/assets/images/mill-logo.svg");
  await writeFile(join(dir, "public/assets/images/mill-logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  if (news) await writeFile(join(dir, "src/content/news/mill-reopens.en.md"), "---\ntitle: The mill reopens\ndate: 2026-10-01\n---\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "Migrate from Webflow: snapshot");
  return dir;
}

describe("the clean-up script", () => {
  it("removes the example's files the migration didn't change, and keeps the rest", async () => {
    const dir = await migratedSite();
    const { removed, edited, left } = cleanUp(dir);
    for (const path of [
      "src/content/pages/cards.en.md",
      "src/content/pages/interactive/reveal.en.md",
      "src/content/pages/news.en.md",
      "src/content/news/collection-entry.en.md",
      "src/components/collections/news.astro",
      "public/assets/images/logo.svg",
      "public/assets/images/placeholder-wide.svg",
      "public/assets/video/clip.mp4",
      "src/icons/square-dot.svg",
    ]) {
      assert.ok(removed.includes(path), `${path} not removed: ${removed.join(", ")}`);
      assert.equal(existsSync(join(dir, path)), false, path);
    }
    for (const path of ["src/content/pages/home.en.md", "src/content/pages/contact.en.md", "src/content/pages/404.en.md", "src/content/posts/first-post.en.md", "public/assets/images/mill-logo.svg"]) {
      assert.equal(existsSync(join(dir, path)), true, path);
    }
    assert.equal(existsSync(join(dir, "src/content/news")), false, "src/content/news/ is left");
    assert.equal(existsSync(join(dir, "src/content/pages/interactive")), false, "src/content/pages/interactive/ is left");

    assert.deepEqual(edited.map((line) => line.split(":")[0]), ["src/site.schema.ts", "src/site.config.ts", "public/admin/config.site.yml"]);
    const schema = await readFile(join(dir, "src/site.schema.ts"), "utf8");
    assert.doesNotMatch(schema, /^\s*news: \{/m);
    assert.match(schema, /posts: \{ schema/);
    const config = await readFile(join(dir, "src/site.config.ts"), "utf8");
    assert.doesNotMatch(config, /news:/);
    assert.match(config, /posts: \{ basePath: "\/blog" \}/);
    const decap = await readFile(join(dir, "public/admin/config.site.yml"), "utf8");
    assert.doesNotMatch(decap, /- name: news/);
    assert.match(decap, /^collections:\n {2}- name: posts\n/m);
    assert.deepEqual(left, ["CREDITS.md still names square-dot.svg."]);
  });

  it("keeps the news collection when the migration added an entry", async () => {
    const dir = await migratedSite({ news: true });
    const { removed, edited, left } = cleanUp(dir);
    assert.equal(removed.filter((path) => path.includes("news")).length, 1, removed.join(", "));
    assert.ok(removed.includes("src/content/pages/news.en.md"));
    assert.equal(existsSync(join(dir, "src/content/news/collection-entry.en.md")), true);
    assert.equal(existsSync(join(dir, "src/components/collections/news.astro")), true);
    assert.deepEqual(edited, []);
    assert.ok(left.some((line) => line.startsWith("src/content/news/ has entries the migration changed or added")), left.join("\n"));
  });

  it("changes nothing on a dry run, and says what it would remove", async () => {
    const dir = await migratedSite();
    const { code, output } = await run(process.execPath, [SCRIPT, "--dry-run"], { cwd: dir });
    assert.equal(code, 0, output);
    assert.match(output, /A dry run: nothing was changed\./);
    assert.match(output, /Would remove, as the example left them:\n(- .*\n)*- src\/content\/pages\/cards\.en\.md\n/);
    assert.match(output, /Left for you:\n- CREDITS\.md still names square-dot\.svg\./);
    assert.equal(git(dir, "status", "--porcelain"), "");
  });

  it("names the commit to compare with when no commit is the migration's", async () => {
    const dir = await migratedSite();
    git(dir, "commit", "-q", "--amend", "-m", "Port the site");
    const { code, output } = await run(process.execPath, [SCRIPT], { cwd: dir });
    assert.equal(code, 1);
    assert.match(output, /No commit starts with "Migrate from Webflow:"\. Name the commit that holds the example with --from\./);
    const { removed } = cleanUp(dir, { from: "main", dryRun: true });
    assert.ok(removed.includes("src/content/pages/cards.en.md"));
  });
});
