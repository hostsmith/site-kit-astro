// site-kit-sections, "Design tokens".
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { buildFixture, htmlFiles } from "./helpers.mjs";

const TOKENS = ["bg", "fg", "primary", "primary-fg", "accent", "muted", "border"];

describe("design tokens", () => {
  let build;
  let css;
  before(async () => {
    build = await buildFixture("base", {
      files: { "src/pages/palette.astro": '<html lang="en"><body><p class="bg-red-500 text-primary">Palette</p></body></html>\n' },
    });
    const files = (await readdir(build.dist, { recursive: true })).filter((f) => f.endsWith(".css"));
    css = (await Promise.all(files.map((f) => build.read(f)))).join("\n");
  });
  after(() => build.cleanup());

  it("builds", () => assert.ok(build.ok, build.output));

  it("defines no default palette colors", () => {
    assert.doesNotMatch(css, /--color-(red|blue|green|gray|slate|white|black)\b/);
    const defined = [...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    for (const name of defined) assert.ok(TOKENS.includes(name), `--color-${name} is not a kit token`);
  });

  it("renders nothing for a default palette utility", () => {
    assert.ok(!css.includes(".bg-red-500"), "bg-red-500 produced a rule");
    assert.ok(css.includes(".text-primary"), "token utilities still work");
  });

  it("loads fonts only from /assets/fonts/", async () => {
    const fontUrls = [...css.matchAll(/url\(["']?([^)"']+\.(woff2?|ttf|otf))["']?\)/g)].map((m) => m[1]);
    assert.ok(fontUrls.length > 0, "no font is loaded");
    for (const url of fontUrls) assert.ok(url.startsWith("/assets/fonts/"), `font loaded from ${url}`);
    for (const file of await htmlFiles(build.dist)) {
      assert.doesNotMatch(await build.read(file), /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny/, `${file} loads a third-party font`);
    }
  });
});
