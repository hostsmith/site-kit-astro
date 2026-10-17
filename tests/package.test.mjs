// site-kit-package: the integration's contract with the site, the package's
// exports, and the package as npm installs it (site-kit-updates design D19,
// D20, D25).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";
import { BASICS, buildFixture, PACKAGE, run } from "./helpers.mjs";

const siteSchemaWith = (type) => (text) =>
  text.replace(
    "export const siteSectionSchemas = {};",
    `import { section } from "@hostsmith/site-kit-astro/schema";\nexport const siteSectionSchemas = {\n  "${type}": section("${type}", { title: z.string(), body: z.string() }),\n};`,
  );

describe("the site contract", () => {
  it("fails without src/site.schema.ts, naming it", async () => {
    const build = await buildFixture("base", { remove: ["src/site.schema.ts"] });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /Missing src\/site\.schema\.ts/);
  });

  it("renders a site-local section built with the package's exports", async () => {
    const component = [
      "---",
      'import { sectionFields } from "@hostsmith/site-kit-astro/field";',
      'import { renderMarkdown } from "@hostsmith/site-kit-astro/markdown";',
      "const { section, entry } = Astro.props;",
      "const f = sectionFields(entry, section);",
      "const html = await renderMarkdown(section.body, entry);",
      "---",
      '<section {...f.root}><h2 {...f.field("title")}>{section.title}</h2><div {...f.field("body")} set:html={html} /></section>',
      "",
    ].join("\n");
    const decapType = "section_types:\n  - name: note\n    label: Note\n    widget: object\n    fields:\n      - { name: title, label: Title, widget: string }\n      - { name: body, label: Body, widget: markdown }";
    const build = await buildFixture("base", {
      edit: { "src/site.schema.ts": siteSchemaWith("note"), "public/admin/config.site.yml": (text) => text.replace("section_types: []", decapType) },
      files: {
        "src/components/sections/site/note.astro": component,
        "src/content/pages/note.md": "---\ntitle: Note\nsections:\n  - { id: n0t3, type: note, title: Hello, body: 'Some **bold** text' }\n---\n",
      },
    });
    try {
      assert.ok(build.ok, build.output);
      const html = await build.read("note/index.html");
      assert.match(html, /<section data-section="note"><h2 data-field="pages\/note#sections\[n0t3\]\.title">Hello<\/h2>/);
      assert.match(html, /<strong>bold<\/strong>/);
    } finally {
      await build.cleanup();
    }
  });

  it("doesn't let a site import a module the package doesn't export", async () => {
    const page = '---\nimport { absoluteUrl } from "@hostsmith/site-kit-astro/src/lib/seo.ts";\n---\n<p>{absoluteUrl("/", Astro.site)}</p>\n';
    const build = await buildFixture("base", { files: { "src/pages/internal.astro": page } });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /not exported|is not defined by "exports"/);
  });
});

describe("published files", () => {
  const files = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: PACKAGE, encoding: "utf8" }))[0].files.map((f) => f.path);

  it("include the integration, the source, the tool, the Decap part, the rules and the hooks", () => {
    for (const path of ["index.ts", "src/content.ts", "src/routes/page.astro", "bin/site-kit.mjs", "decap/config.kit.yml", "AGENTS.md", "HOOKS.md", "LICENSE", "README.md", "package.json"]) {
      assert.ok(files.includes(path), `${path} is not published`);
    }
  });

  // site-kit-sections, "The kit ships no styles".
  it("include no stylesheet", () => {
    for (const path of files) assert.doesNotMatch(path, /\.(css|scss|sass|less)$/, path);
  });

  it("include no tests, fixtures or example files", () => {
    for (const path of files) assert.doesNotMatch(path, /^(tests|examples|fixtures|node_modules)\//, path);
  });
});

// The package as a site gets it from npm: packed, then installed into a copy
// of the `basics` example outside the workspace, so nothing is linked.
describe("packed package", () => {
  let dir;
  let build;
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "site-kit-packed-"));
    const [{ filename }] = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", dir], { cwd: PACKAGE, encoding: "utf8" }));
    const site = join(dir, "site");
    await cp(BASICS, site, { recursive: true, filter: (src) => !/^(node_modules|dist|\.astro)(\/|$)/.test(relative(BASICS, src)) });
    const pkg = JSON.parse(await readFile(join(site, "package.json"), "utf8"));
    pkg.dependencies["@hostsmith/site-kit-astro"] = `file:../${filename}`;
    await writeFile(join(site, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    const install = await run("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund"], { cwd: site });
    assert.equal(install.code, 0, install.output);
    build = await run(process.execPath, [join(site, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
      cwd: site,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1" },
    });
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("is installed, not linked", () => {
    assert.ok(!lstatSync(join(dir, "site", "node_modules", "@hostsmith", "site-kit-astro")).isSymbolicLink());
  });

  it("builds the example", async () => {
    assert.equal(build.code, 0, build.output);
    assert.match(await readFile(join(dir, "site", "dist", "index.html"), "utf8"), /data-section="hero"/);
  });

  it("runs the site-kit command", async () => {
    const check = await run("npm", ["run", "decap-config", "--", "--check"], { cwd: join(dir, "site") });
    assert.equal(check.code, 0, check.output);
  });
});
