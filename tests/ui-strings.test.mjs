// site-kit-ui-strings: the site's interface strings, declared in siteUi and
// written in the settings' `ui` (site-kit-locales design D46).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture } from "./helpers.mjs";

const SCHEMA = "src/site.schema.ts";
const SETTINGS = "src/content/settings/site.en.yml";
const SITE_PART = "public/admin/config.site.yml";

// The site's Decap part with fields for these interface strings.
const withDecapUi = (keys, plural = []) => (part) =>
  `${part}\nui:\n${keys.map((key) => `  - { name: ${key}, label: ${key}, widget: ${plural.includes(key) ? "object, fields: *plural_forms" : "string"} }`).join("\n")}\n`;

// The base fixture's schema with a siteUi export.
const withSiteUi = (declarations) => (schema) =>
  `${schema.replace(/import \{ ([^}]*) \} from "@hostsmith\/site-kit-astro\/schema";/, 'import { $1, uiString } from "@hostsmith/site-kit-astro/schema";')}\nexport const siteUi = {\n${declarations}\n};\n`;

// The base fixture's settings with more `ui` lines.
const withUi = (lines) => (settings) => settings.replace(/^ui:\n/m, `ui:\n${lines}\n`);

async function expectFailure(edit, ...expected) {
  const build = await buildFixture("base", { edit });
  try {
    assert.equal(build.ok, false, "the build should fail");
    for (const text of expected) assert.ok(build.output.includes(text), `output doesn't mention ${JSON.stringify(text)}:\n${build.output}`);
  } finally {
    await build.cleanup();
  }
}

describe("interface strings", () => {
  describe("declared and written", () => {
    let build;
    let post;
    before(async () => {
      build = await buildFixture("base", {
        edit: {
          [SCHEMA]: withSiteUi(
            [
              "  keepReading: uiString(),",
              "  callUs: uiString(),",
              '  phoneLine: uiString({ params: ["phone"] }),',
              '  minRead: uiString({ params: ["minutes"], plural: "minutes" }),',
            ].join("\n"),
          ),
          [SETTINGS]: (settings) =>
            withUi(
              [
                "  keepReading: Keep reading",
                '  callUs: "Questions? Call {phone}."',
                '  phoneLine: "Line: {phone}"',
                "  minRead:",
                '    one: "{minutes} minute"',
                '    other: "{minutes} minutes"',
              ].join("\n"),
            )(settings.replace(/^ui:\n/m, "facts:\n  - name: phone\n    value: (218) 555-0142\nui:\n")),
          [SITE_PART]: withDecapUi(["keepReading", "callUs", "phoneLine", "minRead"], ["minRead"]),
          // The news template shows the strings through the ui export.
          "src/components/collections/news.astro": (template) =>
            template
              .replace('import { render', 'import { getUi } from "@hostsmith/site-kit-astro/ui";\nimport { render')
              .replace("const dateFormat", "const ui = await getUi();\nconst dateFormat")
              .replace(
                "</article>",
                [
                  '  <p id="keep" {...ui.field("keepReading")}>{ui.text("keepReading")}</p>',
                  '  <p id="call">{ui.text("callUs")}</p>',
                  '  <p id="line">{ui.text("phoneLine", { phone: "x100" })}</p>',
                  '  <p id="one">{ui.text("minRead", { minutes: 1 })}</p>',
                  '  <p id="five">{ui.text("minRead", { minutes: 5 })}</p>',
                  "</article>",
                ].join("\n"),
              ),
        },
      });
      if (build.ok) post = await build.read("news/first/index.html");
    });
    after(() => build.cleanup());

    it("builds", () => assert.ok(build.ok, build.output));

    it("renders a label with its field attribute", () => {
      assert.match(post, /<p id="keep" data-field="settings\/site\.en#ui\.keepReading">Keep reading<\/p>/);
    });

    it("fills facts at build time and parameters from site code", () => {
      assert.match(post, /<p id="call">Questions\? Call \(218\) 555-0142\.<\/p>/);
      assert.match(post, /<p id="line">Line: x100<\/p>/, "a parameter named like a fact is the template's to fill");
    });

    it("picks the plural form by the language", () => {
      assert.match(post, /<p id="one">1 minute<\/p>/);
      assert.match(post, /<p id="five">5 minutes<\/p>/);
    });
  });

  it("fail when site code asks for an unknown key, naming the keys", () =>
    expectFailure(
      {
        "src/components/collections/news.astro": (template) =>
          template
            .replace('import { render', 'import { getUi } from "@hostsmith/site-kit-astro/ui";\nimport { render')
            .replace("</article>", '  <p>{(await getUi()).text("keepReadng")}</p>\n</article>'),
      },
      'Unknown interface string "keepReadng"',
      "skipLink",
    ));

  it("fail on a declared key without a value, naming it and the settings", () =>
    expectFailure(
      { [SCHEMA]: withSiteUi("  writtenBy: uiString(),"), [SITE_PART]: withDecapUi(["writtenBy"]) },
      "site.en.yml",
      'missing "writtenBy", declared in siteUi in src/site.schema.ts',
    ));

  it("fail on a declared key without a Decap field, naming config.site.yml", () =>
    expectFailure(
      { [SCHEMA]: withSiteUi("  keepReading: uiString(),"), [SETTINGS]: withUi("  keepReading: Keep reading") },
      'Interface string "keepReading" is declared in siteUi in src/site.schema.ts, but public/admin/config.site.yml has no field for it',
    ));

  it("fail on a Decap field that siteUi doesn't declare", () =>
    expectFailure({ [SITE_PART]: withDecapUi(["keepReading"]) }, 'public/admin/config.site.yml has a field "keepReading" under "ui"'));

  it("fail on a key that is neither the kit's nor declared, naming src/site.schema.ts", () =>
    expectFailure({ [SETTINGS]: withUi("  backToBlog: Back to the blog") }, '"backToBlog" is neither one of the kit\'s interface strings', "src/site.schema.ts"));

  it("fail on a site key named like a kit key", () =>
    expectFailure({ [SCHEMA]: withSiteUi("  menu: uiString(),") }, 'Interface string "menu" in siteUi in src/site.schema.ts is one of the kit\'s own'));

  it("fail on an unknown placeholder that is neither a parameter nor a fact", () =>
    expectFailure(
      {
        [SCHEMA]: withSiteUi('  minRead: uiString({ params: ["minutes"] }),'),
        [SETTINGS]: withUi('  minRead: "{minuts} min read"'),
        [SITE_PART]: withDecapUi(["minRead"]),
      },
      'unknown fact "{minuts}"',
    ));

  it("fail on a plural string missing a form its language uses", () =>
    expectFailure(
      {
        [SCHEMA]: withSiteUi('  minRead: uiString({ params: ["minutes"], plural: "minutes" }),'),
        // The locale's tag sets the language (site-kit-locales design D54).
        "src/site.config.ts": (text) => text.replace('{ code: "en" }', '{ code: "en", tag: "pl" }'),
        [SETTINGS]: withUi('  minRead:\n    one: "{minutes} minuta"\n    other: "{minutes} minut"'),
        [SITE_PART]: withDecapUi(["minRead"], ["minRead"]),
      },
      "minRead",
      'missing the plural forms "few", "many", which pl uses',
    ));
});
