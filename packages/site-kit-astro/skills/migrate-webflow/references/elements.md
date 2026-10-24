# Element mapping

Webflow's built-in interactive elements all run on `webflow.js`, which a kit site never loads. The kit replaces each of them with a part of its own (the kit's README, "Interactive parts"). This table maps them, and lists what has no replacement. A person who wants a part to work differently asks for a site-local type: never port Webflow's behavior by hand.

## Structural elements

| Webflow element | In the export | Becomes |
| --- | --- | --- |
| Navbar | `w-nav`, with `w-nav-menu`, `w-nav-link` and `w-nav-button` | the kit's header and menu: `nav` and `header.actions` in the settings (step 4) |
| Dropdown in the navbar | `w-dropdown`, with `w-dropdown-toggle` and `w-dropdown-list` | a `nav` item with `children`, one level deep |
| Dropdown elsewhere | `w-dropdown` outside the navbar | a `faq` item, or the report |
| Tabs | `w-tabs`, with `w-tab-menu`, `w-tab-link`, `w-tab-content` and `w-tab-pane` | a `tabs` section: one item per pane, its link's text as `label`, and the pane's heading, text, image and link as `title`, `body`, `image` and `link`. `vertical` when the menu sits beside the panes |
| Slider | `w-slider`, with `w-slider-mask`, `w-slide`, `w-slider-arrow-left`, `w-slider-arrow-right` and `w-slider-nav` | a `slider` section: one slide per `w-slide`. `autoplay`, in seconds, only when the old slider played by itself (`data-autoplay="true"`, with `data-delay` in milliseconds), and at least 3. `cards` when several slides show at once |
| Lightbox | `w-lightbox`, with its JSON in a `w-json` script | a `gallery` section with `lightbox: true`, its images and captions from the JSON's `items` |
| Background video | `w-background-video`, with `data-video-urls` and `data-poster-url` | `video`, the MP4, and `videoWebm` on a `hero` with the variant `background` or on a `split`, with the poster as its `image` |
| Collection list | `w-dyn-list`, with `w-dyn-items`, `w-dyn-item` and `w-dyn-empty` | a `collection-list` section, or a site-local type when its cards differ (step 6) |
| Pagination | `w-pagination-wrapper`, query strings such as `?a1b2c3d4_page=2` | not carried: the list shows its first page, up to its `limit`. The report lists it |
| Rich Text | `w-richtext` | Markdown in a section's body or an entry's body (step 6, "Rich text") |
| Native accordions | `details` and `summary` | `faq`, or the header's menu when it's the navbar's |

## Embeds

| Webflow element | In the export | Becomes |
| --- | --- | --- |
| Map | `w-widget-map`, or a map provider's `iframe` | an `embed` section, `kind: map` |
| YouTube, Video | `w-embed` or `w-video` with a YouTube or Vimeo `iframe` | an `embed` section, `kind: video`, with the video's page as its `url` |
| Embed with a frame | `w-embed` or `w-iframe` with any other `iframe` | an `embed` section, `kind: other` |
| Video in Rich Text | a `figure` with an `iframe`, `w-richtext-figure-type-video` | a link to the video alone in its paragraph (step 6) |
| Embed with code | `w-embed` with a `script`, a `style` or HTML that isn't a frame | not copied. A `style` is site CSS, ported in step 3. Anything else goes in the report, with its page |

For each frame, the person chooses how it loads, and the report records the choice:

- **On a click,** the default: `load: click`, or no `load`. The page shows a placeholder, and sends nothing to the provider until the visitor asks.
- **Directly:** `load: direct`, only when the site's privacy notice names the provider.
- **Instead, a link or a still image:** a `rich-text` or `split` section that links to the content. The image is a screenshot the person provides.
- **Not at all:** it's dropped, and the report says so.

The frame's `title` becomes the section's `title`, and its aspect ratio its `aspect`: `16:9`, `4:3`, `1:1` or `21:9`, the nearest one. A frame's URL must use `https`.

## Forms

| Webflow element | In the export | Becomes |
| --- | --- | --- |
| Form | `w-form`, with a `form`, `w-input`, `w-select`, `w-checkbox`, `w-radio`, `w-button`, `w-form-done` and `w-form-fail` | not carried yet: the report's "Forms" lists each one, with its fields, options, required flags, button and messages. The kit's contact form comes in a later release. The built pages submit nothing to Webflow |
| Password page | `w-password-page`, in `401.html` | not carried. The report lists it |

## Interactions

Webflow's interactions run in `webflow.js`. Read them as text, by searching the file, and never run, import or load it.

- **IX3,** the current engine: a `register([...], [...])` call, inside a module that calls `Webflow.require("ix3")`. Its first list holds the interactions, each with an `id` such as `i-1a2b3c4d`, its `triggers` and its `timelineIds`. Its second holds the timelines, each with its `actions` and their `properties`. A trigger names its target class like `["wf:class",["section-header_component"],...]`.
- **IX2,** the older engine: `Webflow.require('ix2').init({...})`, with `events` and `actionLists`, and elements marked `data-w-id`.

A simple entrance animation becomes a `reveal` preset:

| What the interaction does | Preset |
| --- | --- |
| fades in: opacity from 0 to 100% | `fade` |
| fades in while moving up: `y` or `yPercent` from a positive value to 0 | `fade-up` |
| fades in while moving down: `y` or `yPercent` from a negative value to 0 | `fade-down` |
| moves in from the right: `x` or `xPercent` from a positive value to 0 | `slide-left` |
| moves in from the left: `x` or `xPercent` from a negative value to 0 | `slide-right` |
| grows in: scale from below 1 to 1 | `scale` |

It's a simple entrance when its trigger is the element scrolling into view or the page loading, it plays once, and its timeline only fades, moves by a small offset or scales to the element's resting state. Put `reveal: <preset>` on each section that carries the targeted class, on the section or on its header, such as `reveal: fade-up` for the sections whose headers are `section-header_component`. On an element of a site-local type's own markup, it's `data-reveal="<preset>"`.

Anything else, such as hover and click effects, scroll-linked movement, loops, sequences, counters and page transitions, isn't carried. The report's "Interactions" lists each interaction with its id, what it did and what was done with it.

Webflow's inline style that hides the targeted elements until its script runs, such as `html.w-mod-js:not(.w-mod-ix3) :is(.section-header_component) {visibility: hidden !important;}`, isn't carried: the kit's reveal hides nothing without its own script, and nothing under reduced motion.

## Not carried

These have no replacement in the kit. Each goes into the report's "Not carried over", with its page:

- any other `w-` element that runs on `webflow.js`;
- site search (`w-form` with `search`, and `search.html`);
- Lottie (`data-animation-type="lottie"`), Rive and Spline animations;
- code components;
- Ecommerce: products, cart and checkout (`w-commerce-*`);
- Memberships and user accounts (`w-user-*`);
- Webflow's Localization switcher, which the kit's `locales` header action or footer block replaces in a localized site.
