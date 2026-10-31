// site-kit-interactive-parts and the new types of site-kit-section-library: the
// markup the browser tests (tests/browser/) start from, the build's checks,
// and the interface strings the parts need (site-kit-webflow-example design
// D103 to D108). The browser tests cover the behavior.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildFixture, count } from "./helpers.mjs";

const page = (sections) => `---\ntitle: Test\nsections:\n${sections}---\n`;
const SETTINGS = "src/content/settings/site.en.yml";

// The parts' scripts, each found by the selector it starts from.
const SCRIPTS = {
  tabs: ".sk-tabs:not([data-ready])",
  slider: ".sk-slider:not([data-ready])",
  lightbox: ".sk-gallery:not([data-ready])",
  video: ".sk-video:not([data-ready])",
  embed: ".sk-embed__media:not([data-ready])",
  reveal: 'setAttribute("data-sk-ready"',
};

async function expectFailure(options, ...expected) {
  const build = await buildFixture("base", options);
  await build.cleanup();
  assert.equal(build.ok, false, "the build should fail");
  for (const text of expected) assert.ok(build.output.includes(text), `output doesn't mention ${JSON.stringify(text)}:\n${build.output}`);
}

describe("interactive parts' markup", () => {
  let build;
  before(async () => {
    build = await buildFixture("interactive", { example: "webflow" });
  });
  after(() => build.cleanup());

  it("builds", () => assert.ok(build.ok, build.output));

  it("ship no part's script on a page without one", async () => {
    // Home has a hero without video, rich text and a call to action.
    const home = await build.read("index.html");
    for (const [part, marker] of Object.entries(SCRIPTS)) assert.ok(!home.includes(marker), `the home page has the ${part} script`);
    // An inline script runs where it is, so each instance of a part has its
    // own, after it: the tabs page has two tabs sections. The embed and reveal
    // scripts are the layout's, once per page.
    for (const [path, part, times] of [["tabs/index.html", "tabs", 2], ["slider/index.html", "slider", 1], ["gallery/index.html", "lightbox", 1], ["video/index.html", "video", 2], ["embed/index.html", "embed", 1], ["reveal/index.html", "reveal", 1]]) {
      const html = await build.read(path);
      assert.equal(html.split(SCRIPTS[part]).length - 1, times, `${path} doesn't have the ${part} script ${times} times`);
    }
  });

  it("render tabs in order, the first selected, with a field per prop", async () => {
    const html = await build.read("tabs/index.html");
    const tabs = [...html.matchAll(/<button type="button" role="tab" id="t1b1-tab-(\d)"[^>]*aria-selected="(true|false)"[^>]*>\s*([^<]+?)\s*</g)].map((m) => [m[1], m[2], m[3]]);
    assert.deepEqual(tabs, [
      ["0", "true", "Ground floor"],
      ["1", "false", "Main floor"],
      ["2", "false", "Mezzanine"],
    ]);
    assert.match(html, /<div class="sk-tabs__list" role="tablist" hidden>/, "the tab list is hidden until the script runs");
    for (const field of ["items[0].label", "items[0].title", "items[0].body", "items[1].image", "items[2].link.label"]) {
      assert.ok(html.includes(`data-field="pages/tabs.en#sections[t1b1].${field}"`), `no field ${field}`);
    }
    assert.equal(count(html, /class="sk-tabs__panel"/g), 5, "three panels and two");
  });

  it("render a slider's slides in a list, and its controls hidden until the script runs", async () => {
    const html = await build.read("slider/index.html");
    assert.equal(count(html, /<li class="sk-slider__slide" role="group" aria-label="Slide \d of 4">/g), 4);
    assert.match(html, /<div class="sk-slider__controls" data-status="Slide \{current\} of \{total\}" hidden>/);
    assert.match(html, /<p class="sk-slider__status" aria-live="polite">Slide 1 of 4<\/p>/);
    assert.ok(!html.includes('class="sk-slider__pause"'), "a pause button without autoplay");
  });

  it("render a background video muted and looping, with the image as its poster and no autoplay", async () => {
    const html = await build.read("video/index.html");
    const video = html.match(/<video class="sk-video__media"[^>]*>[\s\S]*?<\/video>/g);
    assert.equal(video.length, 2);
    assert.match(video[0], /^<video class="sk-video__media" muted loop playsinline preload="none" poster="\/assets\/test\/photo\.svg" aria-hidden="true" data-field="pages\/video\.en#sections\[v1b1\]\.video">\s*<source src="\/assets\/test\/clip\.webm" type="video\/webm">\s*<source src="\/assets\/test\/clip\.mp4" type="video\/mp4">/);
    assert.doesNotMatch(html, /<video[^>]*\sautoplay/);
    assert.match(video[1], /aria-label="Gray light moving across a wall"/, "the split's video has the image's alt text");
    assert.match(html, /<button type="button" class="sk-video__button" aria-label="Play the video" data-pause="Pause the video" data-play="Play the video" hidden>/);
    assert.ok(!html.includes('class="sk-hero__media"'), "the hero renders its image too");
  });

  it("render an embed's placeholder, and the frame at once with load: direct", async () => {
    const html = await build.read("embed/index.html");
    assert.match(html, /<button type="button" class="sk-embed__button" data-src="https:\/\/www\.youtube-nocookie\.com\/embed\/3URtTIdnXIk" data-title="A tour of the mill" data-kind="video" hidden>Play video<\/button>/);
    assert.match(html, /<div class="sk-embed__frame sk-embed__frame--4-3"><div class="sk-embed__placeholder"><p class="sk-embed__notice">Loads content from openstreetmap\.org<\/p>/);
    assert.match(html, /<iframe class="sk-embed__iframe" src="https:\/\/example\.com\/" title="A frame that loads at once" loading="lazy"><\/iframe>/);
    assert.match(html, /<figcaption class="sk-embed__caption" data-field="pages\/embed\.en#sections\[e1m1\]\.caption">A map from OpenStreetMap<\/figcaption>/);
    // No thumbnail, no preconnect: the provider's host is only in the button's data and the link.
    assert.doesNotMatch(html, /<(img|link|script)[^>]*(youtube|vimeo|openstreetmap)/);
  });

  it("put a list section's revealItems on each item, and nothing on a list without it", async () => {
    const html = await build.read("reveal-items/index.html");
    assert.match(html, /<section data-section="team" data-reveal="fade-up"/, "the section's own reveal changed");
    assert.equal(count(html, /<li class="sk-team__member" data-reveal="slide-left">/g), 6);
    const grid = html.slice(html.indexOf('data-section="services-grid"'));
    assert.doesNotMatch(grid.slice(0, grid.indexOf("</section>")), /data-reveal/);
    assert.equal(html.split(SCRIPTS.reveal).length - 1, 1);
  });

  it("render nested nav items: a link and its button, or a button with the label", async () => {
    const html = await build.read("spaces/desks/index.html");
    assert.match(html, /<li class="sk-nav__item"><a href="\/spaces" class="sk-nav__link" data-field="settings\/site\.en#nav\[1\]\.label">\s*Spaces\s*<\/a><button type="button" class="sk-nav__toggle" aria-expanded="true" aria-controls="sk-submenu-1" aria-label="Spaces submenu" data-current hidden>/);
    assert.match(html, /<button type="button" class="sk-nav__toggle" aria-expanded="true" aria-controls="sk-submenu-2"><span data-field="settings\/site\.en#nav\[2\]\.label">Parts<\/span>/);
    assert.match(html, /<a href="\/spaces\/desks" aria-current="page" class="sk-nav__sublink" data-field="settings\/site\.en#nav\[1\]\.children\[0\]\.label">/);
  });
});

