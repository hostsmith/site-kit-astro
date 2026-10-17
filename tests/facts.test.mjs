// site-kit-content-model, "Facts fill placeholders".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture } from "./helpers.mjs";

const SETTINGS_FILE = "src/content/settings/site.yml";
const FACTS = 'facts:\n  - name: phone\n    value: "+1 555 0100"\n  - name: email\n    value: test@example.com\n';

// The base fixture's settings with facts, and its phone action using one.
const withFacts = (text) => text.replace('      number: "+1 555 0100"\n', '      number: "{phone}"\n') + FACTS;

const page = (sections) => `---\ntitle: Facts\nsections:\n${sections}---\n`;
const post = (body) => `---\ntitle: Call us\ndate: "2026-10-01"\n---\n\n${body}\n`;

async function expectFailure(files, edit, ...messages) {
  const build = await buildFixture("base", { files, edit: { [SETTINGS_FILE]: edit } });
  try {
    assert.equal(build.ok, false, "the build succeeded");
    for (const message of messages) assert.ok(build.output.includes(message), `output lacks ${JSON.stringify(message)}:\n${build.output}`);
  } finally {
    await build.cleanup();
  }
}

describe("facts", () => {
  let build;
  before(async () => {
    build = await buildFixture("base", {
      edit: { [SETTINGS_FILE]: withFacts },
      files: {
        "src/content/pages/facts.md": page(
          [
            "  - id: f1h0",
            "    type: hero",
            "    title: Talk to us",
            "    subtitle: Call {phone}.",
            "  - id: f2l0",
            "    type: hours-location",
            '    phone: "{phone}"',
            '    email: "{email}"',
            "",
          ].join("\n"),
        ),
        "src/content/news/facts.md": post("Call {phone}. In a template, write `{phone}`."),
      },
    });
  });
  after(() => build.cleanup());

  it("fill one number in a header action, a page and a post", async () => {
    assert.ok(build.ok, build.output);
    assert.match(await build.read("index.html"), /<a href="tel:\+15550100" class="sk-header__phone"[^>]*>\s*\+1 555 0100\s*<\/a>/);
    assert.match(await build.read("facts/index.html"), /Call \+1 555 0100\./);
    assert.match(await build.read("news/facts/index.html"), /Call \+1 555 0100\./);
  });

  it("fill before validation, so a filled email passes as an email", async () => {
    const html = await build.read("facts/index.html");
    assert.match(html, /<a href="mailto:test@example\.com" class="sk-hours-location__contact-link"/);
    assert.match(html, /<a href="tel:\+15550100" class="sk-hours-location__contact-link"/);
  });

  it("leave code as written", async () => {
    assert.match(await build.read("news/facts/index.html"), /<code>\{phone\}<\/code>/);
  });

  it("fail on an unknown fact in frontmatter, naming the file, the field and the facts", () =>
    expectFailure(
      { "src/content/pages/facts.md": page("  - id: f1h0\n    type: hero\n    title: Talk\n    subtitle: Call {phnoe}.\n") },
      withFacts,
      "pages → facts",
      "sections.0.subtitle",
      'unknown fact "{phnoe}". The facts are {phone}, {email}.',
    ));

  it("fail on an unknown fact in a Markdown body, naming the file", () =>
    expectFailure({ "src/content/news/facts.md": post("Call {phnoe}.") }, withFacts, "src/content/news/facts.md", 'unknown fact "{phnoe}"'));

  it("fail on an unknown fact without any facts", () =>
    expectFailure({}, (text) => text.replace('      number: "+1 555 0100"\n', '      number: "{phone}"\n'), 'unknown fact "{phone}". The settings have no facts.'));

  it("fail on duplicate names", () => expectFailure({}, (text) => withFacts(text) + '  - name: phone\n    value: "+1 555 0199"\n', 'duplicate fact "phone"'));

  it("fail on a placeholder in a fact's value", () =>
    expectFailure({}, (text) => withFacts(text) + "  - name: line\n    value: Call {phone}\n", "can't hold a placeholder"));
});
