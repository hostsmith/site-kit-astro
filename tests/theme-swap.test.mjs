// site-kit-themes, "A theme is one folder": "Swap a theme" and "Swap to a theme
// that supports fewer types" (site-kit-webflow-example design D109).
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { checkBuilt } from "../packages/site-kit-astro/scripts/check-styles.mjs";
import { buildFixture, EXAMPLES } from "./helpers.mjs";

// An example's theme and fonts, as files for buildFixture().
async function themeFiles(example) {
  const files = {};
  for (const folder of ["src/styles/theme", "public/assets/fonts"]) {
    const dir = join(EXAMPLES, example, folder);
    const names = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
    for (const entry of names.filter((name) => name.isFile())) {
      const path = join(entry.parentPath, entry.name);
      files[path.slice(join(EXAMPLES, example).length + 1)] = await readFile(path);
    }
  }
  return files;
}

const unstyled = (build) => checkBuilt(build.dir).warnings.filter((warning) => warning.kind === "unstyled hook").map((warning) => warning.value);

describe("swapping a theme", () => {
  it("builds a webflow site on the basics theme, which warns about each part it doesn't style", async () => {
    const build = await buildFixture(null, { example: "webflow", files: await themeFiles("basics") });
    try {
      assert.ok(build.ok, build.output);
      const hooks = unstyled(build);
      for (const hook of ["sk-tabs", "sk-tabs__tab", "sk-slider__list", "sk-embed__media", "sk-lightbox", "sk-nav__toggle", "sk-highlight"]) {
        assert.ok(hooks.includes(hook), `no warning about ${hook}`);
      }
      assert.ok(!hooks.includes("sk-hero__title"), "a warning about a hook basics styles");
    } finally {
      await build.cleanup();
    }
  });

  it("builds a basics site on the webflow theme, which styles every part it renders", async () => {
    const build = await buildFixture(null, { files: await themeFiles("webflow") });
    try {
      assert.ok(build.ok, build.output);
      assert.deepEqual(unstyled(build), []);
    } finally {
      await build.cleanup();
    }
  });
});
