---
scope: kit
---

# 5. Pages to sections

Rebuild each static page of the export as a page entry made of sections, keeping its text, its images and their order. Read the element mapping, `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/elements.md`, first.

Read the pages you port as outlines, all in one call, such as `node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/outline.mjs .hostsmith/snapshot/code/index.html .hostsmith/snapshot/code/about.html`, the types with `props.mjs`, and a section's CSS with `css-rules.mjs` and its classes, as the skill's "Read through the helpers" says.

## In two passes

The look most pages share, their type, colors, spacing, buttons, header and footer, is settled once, on a sample, before the rest is built on it. The sections below say how to port each page, in either pass.

1. **A sample first.** Pick two or three pages that between them hold most of the site's kinds of section, the home page first. Port them, copy the images, as step 7 says, since the comparison needs them, then compare them with the export, with step 9's fidelity check limited to them: install its tools as step 9 says, write `.hostsmith/snapshot/fidelity/pages.txt` with every page, marking those you write anew, as "The 404 page" says, build, and run the script with `--only` and the sample's names, such as `--only home,features,pricing`. Open their overviews, and the home page's first slices and ends, and fix the theme until they match. Fix the look in the theme, for every page, never for one page. On a large site with subagents, the subagent that did steps 3 and 4 does the sample too, as the skill's "With subagents" says, and returns the sample's pages and what it settled.
2. **The rest in bulk.** Port the other pages on the settled theme, styling each section from the export's CSS rules, as step 3 says, and run no fidelity check: step 9 compares every page at once, in rounds.
   - **On a large site with subagents,** as the skill's "With subagents" says, port the pages in groups of four or five, so their HTML stays out of your own context, and run the groups side by side, not one after another. First make the types, site variants and Components that more than one group needs, yourself or with one group that goes first. Then start every other group at once, each with its pages, the types and site variants made so far, this step's rules and the element mapping. Each writes its pages' entries and any type or site variant only its pages use, named after what it shows, and returns what it made and what it couldn't carry. The files they share, such as `src/site.config.ts`, `src/site.schema.ts` and `sections.css`, take small edits: an edit that fails because another subagent changed the file is read again and made again. Then build, and check that no two types or site variants do the same: merge those that do.
   - **Otherwise,** port them in turn yourself.

## Split each page

A page built with Client-First is a `page-wrapper` holding the navbar, a `main-wrapper` and the footer. The `main-wrapper` holds the top-level sections, named `section_*`. For each page in the URL map, and for `404.html`:

- **The navbar and the footer** are the layout's, from step 4: skip them.
- **Each top-level section** becomes one section entry, in the export's order.
- **A nested block** that stands on its own, such as a tour block with an image and text inside a steps section, may become a section of its own, after its parent.

Without Client-First, the top-level sections are the direct children of `main`, or of the body, between the navbar and the footer.

## Find Components

Webflow's export writes out each use of a Component and leaves no marker. Before you pick any section's type, look for repeated structures: the same tree of classes in several places, on one page or across pages, with different text, links or images. Each one is a Component.

- **One type:** each becomes one shared type, with the text, links and images that differ as its props, used wherever it appeared.
- **Navbar and footer** are Components too, but they're the layout's.
- **The report:** list each Component in the report's "Components", with the pages it's on.

Expect a call to action band repeated on several pages, and cards repeated in a list, such as the plans on a pricing page.

## Pick each section's type

Give each section the first of these forms that can show it, as the kit's `AGENTS.md` says:

1. **A library type** that renders the elements and fields the section needs. `props.mjs` lists each type's props, and `props.mjs <type>` its props in full, with its variants, tones and hooks. Its look is the theme's work, from step 3: colors, a band, borders, spacing, sizes, type, capitals, decoration, the arrangement of the elements it renders, and where it changes at each width. None of these makes a section site-local. A hero, a call to action, questions and answers, prices, a numbered process, quotes, people or a list of entries often fit. Every library type with a title also takes an `eyebrow`, so Client-First's section header, a small label above the heading, never makes a section site-local by itself.
2. **A library type with a site variant,** when one section should look different from its type's others on the site, such as one FAQ with boxed questions among plain ones: declare it in `siteVariants` in `src/site.config.ts` and set `siteVariant` on the entry, as the kit's `AGENTS.md`, "Site variants", says. Step 3's rules style it.
3. **A site-local type,** only when no library type renders an element the section needs, such as a large portrait beside a testimonial: a variant of a site-local type you've already made, or a new one. List the element in the report's "Site-local types and Components", as a gap of the library type.

