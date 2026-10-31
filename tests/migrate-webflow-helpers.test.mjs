// site-kit-migration-cost design D147: the migration skill's helpers that
// keep the export's pages, its stylesheets and the kit's schema out of the
// agent's context.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { query, rulesOf } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/css-rules.mjs";
import { compactStyle, notes, outline } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/outline.mjs";
import { props } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/props.mjs";
import { EXAMPLES, PACKAGE, run } from "./helpers.mjs";

const SCRIPTS = join(PACKAGE, "skills", "migrate-webflow", "scripts");
const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const IX_STYLE = "opacity:0;-webkit-transform:translate3d(0, 20PX, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-moz-transform:translate3d(0, 20PX, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);transform:translate3d(0, 20PX, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0)";
const HEADER = `<header class="navbar_component"><div class="padding-global"><div class="container-large"><div class="navbar_container">
  <a href="index.html" aria-current="page" class="navbar_logo-link w-inline-block w--current"><img src="images/logo.svg" alt="The Mill" class="navbar_logo"></a>
  <nav class="navbar_menu w-nav-menu"><a href="membership.html" class="navbar_link w-nav-link">Membership</a><a href="about.html" class="navbar_link w-nav-link">About the mill and its people</a><a href="contact.html" class="navbar_link w-nav-link">Contact us today</a></nav>
  <div class="menu-button w-nav-button"><div class="w-icon-nav-menu"></div></div>
</div></div></div></header>`;
const page = (title, main) => `<!DOCTYPE html><html data-wf-page="abc" data-wf-site="def"><head><meta charset="utf-8"><title>${title}</title>
<meta content="Desks in an old mill." name="description"><meta content="/images/og.jpg" property="og:image">
<link href="css/site.webflow.css" rel="stylesheet" type="text/css"><link href="https://fonts.googleapis.com" rel="preconnect">
<script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" type="text/javascript"></script>
<script type="text/javascript">WebFont.load({ google: { families: ["Space Grotesk:400,700"] } });</script>
<script type="text/javascript">!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js"}(window,document);</script>
</head><body>${HEADER}<main class="main-wrapper">${main}</main>
<script src="https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js?site=def" type="text/javascript"></script><script src="js/webflow.js" type="text/javascript"></script>
<script>console.log("chat widget");</script></body></html>`;

const HOME = page(
  "The Mill",
  `<section class="section_hero"><div class="padding-global"><div class="container-large"><div class="hero_component">
    <h1 class="heading-style-h1">A <span class="text-color-accent">brighter</span> place to work,<br>right here.</h1>
    <p data-w-id="6a0b2c1d-0000-1111-2222-333344445555" style="${IX_STYLE}" class="text-size-large">Hot desks &amp; private offices.</p>
    <a href="contact.html" class="button w-button">Book a tour</a>
    <img src="images/floor.jpg" loading="lazy" srcset="images/floor-p-500.jpg 500w, images/floor.jpg 1200w" sizes="100vw" alt="An open floor">
    <svg viewBox="0 0 24 24" class="icon"><path d="M1 1h22v22H1z"></path></svg>
  </div></div></div></section>
  <div class="w-embed"><style>.global { -webkit-font-smoothing: antialiased; }</style></div>
  <section class="section_blog"><div class="w-dyn-list"><div class="w-dyn-empty"><div>No items found.</div></div></div></section>
  <div class="w-form"><form id="wf-form-Tour" name="wf-form-Tour" method="get"><label for="name">Your name</label><input type="text" name="name" placeholder="Jane" required id="name"><input type="submit" value="Send" class="button w-button"></form><div class="w-form-done"><div>Thank you!</div></div></div>`,
);

