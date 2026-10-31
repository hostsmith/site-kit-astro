// site-kit-fidelity-cms-stubs design D181, D182: the fidelity check's fill of
// the export's CMS template and collection lists from the CSV exports, as
// step 6's fill file maps them. Webflow's export keeps every bound element
// empty, marked w-dyn-bind-empty, and a list with one item and its empty
// state.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { boundOf, fillPage, readFill, readImages } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/fill.mjs";
import { PACKAGE } from "./helpers.mjs";

const page = (main) => `<!DOCTYPE html><!-- Last Published: Sun Oct 18 2026 --><html data-wf-page="p1" data-wf-site="s1" lang="en"><head><meta charset="utf-8"><title>| Acme</title></head><body><main class="main-wrapper">${main}</main></body></html>`;

// A post's template: six bound elements, the date and author in a row with
// fixed text between them, and the body's rich text.
const TEMPLATE = page(`<section class="section_post-header"><div class="padding-global"><div class="post-header_component">
<a href="blog.html" class="back-link">← All articles</a>
<h1 class="heading-style-h2 w-dyn-bind-empty"></h1>
<p class="text-size-large w-dyn-bind-empty"></p>
<div class="post-header_meta"><p class="text-size-small w-dyn-bind-empty"></p><p class="text-size-small">by</p><p class="text-size-small w-dyn-bind-empty"></p></div>
</div></div></section>
<section class="section_post"><div class="post_image-wrapper"><img src="" alt="" class="image-cover w-dyn-bind-empty"></div>
<div class="post_rich-text w-dyn-bind-empty w-richtext"></div></section>`);

// A list of cards: an image, a date, a title and a summary.
const list = (items) => `<div class="w-dyn-list"><div role="list" class="blog-list_list w-dyn-items"><div role="listitem" class="blog-list_item w-dyn-item">
<a href="#" class="card_link w-inline-block"><div class="card_image"><img src="" alt="" class="image-cover w-dyn-bind-empty"></div>
<div class="card_meta w-dyn-bind-empty"></div><h3 class="heading-style-h5 w-dyn-bind-empty"></h3><p class="text-size-small w-dyn-bind-empty"></p></a>
</div></div><div class="blog-list_empty w-dyn-empty"><div>No items found.</div></div></div>${items}`;
// The home page: a list of posts, and one of the team, three elements each.
const HOME = page(`<section class="section_blog">${list("")}</section>
<section class="section_team"><div class="w-dyn-list"><div role="list" class="team_list w-dyn-items"><div role="listitem" class="team_item w-dyn-item">
<img src="" alt="" class="team_photo w-dyn-bind-empty"><h3 class="team_name w-dyn-bind-empty"></h3><p class="team_role w-dyn-bind-empty"></p>
</div></div><div class="team_empty w-dyn-empty"><div>No items found.</div></div></div></section>`);

const csv = (rows) => `${rows.map((row) => row.map((value) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)).join(",")).join("\n")}\n`;
const BODY = `<h2>Looms, then desks</h2><p onclick="steal()">The mill <a href="https://example.com" onmouseover="x()">ran</a> until 1971.</p><figure class="w-richtext-figure-type-image"><div><img src="https://cdn.example.com/64f1_64f2_acme-floor.jpeg" alt="The floor" srcset="https://cdn.example.com/64f1_64f2_acme-floor-p-500.jpeg 500w"></div></figure><div class="w-embed w-iframe"><iframe src="https://www.youtube.com/embed/abc" title="Tour"></iframe></div><script>alert(1)</script><style>body { display: none }</style>`;
const POSTS = csv([
  ["Name", "Slug", "Collection ID", "Summary", "Main Image", "Published Date", "Author", "Body"],
  ["From Mill to Workspace", "from-mill", "c1", "Looms & desks.", "https://cdn.example.com/64f1_64f3_acme-mill.jpeg", "Tue Aug 25 2026 09:00:00 GMT+0000 (Coordinated Universal Time)", "hollis", BODY],
  ["The Calendar", "calendar", "c1", "Events <weekly>.", "", "Tue Sep 15 2026 09:00:00 GMT+0000 (Coordinated Universal Time)", "ines", "<p>Events.</p>"],
  ["Winter", "winter", "c1", "Frost.", "https://cdn.example.com/64f1_64f4_acme-winter.jpeg", "not a date", "nobody", "<p>Cold.</p>"],
]);
const TEAM = csv([
  ["Name", "Slug", "Role", "Photo"],
  ["Hollis Whitcomb", "hollis", "Founder", ""],
  ["Ines Calloway", "ines", "Community", "https://cdn.example.com/64f1_64f5_ines.jpeg"],
]);
const IMAGES = `https://cdn.example.com/64f1_64f3_acme-mill.jpeg acme-mill.jpg
https://cdn.example.com/64f1_64f2_acme-floor.jpeg acme-floor.jpg
https://cdn.example.com/64f1_64f5_ines.jpeg ines.jpg
`;
const POSTS_CSV = "acme - Blog Posts - 64f1.csv";
const TEAM_CSV = "acme - Team - 64f2.csv";
const DATE = { month: "long", day: "numeric", year: "numeric" };
const TEMPLATE_FIELDS = ["Name", "Summary", { column: "Published Date", date: DATE }, { column: "Author", ref: { csv: TEAM_CSV, column: "Name" } }, "Main Image", "Body"];
const CARD_FIELDS = ["Main Image", { column: "Published Date", date: { month: "short", day: "numeric" } }, "Name", "Summary"];
const FILL = {
  templates: { "detail_blog.html": { csv: POSTS_CSV, fields: TEMPLATE_FIELDS } },
  lists: {
    "index.html": [
      { csv: POSTS_CSV, entries: ["calendar", "from-mill"], fields: CARD_FIELDS },
      { csv: TEAM_CSV, entries: ["hollis", "ines"], fields: ["Photo", "Name", "Role"] },
    ],
  },
};