Interactive parts stay the kit's: a site variant may restyle a slider or tabs, such as a slider on a colored band with quote marks the theme draws. An element of the old one that the kit's part lacks goes into the report's "Not carried over", never into a site-local copy of the part, unless the person asks for one.

A site-local type is the section's markup from the export, cleaned, with its content in props:

- **The component,** `src/components/sections/site/<type>.astro`: the export's structure, with every `w-` class, every `data-w-` and `data-wf-` attribute and every inline style removed, and its classes renamed after the type, such as `.amenities` and `.amenities__item`.
- **Its props:** every text, link and image, so the CMS can edit them, each bound with its field attribute. Render a title with `Title.astro`, so its `==` marks highlight.
- **The schema:** `section("<type>", { ... })` in `siteSectionSchemas` in `src/site.schema.ts`, with `mediaPath` and `requireAlt` for images, `link` for links and `icon` for icons, from `@hostsmith/site-kit-astro/schema`.
- **The Decap type:** under `section_types` in `public/admin/config.site.yml`, with a field for each prop.
- **The styles:** in `src/styles/theme/sections.css`, or utilities in its markup, as step 3 says.
- **A row of navigation links,** such as a page's own navbar inside its content, collapses on phones, as the kit's menu does: below the theme's nav breakpoint, behind a native disclosure, a `details` whose `summary` is the menu button, so it opens by keyboard and without scripts. Above the breakpoint, the links show as a row and the `summary` is hidden.

Name a type after what it shows, such as `amenities` or `plan-cards`, never after a page or a library type. A minimal component:

```astro
---
import Title from "@hostsmith/site-kit-astro/components/Title.astro";
import { sectionFields } from "@hostsmith/site-kit-astro/field";

const { section, entry } = Astro.props;
const f = sectionFields(entry, section);
---

<section {...f.root} class="amenities">
  <div class="sk-container">
    <h2 class="amenities__title" {...f.field("title")}><Title text={section.title} /></h2>
    <ul class="amenities__list">
      {
        section.items.map((item, i) => (
          <li class="amenities__item">
            <h3 class="amenities__name" {...f.field("items", i, "title")}>{item.title}</h3>
            <p {...f.field("items", i, "text")}>{item.text}</p>
          </li>
        ))
      }
    </ul>
  </div>
</section>
```

`{...f.root}` goes on the section's root element: it carries the section's type, its `reveal` and, for a library type, its site variant. `sk-container` gives the content the theme's width and gutter.

After adding or changing a type, run `npm run decap-config` and `npx site-kit schema`.

## Write the page entries

Each page becomes `src/content/pages/<path>.<code>.md`, after the export's file: `index.html` is `home`, `about.html` is `about`, and `services/painting.html` is `services/painting`. Its frontmatter:

- `title`: the page's `<title>`;
- `description`: its meta description;
- `ogImage`: its Open Graph image, when it has its own;
- `sections`: one entry per section, each with an id from `npm run section-id -- src/content/pages/<path>.<code>.md`, run once for each new section.

Its body stays empty. In the sections:

