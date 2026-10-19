// site-kit-locales design D58: a single-locale site renders the same on this
// package as on the last release. The last release's `basics` example is
// built twice: with that release's published package, and with the package
// in this workspace, after the kit update's steps and `npm run decap-config`.
// Every page, the sitemap and robots.txt must match, apart from the hashed
// names of built assets and field attributes, which name the locale.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { BASICS, REPO, run } from "./helpers.mjs";

const TAG = execFileSync("git", ["describe", "--tags", "--abbrev=0", "--match", "v*"], { cwd: REPO, encoding: "utf8" }).trim();

// The release's basics example, from its tag, in a folder of its own.
async function exampleAt(tag, dir) {
  await mkdir(dir, { recursive: true });
  execFileSync("sh", ["-c", `git archive --format=tar ${tag} examples/basics | tar -x -C "${dir}"`], { cwd: REPO });
  return join(dir, "examples", "basics");
}

const astroBuild = (site) =>
  run(process.execPath, [join(site, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
    cwd: site,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1", SITE_NOINDEX: "" },
  });

const edit = async (file, rewrite) => writeFile(file, rewrite(await readFile(file, "utf8")));

// The steps a single-locale site takes to 0.6 (design D58), as the README's
// "Kit updates" gives them: the default locale's code in every content file's
// name, the locale in the site config with the settings' old language as its
// tag, the collections declared by their schemas, and the custom about page's
// props in a hero section, which a page template shows in the old page's
// markup. The converted about page is the workspace's `basics` page, whose
// only change since the release is this one.
async function takeRelease(site) {
  const content = join(site, "src", "content");
  for (const folder of ["pages", "news", "settings"]) {
    for (const file of await readdir(join(content, folder), { recursive: true })) {
      const match = /^(.*)\.(md|yml)$/.exec(file);
      if (match) await rename(join(content, folder, file), join(content, folder, `${match[1]}.en.${match[2]}`));
    }
  }
  const settings = join(content, "settings", "site.en.yml");
  const [, tag] = (await readFile(settings, "utf8")).match(/^language: (.+)$/m);
  await edit(settings, (text) => text.replace(/^language: .+\n/m, ""));
  await edit(join(site, "src", "site.config.ts"), (text) => text.replace("  collections: {", `  locales: [{ code: "en", tag: "${tag}" }],\n  collections: {`));
  await edit(join(site, "src", "site.schema.ts"), (text) =>
    text
      .replace('import { defineCollection } from "astro/content/config";\nimport { glob } from "astro/loaders";\n', "")
      .replace(/  news: defineCollection\(\{\n    loader: .*\n/, "  news: {\n")
      .replace(/\n  \}\),\n\};\n$/, "\n  },\n};\n"),
  );
  await rm(join(site, "src", "pages", "about.astro"));
  await cp(join(BASICS, "src", "components", "pages"), join(site, "src", "components", "pages"), { recursive: true });
  await cp(join(BASICS, "src", "content", "pages", "about.en.md"), join(content, "pages", "about.en.md"));
  await edit(join(site, "public", "admin", "config.site.yml"), (text) => text.replace(/  # Pages with `template: custom`[\s\S]*?\n\n(  - name: news)/, "$1"));
}

// Field attributes as 0.5 wrote them: without the locale, and with the about
// page's header from its own props rather than its hero section.
const withoutLocale = (text) =>
  text
    .replace(/data-field="((?:pages|news|settings)\/[^"#]+)\.en#/g, 'data-field="$1#')
    .replace('data-field="pages/about#sections[b0xc].title"', 'data-field="pages/about#heading"')
    .replace(/data-field="pages\/about#sections\[b0xc\]\./g, 'data-field="pages/about#');

// Every page, sitemap and robots.txt of a build, with asset hashes masked.
async function output(site, normalize = (text) => text) {
  const dist = join(site, "dist");
  const files = (await readdir(dist, { recursive: true })).filter((file) => /\.(html|xml|txt)$/.test(file)).sort();
  const texts = {};
  for (const file of files) texts[file] = normalize((await readFile(join(dist, file), "utf8")).replace(/\/_astro\/[\w.-]+/g, "/_astro/<asset>"));
  return texts;
}

describe(`a single-locale site from ${TAG}`, () => {
  let dir;
  let released;
  let current;
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "site-kit-unchanged-"));

    // With the release's published package, installed as a site gets it.
    const old = await exampleAt(TAG, join(dir, "released"));
    const install = await run("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund"], { cwd: old });
    assert.equal(install.code, 0, install.output);
    const oldBuild = await astroBuild(old);
    assert.equal(oldBuild.code, 0, oldBuild.output);
    released = await output(old);

    // With this workspace's package, linked as in the fixture builds.
    const site = await exampleAt(TAG, join(dir, "current"));
    await mkdir(join(site, "node_modules"));
    for (const name of await readdir(join(REPO, "node_modules"))) {
      if (!name.startsWith(".")) await symlink(join(REPO, "node_modules", name), join(site, "node_modules", name));
    }
    await takeRelease(site);
    const assemble = await run(process.execPath, [join(REPO, "packages", "site-kit-astro", "bin", "site-kit.mjs"), "decap-config"], { cwd: site });
    assert.equal(assemble.code, 0, assemble.output);
    const build = await astroBuild(site);
    assert.equal(build.code, 0, build.output);
    current = await output(site, withoutLocale);
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("builds the same pages", () => {
    for (const file of ["index.html", "404.html", "sitemap.xml", "robots.txt"]) assert.ok(file in released, `${TAG} built no ${file}`);
    assert.deepEqual(Object.keys(current), Object.keys(released));
  });

  it("renders every page, the sitemap and robots.txt the same", () => {
    for (const [file, text] of Object.entries(released)) assert.equal(current[file], text, `${file} differs from ${TAG}`);
  });
});