// site-kit-content-model, "Portable content dialect": the video link exception
// in a markdown prop, which renderMarkdown renders with the entry's locale.
describe("a video link in a markdown prop", () => {
  it("renders as an embed, and the layout adds its script", async () => {
    const ui = '  embedPlayVideo: Play video\n  embedNotice: "Loads content from {host}"\n  embedOpen: "Open on {host}"\n';
    const build = await buildFixture("base", {
      edit: { [SETTINGS]: (text) => text.replace(/^ui:\n/m, `ui:\n${ui}`) },
      files: {
        "src/content/pages/video.en.md": page(
          "  - id: r1v1\n    type: rich-text\n    body: |-\n      Watch [the tour](https://youtu.be/3URtTIdnXIk) or read on.\n\n      [The tour of the mill](https://youtu.be/3URtTIdnXIk)\n",
        ),
      },
    });
    try {
      assert.ok(build.ok, build.output);
      const html = await build.read("video/index.html");
      assert.match(html, /<p>Watch <a href="https:\/\/youtu\.be\/3URtTIdnXIk">the tour<\/a> or read on\.<\/p>/);
      assert.match(html, /data-src="https:\/\/www\.youtube-nocookie\.com\/embed\/3URtTIdnXIk" data-title="The tour of the mill"/);
      assert.match(html, /<a href="https:\/\/youtu\.be\/3URtTIdnXIk" class="sk-embed__link">Open on youtube\.com<\/a>/);
      assert.equal(html.split(SCRIPTS.embed).length - 1, 1);
    } finally {
      await build.cleanup();
    }
  });

  it("fails without the embed's strings, naming them and the settings file", () =>
    expectFailure(
      { files: { "src/content/pages/video.en.md": page("  - id: r1v1\n    type: rich-text\n    body: '[A tour](https://vimeo.com/76979871)'\n") } },
      'src/content/settings/site.en.yml has no "embedPlayVideo", "embedNotice", "embedOpen" under "ui"',
    ));
});