describe("the outline", () => {
  it("drops vendor prefixes and identity transforms from an interaction's style", () => {
    assert.equal(compactStyle(IX_STYLE), "opacity:0; transform:translate3d(0, 20px, 0)");
    assert.equal(compactStyle("opacity:1;-webkit-transform:none"), "opacity:1");
  });

  it("shows a page's head, and each element that matters on one line", () => {
    const text = outline(HOME, "index.html");
    const lines = text.split("\n");
    assert.deepEqual(lines.slice(0, 6), [
      "# index.html",
      "title: The Mill",
      "description: Desks in an old mill.",
      "og:image: /images/og.jpg",
      "head: script https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js",
      `head: script "WebFont.load({ google: { families: [\\"Space Grotesk:400,700\\"] } });" (66 characters)`,
    ]);
    assert.ok(lines.includes("header.navbar_component > .padding-global > .container-large > .navbar_container"), text);
    assert.ok(lines.includes("  section.section_hero > .padding-global > .container-large > .hero_component"), text);
    assert.ok(lines.includes('    h1.heading-style-h1 "A {span.text-color-accent: brighter} place to work,{br}right here."'), text);
    assert.ok(lines.includes('    p.text-size-large data-w-id=6a0b2c1d-0000-1111-2222-333344445555 style "opacity:0; transform:translate3d(0, 20px, 0)" "Hot desks & private offices."'), text);
    assert.ok(lines.includes('    a.button.w-button contact.html "Book a tour"'), text);
    assert.ok(lines.includes('    img images/floor.jpg alt "An open floor"'), text);
    assert.ok(lines.includes('    svg.icon viewBox "0 0 24 24"'), text);
    assert.ok(lines.includes("  .w-embed > style (48 characters)"), text);
    assert.ok(lines.includes('  section.section_blog > .w-dyn-list > .w-dyn-empty > div "No items found."'), text);
    assert.ok(lines.includes('      input#name type=text name=name placeholder "Jane" required'), text);
    assert.ok(lines.includes('script "console.log(\\"chat widget\\");" (27 characters)'), text);
    assert.doesNotMatch(text, /webflow\.js|jquery|w-mod-|srcset|data-wf-|M1 1h22/);
  });

  it("notes a page's scripts, forms, embeds, animated elements and links for step 2", () => {
    const text = notes(HOME, "index.html");
    assert.deepEqual(text.split("\n"), [
      "# index.html",
      "head: script https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js",
      `head: script "WebFont.load({ google: { families: [\\"Space Grotesk:400,700\\"] } });" (66 characters)`,
      ".w-embed > style (48 characters)",
      ".w-form",
      "  form#wf-form-Tour name=wf-form-Tour method=get",
      '    label for=name "Your name"',
      '    input#name type=text name=name placeholder "Jane" required',
      '    input.button.w-button type=submit value "Send"',
      '  .w-form-done > div "Thank you!"',
      'script "console.log(\\"chat widget\\");" (27 characters)',
      'p.text-size-large data-w-id=6a0b2c1d-0000-1111-2222-333344445555 style "opacity:0; transform:translate3d(0, 20px, 0)" "Hot desks & private offices."',
      "links: index.html membership.html about.html contact.html",
      "",
    ]);
  });

  it("shows a block an earlier page printed as the same, whatever page is current", () => {
    const seen = new Map();
    outline(HOME, "index.html", seen);
    const about = page("About", '<section class="section_story"><p class="text-size-large">From twelve desks to three floors.</p></section>').replace('aria-current="page" class="navbar_logo-link w-inline-block w--current"', 'class="navbar_logo-link w-inline-block"').replace('class="navbar_link w-nav-link">About', 'class="navbar_link w-nav-link w--current">About');
    const text = outline(about, "about.html", seen);
    assert.match(text, /^header\.navbar_component > \.padding-global > \.container-large > \.navbar_container … same as in index\.html$/m);
    assert.match(text, /From twelve desks to three floors\./);
    assert.doesNotMatch(text, /navbar_link/);
  });
});