describe("the fill of the export's CMS pages", () => {
  let dir;
  let images;
  const fill = (html, file, buildPath, changes = {}) => fillPage(html, { file, buildPath, fill: { ...FILL, ...changes }, cms: join(dir, "cms"), images });

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "site-kit-fill-"));
    await mkdir(join(dir, "cms"));
    await writeFile(join(dir, "cms", POSTS_CSV), POSTS);
    await writeFile(join(dir, "cms", TEAM_CSV), TEAM);
    await writeFile(join(dir, "cms-images.txt"), IMAGES);
    await writeFile(join(dir, "fill.json"), JSON.stringify(FILL));
    images = readImages(join(dir, "cms-images.txt"));
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("finds a template's empty elements, and each list's, in their order in the page", () => {
    const template = boundOf(TEMPLATE);
    assert.deepEqual(template.template.map((element) => element.label), ["h1.heading-style-h2", "p.text-size-large", "p.text-size-small", "p.text-size-small", "img.image-cover", ".post_rich-text.w-richtext"]);
    assert.equal(template.template[3].path, "section.section_post-header > .padding-global > .post-header_component > .post-header_meta > p.text-size-small");
    const home = boundOf(HOME);
    assert.deepEqual(home.template, []);
    assert.deepEqual(home.lists.map((found) => found.elements.length), [4, 3]);
  });

  it("fills a template with six elements from its entry's six fields", () => {
    const { html, parts, images: used, unmapped } = fill(TEMPLATE, "detail_blog.html", "/blog/from-mill");
    assert.deepEqual(parts.map(({ part, filled, problem }) => ({ part, filled, problem })), [{ part: "template", filled: true, problem: undefined }]);
    assert.match(html, /<h1 class="heading-style-h2">From Mill to Workspace<\/h1>/);
    assert.match(html, /<p class="text-size-large">Looms &amp; desks\.<\/p>/);
    assert.match(html, /<p class="text-size-small">August 25, 2026<\/p><p class="text-size-small">by<\/p><p class="text-size-small">Hollis Whitcomb<\/p>/);
    assert.match(html, /<img src="\/__fill\/assets\/images\/acme-mill\.jpg" alt="" class="image-cover">/);
    assert.deepEqual(used, ["acme-floor.jpg", "acme-mill.jpg"]);
    assert.deepEqual(unmapped, []);
    assert.deepEqual(parts[0].map, ["h1.heading-style-h2 = Name", "p.text-size-large = Summary", "p.text-size-small = Published Date (date)", "p.text-size-small = Author > Name", "img.image-cover = Main Image", ".post_rich-text.w-richtext = Body"]);
    // Everything else stays as it was.
    assert.equal(html.replace(/<main[\s\S]*<\/main>/, ""), TEMPLATE.replace(/<main[\s\S]*<\/main>/, ""));
    assert.match(html, /<a href="blog\.html" class="back-link">← All articles<\/a>/);
  });

  it("fills rich text without scripts, frames, styles or event attributes, its images from the build", () => {
    const { html } = fill(TEMPLATE, "detail_blog.html", "/blog/from-mill");
    const body = /<div class="post_rich-text w-richtext">([\s\S]*?)<\/div><\/section>/.exec(html)?.[1] ?? assert.fail(html);
    assert.match(body, /^<h2>Looms, then desks<\/h2><p>The mill <a href="https:\/\/example\.com">ran<\/a> until 1971\.<\/p>/);
    assert.match(body, /<img src="\/__fill\/assets\/images\/acme-floor\.jpg" alt="The floor">/);
    assert.doesNotMatch(body, /<iframe|<script|<style|onclick|onmouseover|srcset|alert/);
  });

  it("serves a template unfilled when five fields name its six elements, naming the sixth", () => {
    const { html, parts } = fill(TEMPLATE, "detail_blog.html", "/blog/from-mill", { templates: { "detail_blog.html": { csv: POSTS_CSV, fields: TEMPLATE_FIELDS.slice(0, 5) } } });
    assert.equal(html, TEMPLATE);
    assert.equal(parts[0].filled, false);
    assert.equal(parts[0].problem, "the fill file names 5 fields for its 6 empty elements: the 6th, section.section_post > .post_rich-text.w-richtext, has none");
  });

  it("names a field with no element, a missing entry, a missing column and a value that isn't a date", () => {
    const seven = fill(TEMPLATE, "detail_blog.html", "/blog/from-mill", { templates: { "detail_blog.html": { csv: POSTS_CSV, fields: [...TEMPLATE_FIELDS, "Author"] } } });
    assert.match(seven.parts[0].problem, /names 7 fields for the template's 6 empty elements: the 7th, Author, has no element/);
    assert.match(fill(TEMPLATE, "detail_blog.html", "/blog/gone").parts[0].problem, /has no entry with the Slug "gone", the last part of \/blog\/gone/);
    const column = fill(TEMPLATE, "detail_blog.html", "/blog/from-mill", { templates: { "detail_blog.html": { csv: POSTS_CSV, fields: ["Title", ...TEMPLATE_FIELDS.slice(1)] } } });
    assert.match(column.parts[0].problem, /the 1st field, for section\.section_post-header > [^:]+ > h1\.heading-style-h2: its CSV has no column "Title"/);
    assert.match(fill(TEMPLATE, "detail_blog.html", "/blog/winter").parts[0].problem, /the 3rd field, [^:]+: "Published Date" holds "not a date", which isn't a date/);
    assert.match(fillPage(TEMPLATE, { file: "detail_blog.html", buildPath: "/blog/from-mill", cms: join(dir, "cms") }).parts[0].problem, /there's no fill file yet/);
  });

  it("leaves an element the fill file gives null, and a reference to no entry, empty", () => {
    const { html, parts } = fill(TEMPLATE, "detail_blog.html", "/blog/calendar", { templates: { "detail_blog.html": { csv: POSTS_CSV, fields: ["Name", null, ...TEMPLATE_FIELDS.slice(2)] } } });
    assert.equal(parts[0].filled, true);
    assert.match(html, /<p class="text-size-large w-dyn-bind-empty"><\/p>/);
    // The post has no image: its element stays as exported.
    assert.match(html, /<img src="" alt="" class="image-cover w-dyn-bind-empty">/);
    assert.match(html, /September 15, 2026/);
  });

  it("copies a list's item for each of its entries, in order, and removes its empty state", () => {
    const { html, parts, unmapped } = fill(HOME, "index.html", "/");
    assert.deepEqual(parts.map(({ part, filled }) => [part, filled]), [["list 1", true], ["list 2", true]]);
    assert.doesNotMatch(html, /No items found|w-dyn-empty/);
    // The calendar's post has no image, and Hollis no photo: only those stay empty.
    assert.equal([...html.matchAll(/w-dyn-bind-empty/g)].length, 2);
    const titles = [...html.matchAll(/<h3 class="heading-style-h5">([^<]*)<\/h3>/g)].map((match) => match[1]);
    assert.deepEqual(titles, ["The Calendar", "From Mill to Workspace"]);
    assert.match(html, /<div class="card_meta">Sep 15<\/div><h3 class="heading-style-h5">The Calendar<\/h3><p class="text-size-small">Events &lt;weekly&gt;\.<\/p>/);
    assert.equal([...html.matchAll(/role="listitem" class="team_item w-dyn-item"/g)].length, 2);
    assert.match(html, /<img src="\/__fill\/assets\/images\/ines\.jpg" alt="" class="team_photo"><h3 class="team_name">Ines Calloway<\/h3><p class="team_role">Community<\/p>/);
    assert.deepEqual(unmapped, []);
  });

  it("keeps a list's empty state when it has no entries, as the old site shows it", () => {
    const { html, parts } = fill(HOME, "index.html", "/", { lists: { "index.html": [{ ...FILL.lists["index.html"][0], entries: [] }, FILL.lists["index.html"][1]] } });
    assert.deepEqual(parts.map((part) => part.filled), [true, true]);
    assert.doesNotMatch(html, /blog-list_item/);
    assert.match(html, /<div class="blog-list_empty w-dyn-empty"><div>No items found\.<\/div><\/div>/);
    assert.doesNotMatch(html, /team_empty/);
  });

  it("leaves a page's lists as they are when the fill file names another number of them", () => {
    const { html, parts } = fill(HOME, "index.html", "/", { lists: { "index.html": [FILL.lists["index.html"][0]] } });
    assert.equal(html, HOME);
    assert.deepEqual(parts.map((part) => part.filled), [false, false]);
    assert.match(parts[0].problem, /^the page has 2 collection lists, and the fill file names 1 \(the list section\.section_blog > \.w-dyn-list\)$/);
  });

  it("names an image URL that cms-images.txt doesn't hold, and leaves its image empty", () => {
    const { html, unmapped } = fill(HOME, "index.html", "/", { lists: { "index.html": [{ ...FILL.lists["index.html"][0], entries: ["winter"], fields: ["Main Image", null, "Name", "Summary"] }, FILL.lists["index.html"][1]] } });
    assert.deepEqual(unmapped, ["https://cdn.example.com/64f1_64f4_acme-winter.jpeg"]);
    assert.match(html, /<img src="" alt="" class="image-cover w-dyn-bind-empty">/);
  });

  it("fills every template and list of step 6's example fill file", async () => {
    const step = await readFile(join(PACKAGE, "skills", "migrate-webflow", "steps", "06-cms-to-collections.md"), "utf8");
    const example = JSON.parse(step.split("\n## The fill file\n")[1].match(/```json\n([\s\S]*?)```/)[1]);
    const cms = join(dir, "example");
    await mkdir(cms, { recursive: true });
    const posts = example.templates["detail_blog.html"].csv;
    const team = example.templates["detail_blog.html"].fields[3].ref.csv;
    const row = (slug) => [slug, slug, "A summary.", "Tue Aug 25 2026 09:00:00 GMT+0000 (Coordinated Universal Time)", "hollis", "https://cdn.example.com/64f1_64f3_acme-mill.jpeg", "<p>Body.</p>"];
    await writeFile(join(cms, posts), csv([["Name", "Slug", "Summary", "Published On", "Author", "Main Image", "Post Body"], ...example.lists["index.html"][0].entries.map(row)]));
    await writeFile(join(cms, team), csv([["Name", "Slug"], ["Hollis Whitcomb", "hollis"]]));
    const options = { fill: example, cms, images };
    const template = fillPage(TEMPLATE, { file: "detail_blog.html", buildPath: "/blog/from-mill-to-workspace", ...options });
    const home = fillPage(page(`<section class="section_blog">${list("")}</section>`), { file: "index.html", buildPath: "/", ...options });
    assert.deepEqual([...template.parts, ...home.parts].map(({ part, filled, problem }) => [part, filled, problem]), [["template", true, undefined], ["list 1", true, undefined]]);
    assert.match(template.html, /<p class="text-size-small">Hollis Whitcomb<\/p>/);
  });

  it("reads the fill file, and names what's wrong in it", async () => {
    assert.deepEqual(readFill(join(dir, "fill.json")), FILL);
    assert.equal(readFill(join(dir, "none.json")), undefined);
    await writeFile(join(dir, "bad.json"), JSON.stringify({ lists: { "index.html": [{ csv: POSTS_CSV, entries: "calendar", fields: [] }] } }));
    assert.throws(() => readFill(join(dir, "bad.json")), /bad\.json: the 1st list of index\.html has no "entries" list of slugs\. See the fill file in step 6\./);
    await writeFile(join(dir, "bad.json"), JSON.stringify({ templates: { "detail_blog.html": { csv: POSTS_CSV, fields: [{ name: "Name" }] } } }));
    assert.throws(() => readFill(join(dir, "bad.json")), /the template detail_blog\.html, field 1, is neither a column's name, null, nor an object with "column"/);
  });
});