// site-kit-interactive-parts, "Embeds load on a click": the site's embedLoad
// (site-kit-webflow-migration design D196).
describe("embedLoad", () => {
  const setting = (value) => ({ "src/site.config.ts": (text) => text.replace("  collections: {", `  embedLoad: ${JSON.stringify(value)},\n  collections: {`) });

  it('loads an entry body\'s video links, a markdown prop\'s, and every embed without load at once with "direct", and keeps load: click', async () => {
    const build = await buildFixture("interactive", {
      example: "webflow",
      edit: { ...setting("direct"), "src/content/pages/embed.en.md": (text) => text.replace('    aspect: "21:9"\n', '    aspect: "21:9"\n    load: click\n') },
      files: { "src/content/pages/prop-video.en.md": page("  - id: r1v1\n    type: rich-text\n    body: |-\n      [The tour of the mill](https://youtu.be/3URtTIdnXIk)\n") },
    });
    try {
      assert.ok(build.ok, build.output);
      const post = await build.read("news/video-post/index.html");
      assert.match(post, /<iframe class="sk-embed__iframe" src="https:\/\/www\.youtube-nocookie\.com\/embed\/3URtTIdnXIk" title="A tour of the mill" loading="lazy" allow=/);
      assert.match(post, /<iframe class="sk-embed__iframe" src="https:\/\/player\.vimeo\.com\/video\/76979871\?[^"]*dnt=1[^"]*" title="A Vimeo video"/);
      assert.match(post, /<p>A paragraph with <a href="https:\/\/www\.youtube\.com\/watch\?v=3URtTIdnXIk">a video link in running text<\/a>/);
      assert.doesNotMatch(post, /sk-embed__placeholder/);
      assert.equal(post.split(SCRIPTS.embed).length - 1, 0, "a page without a placeholder gets no embed script");
      const prop = await build.read("prop-video/index.html");
      assert.match(prop, /<iframe class="sk-embed__iframe" src="https:\/\/www\.youtube-nocookie\.com\/embed\/3URtTIdnXIk" title="The tour of the mill"/);
      const embeds = await build.read("embed/index.html");
      assert.match(embeds, /<iframe class="sk-embed__iframe" src="https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=[^"]*" title="The map" loading="lazy">/);
      assert.match(embeds, /<iframe class="sk-embed__iframe" src="https:\/\/www\.youtube-nocookie\.com\/embed\/3URtTIdnXIk" title="A tour of the mill"/);
      assert.match(embeds, /data-src="https:\/\/player\.vimeo\.com\/video\/76979871\?[^"]*" data-title="A Vimeo video" data-kind="video" hidden>Play video<\/button>/);
      assert.equal(embeds.split(SCRIPTS.embed).length - 1, 1);
    } finally {
      await build.cleanup();
    }
  });

  it('builds with "click" as without the setting', async () => {
    const [plain, click] = await Promise.all([buildFixture("interactive", { example: "webflow" }), buildFixture("interactive", { example: "webflow", edit: setting("click") })]);
    try {
      assert.ok(click.ok, click.output);
      for (const path of ["embed/index.html", "news/video-post/index.html"]) assert.equal(await click.read(path), await plain.read(path), path);
    } finally {
      await Promise.all([plain.cleanup(), click.cleanup()]);
    }
  });

  it("fails the build on an unknown value, naming the allowed ones", () =>
    expectFailure({ edit: setting("lazy") }, 'embedLoad in src/site.config.ts is "lazy". It is "click", the default, or "direct".'));
});