const SITE_CSS = `
:root { --_colors---green: #2e5a45; --_colors---ink: var(--_colors---green); --_size---h1: 4rem; }
body { color: var(--_colors---ink); font-size: 1rem; }
h1, .heading-style-h1 { font-size: var(--_size---h1); line-height: 1.1; }
a:hover { color: var(--_colors---green); }
.button { background: url("data:image/svg+xml;base64,${"A".repeat(200)}"); color: #fff; }
.button.is-secondary:hover { color: var(--_colors---green); }
.buttons { gap: 1rem; }
/* a comment { not: a rule } */
@media screen and (max-width: 991px) {
  body { --_size---h1: 3rem; }
  .button { padding: 0.5rem; }
}
@font-face { font-family: "Space Grotesk"; src: url("../fonts/space.woff2") format("woff2"); }
`;
const WEBFLOW_CSS = `
[class^="w-icon-"] { font-family: 'webflow-icons'; }
h1 { font-size: 38px; margin-top: 20px; }
.w-tab-link { padding: 9px 30px; background-color: #ddd; }
.w-tab-link.w--current { background-color: #C8C8C8; }
`;

describe("the CSS rules", () => {
  const sheets = [
    { name: "site.webflow.css", css: SITE_CSS },
    { name: "webflow.css", css: WEBFLOW_CSS },
  ];

  it("parses rules inside media queries, and declarations with data: URLs", () => {
    const rules = rulesOf(SITE_CSS);
    assert.deepEqual(
      rules.map((rule) => rule.selector ?? rule.atRule),
      [":root", "body", "h1, .heading-style-h1", "a:hover", ".button", ".button.is-secondary:hover", ".buttons", "body", ".button", "@font-face"],
    );
    assert.deepEqual(rules[7].media, ["@media screen and (max-width: 991px)"]);
    assert.equal(rules[4].declarations.length, 2);
  });

  it("prints Webflow's variables, with what each media query sets again", () => {
    const text = query(sheets, { variables: true });
    assert.match(text, /^## site\.webflow\.css\n:root \{ --_colors---green: #2e5a45; --_colors---ink: var\(--_colors---green\); --_size---h1: 4rem \}\n@media screen and \(max-width: 991px\)\n {2}body \{ --_size---h1: 3rem \}$/m);
    assert.doesNotMatch(text, /font-size|^## webflow\.css/m);
  });

  it("prints a class's rules, its combos and states, and the variables they use", () => {
    const text = query(sheets, { classes: ["button", "heading-style-h1"] });
    assert.match(text, /^\.button \{ background: url\(data:image\/svg\+xml\.\.\. \d+ characters\); color: #fff \}$/m);
    assert.match(text, /^\.button\.is-secondary:hover \{ color: var\(--_colors---green\) \}$/m);
    assert.match(text, /^ {2}\.button \{ padding: 0\.5rem \}$/m);
    assert.match(text, /^h1, \.heading-style-h1 \{ font-size: var\(--_size---h1\); line-height: 1\.1 \}$/m);
    assert.doesNotMatch(text, /\.buttons/);
    assert.match(text, /^## Variables they use\n--_size---h1: 4rem, 3rem \(@media screen and \(max-width: 991px\) on body\)\n--_colors---green: #2e5a45$/m);
  });

  it("prints the element rules of both stylesheets, and the builder's defaults for a w- class", () => {
    const elements = query(sheets, { elements: true });
    assert.match(elements, /^body \{ color: var\(--_colors---ink\); font-size: 1rem \}$/m);
    assert.match(elements, /^a:hover \{/m);
    assert.match(elements, /^## webflow\.css\nh1 \{ font-size: 38px; margin-top: 20px \}$/m);
    assert.doesNotMatch(elements, /w-icon|:root/);
    assert.match(query(sheets, { classes: ["w-tab-link"] }), /^\.w-tab-link\.w--current \{ background-color: #C8C8C8 \}$/m);
    assert.match(query(sheets, { fonts: true }), /^@font-face \{ font-family: "Space Grotesk"; src: url\("\.\.\/fonts\/space\.woff2"\) format\("woff2"\); \}$/m);
    assert.match(query(sheets, { classes: ["navbar"] }), /^No rule names \.navbar\.$/m);
  });

  it("reads the stylesheets' folder without normalize.css, the site's first, and a page's <style> blocks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-css-rules-"));
    dirs.push(dir);
    await mkdir(join(dir, "css"));
    await writeFile(join(dir, "css", "webflow.css"), WEBFLOW_CSS);
    await writeFile(join(dir, "css", "site.webflow.css"), SITE_CSS);
    await writeFile(join(dir, "css", "normalize.css"), "h1 { margin: .67em 0; }");
    await writeFile(join(dir, "index.html"), HOME);
    const { code, output } = await run(process.execPath, [join(SCRIPTS, "css-rules.mjs"), "--dir", "css", "--page", "index.html", "--elements", "global"], { cwd: dir });
    assert.equal(code, 0, output);
    assert.ok(output.indexOf("## site.webflow.css") < output.indexOf("## webflow.css"), output);
    assert.match(output, /^## index\.html's <style>\n\.global \{ -webkit-font-smoothing: antialiased \}$/m);
    assert.doesNotMatch(output, /\.67em/);
    const missing = await run(process.execPath, [join(SCRIPTS, "css-rules.mjs"), "--variables"], { cwd: dir });
    assert.equal(missing.code, 1);
    assert.match(missing.output, /\.hostsmith\/snapshot\/code\/css doesn't exist/);
  });
});

describe("the props", () => {
  const schemaFile = join(EXAMPLES, "webflow", ".hostsmith", "schema.json");

  it("lists every section type on a line, with the props they share first", async () => {
    const text = props(JSON.parse(await readFile(schemaFile, "utf8")));
    assert.match(text, /^Every section: id\*, type\*, reveal \(fade \| fade-up/);
    assert.match(text, /^hero: badge, title\*, subtitle, image, imageAlt,/m);
    assert.match(text, /^tabs: .*items\*.*variant$/m);
    assert.ok(text.length < 2000, `${text.length} characters`);
  });

  it("prints a type's props in full, with its hooks, and the settings' actions by type", async () => {
    const schema = JSON.parse(await readFile(schemaFile, "utf8"));
    const tabs = props(schema, ["tabs"]);
    assert.match(tabs, /^items\*: list of 2 or more\n {2}label\*: text\n/m);
    assert.match(tabs, /^ {2}image: \/assets\/ path$/m);
    assert.match(tabs, /^variant: horizontal \(default\) \| vertical$/m);
    assert.match(tabs, /^Hooks \(HOOKS\.md\):$/m);
    assert.match(tabs, /`sk-tabs__tab`/);
    assert.doesNotMatch(tabs, /### slider/);
    const settings = props(schema, ["settings"]);
    assert.match(settings, /^ {4}type "button":\n {6}label\*: text\n {6}link\*: link\n {6}style: primary \(default\) \| secondary\n {6}pinned: true \| false$/m);
    assert.match(props(schema, ["nope"]), /No section type or collection is named nope\. The types: hero,/);
  });

  it("prints a section type and a collection that share a name", () => {
    const object = (properties, required) => ({ type: "object", properties, required });
    const schema = {
      collections: {
        pages: { fields: object({ sections: { type: "array", items: { oneOf: [object({ id: { type: "string" }, type: { type: "string", const: "team" } }, ["id", "type"])] } } }) },
        team: { path: "src/content/team", fields: object({ name: { type: "string" } }, ["name"]) },
      },
    };
    assert.match(props(schema, ["team"]), /^## team\n[\s\S]*\n## team \(src\/content\/team\)\nname\*: text\n$/);
  });

  it("asks for the schema when the site has none yet", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-props-"));
    dirs.push(dir);
    const { code, output } = await run(process.execPath, [join(SCRIPTS, "props.mjs"), "hero"], { cwd: dir });
    assert.equal(code, 1);
    assert.match(output, /\.hostsmith\/schema\.json doesn't exist\. Run `npx site-kit schema`/);
  });
});