- **The text as it is:** every heading, paragraph, label and alt text, exactly. List a typo you notice in the report, and don't fix it.
- **Highlights:** words a heading wraps in a span to color them, such as `Work <span class="text-color-accent">together</span> by the river`, become `==` marks: `Work ==together== by the river`. Only in a prop named `title`: a highlight elsewhere goes to the report.
- **Links:** an internal `.html` link becomes its clean path, and a link to a CMS item its path in the URL map (step 2).
- **Images:** `/assets/images/<name>`, the name step 7 gives the file, with the export's alt text. When the export's alt text is empty, write a short one and list it in the report's "Alt text written", for the owner to check.
- **Facts:** a phone number, email or address that the settings hold as a fact is written `{name}`.
- **Buttons:** a button's text and link become the type's `cta`, `secondaryCta`, `button` or `link`. A `split`'s `link` keeps the look: `style: primary` for a `button`, `style: secondary` for a `button is-secondary`, and no `style`, a text link, for a link styled as text.
- **Icons:** an icon image in a card becomes the item's `icon`: a site icon from step 7, named after its file in `src/icons/`.

## Webflow's elements

Map each one through the element mapping: tabs, sliders, lightboxes, background video, dropdowns, embeds, video in rich text, forms and the rest. Carry each embed with a frame as the old site loaded it, and ask nothing: its `embed` section sets no `load`, so `embedLoad` from step 4 decides. Only a frame a consent tool held back while others loaded with the page gets `load: click`, and an answer given in advance about an embed wins for it. Record each embed in the report's "Embeds", with how it loads.

A form isn't carried yet, but the text around it is: keep its heading and its intro as a section, such as a `rich-text`, in the form's place, so the page keeps its order and the form has a place when the kit's contact form comes. Only the form itself goes into the report's "Forms".

Never copy raw HTML, a script or a style into the content or a component. What has no replacement goes into the report's "Not carried over", with its page.

## Interactions

Read the interactions from `.hostsmith/snapshot/code/js/webflow.js` as text, as the element mapping's "Interactions" says, and never run the file. A simple entrance animation becomes a `reveal` preset on each section that carries its class, on the section or on its header: `reveal: fade-up` in the section entry. On the items of a list, such as a row of cards that slide in one after another, it's `revealItems: slide-left` on a library list type. On an element of a site-local type's own markup, it's `data-reveal="fade-up"` in the component instead. Webflow's built-in effects, such as Slide In, map the same way, by the element each one targets. Record each interaction in the report's "Interactions", with its id and what was done with it, and the built-in effects by page.

## Pages that need their own template

A page whose layout no sequence of sections can express, such as one built around interactions that don't carry over, gets `template: custom` and a page template in `src/components/pages/<page>.astro`, still built from sections where it can be (the kit's README, "Custom pages"). Use it rarely, and list each such page in the report.

## The 404 page

Webflow's `404.html` becomes the page entry `404`, built from sections, such as a `hero` with the variant `page` and a link home. When the export has no `404.html`, or has Webflow's near-default one, with little more than "Page not found", write the page in the site's voice, from its other pages' copy, with a link home, and list it in the report as written, for the owner to approve.

Mark each page you write anew in `.hostsmith/snapshot/fidelity/pages.txt`, with `anew` after its build path, such as `404.html /404 anew`: the fidelity check shoots it, for the site's look, but leaves it out of its measure, since the export has no page of its own for it to match. A 404 page the old site designed, which you port, isn't marked.

## Not carried over

These go into the report's "Not carried over":

- the password page, `401.html`, and the pages Webflow protected with a password;
- the search page and site search;
- a collection list's pages beyond the first, which Webflow serves at query strings such as `?a1b2c3d4_page=2`.

## Localized sites

Copy each page into every other locale, such as `about.de.md` beside `about.en.md`, keeping its section ids, with its `localSlug` from its alternate URL in the sitemap: `/de/uber-uns` gives `localSlug: uber-uns`. Its text stays the primary locale's. List each copy in the report's "To translate".

No export holds a static page's text in another locale: Webflow publishes it only on the live site, which the skill never reads (SKILL.md). Say so in "To translate": the person can bring the translations over from their published site themselves, under Webflow's terms, or from their translator's files, or have the pages translated again.

## Then

Run `npm run build`. It fails, naming the file, on a missing prop, an unknown key, a component without a schema or a schema without a component. Images show as missing until step 7 copies them. Record each page's sections and types in the report's "Pages".