// site-kit-interactive-parts, "Interface strings of interactive parts".
describe("interactive parts' interface strings", () => {
  const slider = "  - id: w1f1\n    type: slider\n    slides:\n      - { title: One }\n      - { title: Two }\n";
  const strings = ["sliderPrevious: Previous slide", "sliderNext: Next slide", 'sliderStatus: "Slide {current} of {total}"'];

  it("are optional: a site without them builds", async () => {
    // The base fixture's settings have none of them.
    const build = await buildFixture("base");
    await build.cleanup();
    assert.ok(build.ok, build.output);
  });

  it("are required by a page that renders a part, naming the key and the settings file", async () => {
    const withStrings = (lines) => (text) => text.replace(/^ui:\n/m, `ui:\n${lines.map((line) => `  ${line}\n`).join("")}`);
    const build = await buildFixture("locales", {
      edit: {
        [SETTINGS]: withStrings(strings),
        "src/content/settings/site.de.yml": withStrings(strings.filter((line) => !line.startsWith("sliderNext"))),
      },
      files: { "src/content/pages/slides.en.md": page(slider), "src/content/pages/slides.de.md": page(slider) },
    });
    await build.cleanup();
    assert.equal(build.ok, false);
    assert.match(build.output, /src\/content\/settings\/site\.de\.yml has no "sliderNext" under "ui"\. A slider on this page needs it\./);
  });

  it("keep their parameters as written, while facts fill", async () => {
    const build = await buildFixture("base", {
      edit: { [SETTINGS]: (text) => text.replace(/^ui:\n/m, `facts:\n  - name: total\n    value: Wrong\nui:\n${strings.map((line) => `  ${line}\n`).join("")}`) },
      files: { "src/content/pages/slides.en.md": page(slider) },
    });
    try {
      assert.ok(build.ok, build.output);
      assert.match(await build.read("slides/index.html"), /<p class="sk-slider__status" aria-live="polite">Slide 1 of 2<\/p>/);
    } finally {
      await build.cleanup();
    }
  });
});

describe("invalid interactive parts fail the build", () => {
  const files = (sections) => ({ files: { "src/content/pages/test.en.md": page(sections) } });

  it("names a tabs section with one item, a slider that rotates too fast and an unknown reveal", () =>
    expectFailure(
      files(
        [
          "  - id: t1b1",
          "    type: tabs",
          "    items: [{ label: Only one }]",
          "  - id: w1f1",
          "    type: slider",
          "    slides: [{ title: One }]",
          "    autoplay: 1",
          "  - { id: r1v1, type: rich-text, body: Text, reveal: bounce }",
          "",
        ].join("\n"),
      ),
      'section "t1b1" (tabs): prop "items": needs at least 2 items',
      'section "w1f1" (slider): prop "autoplay": is the seconds between slides, at least 3',
      'section "r1v1" (rich-text): prop "reveal" has the value "bounce", expected one of "fade", "fade-up", "fade-down", "slide-left", "slide-right", "scale"',
    ));

  it("names an unknown revealItems, and revealItems on a section without a list", () =>
    expectFailure(
      files("  - { id: t1m1, type: team, items: [{ name: Ada }], revealItems: bounce }\n  - { id: r1v1, type: rich-text, body: Text, revealItems: fade }\n"),
      'section "t1m1" (team): prop "revealItems" has the value "bounce", expected one of "fade", "fade-up", "fade-down", "slide-left", "slide-right", "scale"',
      'section "r1v1" (rich-text): unknown prop "revealItems"',
    ));

  it("names an embed on http, and a video embed of another player", () =>
    expectFailure(
      files("  - { id: e1m1, type: embed, title: Map, url: 'http://example.com/map', kind: map }\n  - { id: e2v2, type: embed, title: Video, url: 'https://example.com/v.mp4', kind: video }\n"),
      `section "e1m1" (embed): prop "url": "http://example.com/map" doesn't use https`,
      `section "e2v2" (embed): prop "url": "https://example.com/v.mp4" isn't a YouTube or Vimeo video`,
    ));

  it("names a video without a poster, and a video on another hero variant", () =>
    expectFailure(
      files(
        [
          "  - { id: h1v1, type: hero, title: One, video: /assets/test/photo.svg, variant: background }",
          "  - { id: h2v2, type: hero, title: Two, image: /assets/test/photo.svg, imageAlt: A photo, video: /assets/test/clip.mp4, variant: centered }",
          "",
        ].join("\n"),
      ),
      'section "h1v1" (hero): prop "video" must be an .mp4 file',
      'section "h1v1" (hero): prop "video" needs "image", the poster that shows until the video plays',
      'section "h2v2" (hero): prop "video" goes only with variant "background", not "centered"',
    ));

  it("names a nav item without a link or children, and a child with children", () =>
    expectFailure(
      {
        edit: {
          [SETTINGS]: (text) =>
            text.replace(
              "  - label: News\n    link: /news\n",
              "  - label: News\n    link: /news\n  - label: Empty\n  - label: Deep\n    children:\n      - label: Child\n        link: /about\n        children:\n          - { label: Grandchild, link: /news }\n",
            ),
        },
      },
      "site.en.yml",
      'nav item "Empty" has neither a "link" nor "children"',
      'nav item "Child" is a child with children of its own',
    ));
});
