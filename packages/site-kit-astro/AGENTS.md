# Kit rules

The rules of the Hostsmith site kit, for any agent working in a site built on it. The site's own `AGENTS.md` points here and adds the site's notes, and the site's `CLAUDE.md` imports both.

## The rules

- **Kit sections only.** A page is built from library sections and the site's own section types. A layout that no library type covers becomes a variant of a site-local type, or a new site-local type with its component, Zod schema and Decap type (see [Section types](#section-types)). Never write one-off markup into a page.
- **Kit parts first.** Tabs, sliders, lightboxes, background video, embeds, entrance animations and dropdowns in the nav come from the kit (see [Interactive parts](#interactive-parts)). Make a custom version, as a site-local type, only when the person asks for one. When a kit section can't show part of the old content, keep the kit's part, never drop the content silently: say so, list it in the migration report's "Not carried over", and ask the person when one is there.
- **The theme's tokens only.** Raw colors only in the theme's `tokens/colors.css` and `presets/colors/`, font names only in `tokens/type.css` and `fonts.css`, and no arbitrary Tailwind values, such as `p-[13px]`. Style the kit's parts through their hooks in the theme, never in the kit, and the site's own markup with utilities built from the theme's roles (see [Styling](#styling)).
- **No hardcoded text.** Visible text comes from content or settings. A label in the site's own markup is an interface string (see [Interface strings](#interface-strings)).
- **Keep old URLs.** Never rename or move the file of a published page or entry, change its `localSlug`, or change a collection's base path. Each is part of a URL, and Hostsmith has no redirects (see [Content](#content)).
- **Keep configs in sync.** The site's Decap part (`public/admin/config.site.yml`), its Zod schemas (`src/site.schema.ts`) and its components change together, in the same commit. Then `npm run decap-config` assembles `public/admin/config.yml` from the parts.
- **Kit code stays in the package.** Use it only through its exports, and never edit `node_modules`. To change a library section for one site, copy it under a new name (see [The site's files](#the-sites-files)). Kit releases come in through `npm install` on a `kit-update/v<version>` branch (see [Kit updates](#kit-updates)).
- **Section ids.** Get every new id from `npm run section-id -- <page file>`. Never edit, copy or reuse an id, except that a translation keeps its source's ids.
- **Content dialect.** Write content in the portable dialect, and never replace a media file in place (see [Content](#content)).
- **Dependencies.** Only the packages in [Dependencies](#dependencies), pinned exactly.
- **Before pushing.** `npm run check:styles`, `npm run build` and `npm run check:urls` pass, and `npm run check:styles -- --built` warns about nothing (see [Before pushing](#before-pushing)).
- **Owner requests.** Handle them as [Owner requests](#owner-requests) says.
- **Migrating a Webflow site.** The migration skill is in `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/SKILL.md`. Read and follow it when asked to move a site from Webflow.

## Where the kit is

The kit is the package `@hostsmith/site-kit-astro`, in `node_modules/@hostsmith/site-kit-astro/`. Search tools that respect `.gitignore` skip `node_modules`, so look there by path:

- library section types: `src/components/sections/<type>.astro`, their schemas in `src/kit-content.ts`, their Decap types in `decap/config.kit.yml`;
- the base layout: `src/layouts/Base.astro`;
- the styling hooks: `HOOKS.md`. The kit ships no CSS. Its markup carries `sk-` classes and state attributes, and the site's stylesheet styles them.

Site code imports the kit only through these package names:

- `@hostsmith/site-kit-astro/schema`: field types and helpers for `src/site.schema.ts`;
- `@hostsmith/site-kit-astro/field`: `field`, `sectionFields` and `fieldsFor`, for field attributes;
- `@hostsmith/site-kit-astro/markdown`: `renderMarkdown` and `assertNoH1`;
- `@hostsmith/site-kit-astro/settings`: `getSettings(locale)`, `settingsRef(locale)` and `SETTINGS`;
- `@hostsmith/site-kit-astro/ui`: `getUi(locale)`, for interface strings;
- `@hostsmith/site-kit-astro/locales`: `locales`, `localized`, `localeOfPath` and `localizedPath`, for the site's locales;
- `@hostsmith/site-kit-astro/routes`: `getEntryRoutes(collection, locale)`;
- `@hostsmith/site-kit-astro/custom-page`: `customPage(entry)`, for `template: custom` pages and page templates;
- `@hostsmith/site-kit-astro/title`: `titleHtml`, `plainTitle` and `titleParts`, for titles with highlighted words;
- `@hostsmith/site-kit-astro/components/Sections.astro`, `@hostsmith/site-kit-astro/components/Title.astro` and `@hostsmith/site-kit-astro/layouts/Base.astro`.

Never edit files in `node_modules`: the next install replaces them.

## The site's files

Every file in the site repository is the site's. The kit reads these from it, so keep them where they are:

- `src/site.config.ts`: the production site URL, the site's locales and each collection's base path;
- `src/content/`: the pages, each collection's entries and the settings, one file each per locale, with the locale's code before the extension, such as `src/content/pages/about.en.md` and `src/content/settings/site.en.yml`;
- `src/site.schema.ts`: the site-local section types, the site's collections, each declared by its schema alone, and its interface strings (`siteUi`). The kit loads the collections: never give one a `loader`;
- `src/components/sections/site/<type>.astro`: site-local section types;
- `src/components/collections/<collection>.astro`: each collection's detail template;
- `src/components/pages/<page>.astro`: page templates, which render a `template: custom` page in every locale;
- `src/pages/`: hand-written pages, such as `template: custom` pages;
- `src/icons/<name>.svg`: the site's own icons, if it has any;
- `src/styles/global.css`: the site's stylesheet. It imports Tailwind, the theme in `src/styles/theme/` and the site's own `src/styles/site.css`.

To change a library section for this site, copy it from the kit into `src/components/sections/site/` under a new name, change its imports to the package names above, and register the copy as a site-local type: its schema in `src/site.schema.ts`, its Decap type in `public/admin/config.site.yml`. The copy may keep the kit's `sk-` classes, so the site's styles apply to it, only while its markup keeps their structure. Once it differs, give it classes of its own.

Don't edit `public/admin/config.yml`. Edit `public/admin/config.site.yml`, then run `npm run decap-config`, which assembles `config.yml` from it and the kit's part. The build fails while `config.yml` is stale.

After a change to `src/site.schema.ts` or to the locales in `src/site.config.ts`, run `npx site-kit schema` and commit `.hostsmith/schema.json`. The build fails while it is stale.

## Content

Read `.hostsmith/brief.md` before writing or changing copy: it holds the business's facts, its audience, its voice and what to avoid.

Write every content file in the portable dialect, which any CMS and any Markdown tool can read:

- Frontmatter is YAML. Dates are quoted ISO 8601, such as `date: "2026-10-24"`. Booleans are only `true` or `false`. Quote a value YAML could read as something else, such as `"yes"`, `"12:30"` or a value that starts with a brace. Leave an empty optional field out: never write `null` or `''`.
- Bodies are CommonMark, with GFM tables as the only extension: no MDX, no Markdoc tags and no raw HTML. A page's body stays empty, since its content is its sections.
- Media is under `public/assets/`, and content refers to it as `/assets/<file>`. Never replace a media file in place: a changed image gets a new file name, every reference moves to it, and the old file is deleted once nothing refers to it.

A page's or entry's URL comes from its file's path, its `localSlug` in a translation, and its collection's base path in `src/site.config.ts`. Hostsmith has no redirects, so once a page is published, changing any of these breaks its old URL for visitors, links and search engines. `.hostsmith/old-urls.txt` lists the URLs the site keeps, and `npm run check:urls` fails when one of them has no page. When a request needs a published URL to change, say so to the developer before making the change, and never edit `.hostsmith/old-urls.txt` to make the check pass.

## Section types

Pick the library type that fits a block before writing a site-local one:

- an opening or a page header: `hero` (`page` for an inner page's header);
- formatted text: `rich-text` (`title-aside` puts the heading beside the text);
- an image beside text, with figures or a link: `split`;
- services, values or features as cards: `services-grid`, with an `icon` per item;
- a numbered process or what's included: `steps`;
- figures such as "500+ projects": `stats`, two to four;
- short trust signals or credentials: `trust-bar` (`chips` for badges);
- customer quotes: `testimonials`;
- the people: `team`, which shows placeholders until photos exist;
- prices: `pricing-list`, written as the site wants them shown;
- questions and answers: `faq`;
- photos: `gallery`, with `lightbox: true` to open each one large;
- content behind a row of tabs, such as floors or plans: `tabs`;
- slides or cards one after another: `slider`, which rotates only with `autoplay`;
- a map, a YouTube or Vimeo video, or other content in a frame: `embed`;
- blog posts or other entries: `collection-list`;
- address, hours, phone, email and a map link: `hours-location`;
- a call to action: `cta`. Keep one accent call to action per screen.

When no library type fits a block, try a library type's other variants, or a new variant of a site-local type. Otherwise add a site-local type, in one commit: its component in `src/components/sections/site/<type>.astro`, its schema with `section` in `siteSectionSchemas` in `src/site.schema.ts`, and its Decap type under `section_types` in `public/admin/config.site.yml`. Then add it to the page as a section entry, with an id from `npm run section-id`. Never write a block's markup into a page template or a hand-written page instead: the CMS can't edit it there, and no other page can use it.

`icon` takes one of the kit's icons, `calendar`, `check`, `clock`, `file-text`, `hammer`, `house`, `mail`, `map-pin`, `paint-roller`, `phone`, `ruler`, `shield-check`, `sparkles`, `star`, `users`, `wrench`, or one of the site's own, named after its file in `src/icons/`. Any other name fails the build. A site icon is drawn in `currentColor`, with a `viewBox` and no script, style, event handler or outside link, or the build fails. After adding one, run `npm run decap-config`, so the CMS offers it. List a third-party icon in `CREDITS.md`.

A section's `title`, and any other prop named `title`, may mark words for the theme to highlight with `==` on both sides, such as `Work ==together==`. The kit removes the marks wherever the title isn't shown, such as in the page's `<title>`. Site code renders such a title with `Title.astro` or `titleHtml`.

## Interactive parts

The kit's parts replace the interactive elements of site builders, such as Webflow's, which ran on their own scripts. Use them, never a script or a package of your own. Make a custom version of one, such as a slider with thumbnails, only when the person asks for it, and then as a site-local type:

- Webflow's Tabs: `tabs`. Its Slider: `slider`. Its Lightbox: `lightbox: true` on `gallery`. Its Dropdown: `children` on a nav item, one level deep.
- A background video: `video` (an MP4 under `/assets/`, and an optional `videoWebm`) on a `hero` with the variant `background`, or on a `split`, with `image` as its poster. Keep the clip short and small.
- Map, Embed, Video and YouTube elements: `embed`. It loads on a click, so the page sends nothing to the provider until the visitor asks. Set `load: direct` only when the owner confirms that the site's privacy notice names the provider. In a Markdown body, a YouTube or Vimeo link alone in its paragraph renders as the same embed: never paste an embed's HTML.
- Simple entrance animations: `reveal` on a section, one of `fade`, `fade-up`, `fade-down`, `slide-left`, `slide-right` or `scale`, or `data-reveal` on an element of the site's own markup. The theme animates it, and never under reduced motion.

Each part works by keyboard and shows its content without scripts. A page that renders a part needs the part's interface strings in every locale's settings, such as `sliderNext`, and the build names any that are missing. The kit's README, "Interactive parts", lists them.

## Header and footer

The header's actions and the footer's blocks are listed in each locale's settings, such as `src/content/settings/site.en.yml`, like a page's sections; the kit's README lists their types and props. To add a phone number, a button, opening hours or a link column, add a block there, never a setting or a component. A nav item's `children` make a dropdown, and the footer's `brand` block takes its own `logo`, such as a reversed one for a dark footer.

A fact that appears in more than one place, such as the phone number, the address or a license number, belongs in the settings' `facts`, and every text that shows it writes `{name}`, such as `{phone}`. Never copy a fact's value into the content: change it in `facts`, once. Quote a YAML value that starts with a brace, such as `number: "{phone}"`. The build fails on an unknown name.

## Interface strings

Never write visible text into a template. A label in the site's own markup, such as "Keep reading" or "4 min read", is an interface string:

1. declare its key in `siteUi` in `src/site.schema.ts`, with `uiString`, its parameters and its plural parameter, if any;
2. add its field under `ui` in `public/admin/config.site.yml`, with `fields: *plural_forms` for a plural, and run `npm run decap-config`;
3. write its text under `ui` in the settings, in every locale, with every plural form the locale's language uses;
4. render it with `getUi(locale)`: `{...ui.field(key)}` on the element, `ui.text(key, values)` as its text.

Alt text, dates and numbers formatted for the page's language aren't interface strings: alt text is content, and a date or number is formatted with the settings' `language`, which the kit fills in from the locale's tag.

## Locales

Every site lists its locales in `src/site.config.ts`, the default first, and names each content file's locale before its extension, such as `src/content/pages/about.en.md`. A file without one of the site's locales in its name fails the build. A site in one language has one locale. The language is the locale's tag: never write `language` into the settings. The kit's README, "Locales", has the layout, the URLs and the steps to add a language. In a site with several locales:

- When you add a page or an entry, add its translation in every locale, beside it with the locale's code, such as `about.de.md` for `about.en.md`, or tell the owner which locales go without it. A page without a translation is served only in its own locales.
- A translation keeps its source's section ids. A new section gets one id, from `npm run section-id -- <page file>`, in every translation it's added to.
- Write an internal link as its target's path in the default locale, in every locale: `/contact`, never `/de/kontakt`. The build localizes it. A script that builds a link gets the path from `localizedPath`.
- A translation's own URL segment is its `localSlug`. Never set one in the default locale.
- Change a fact, a nav item or an interface string in every locale's settings. Every locale defines the same fact names and keys, and the build fails when one lacks a name.
- Templates receive the page's `locale`: pass it to `getSettings`, `getUi`, `getEntryRoutes` and the layout. Do it in a site with one locale too, so adding a language needs no template change.

In every site, a custom page has no props of its own: its content goes in sections, and its page template may show a section in its own markup.

## Images and third-party files

Images and videos go under `public/assets/`, and the build serves them as their files are. It never resizes or converts an image, not even one passed to Astro's `Image` component. Save each image at the size the page shows it, in a web format such as JPEG, WebP or AVIF. Content links to no media on another host: the only external URLs it holds are an `embed`'s and a video link's.

Add third-party code, fonts or images to the site only under a license that allows that use, such as a font under the SIL Open Font License. Keep any license text the license asks for next to the file, such as a font's `OFL.txt`, and list each file in `CREDITS.md` with its source and its license. When you can't establish a file's license, such as a font taken from the old site, list it in `CREDITS.md` as awaiting the owner's confirmation, and tell the developer before the site goes to production. Never add it silently.

## Styling

The kit ships no CSS. Its markup carries the `sk-` classes and state attributes in `HOOKS.md`, and the site's stylesheet styles them. To change how a kit part looks, edit the site's styles, never the kit. Style a kit part through its hook, such as `.sk-hero__title`. Don't depend on the nesting of its elements, which can change in a minor release. A hook is renamed or removed only in a major release, after a minor one has deprecated it (`HOOKS.md`, "Deprecated").

The site's look is its theme, in `src/styles/theme/`. Its `README.md` lists the theme's token roles, color schemes and contrast pairs, the section types and parts it styles, and the breakpoint where its header shows its nav:

- Kit parts are styled in the theme's plain CSS files (`layout.css`, `sections.css`, `prose.css`), on the theme's variables, such as `var(--color-accent)`. A rule that reads a text role sets all four of its properties: `font-size: var(--text-h2)`, plus its `--line-height`, `--letter-spacing` and `--font-weight`. Don't use `@apply` or `@layer`: `global.css` puts these files in Tailwind's `components` layer, so utilities still win over them.
- Switch layouts in theme CSS with `@variant` on the theme's breakpoints, such as `@variant md` or `@variant max-lg`, never a hand-written media query. A token that changes per breakpoint changes in a `:root` rule under the variant, in its token file.
- A rule that sets `display` on an element the kit or a part's script hides with `hidden`, such as `.sk-header__menu-button` or a tab panel, needs `:not([hidden])` in its selector. Hide or collapse a part's content only under its `data-ready`, and a reveal element only under `[data-sk-ready]` and without reduced motion.
- When a page uses a type or part the theme's `README.md` doesn't list, style its hooks in the theme, and add it to the list. The parts are `highlight`, `nested-nav`, `lightbox`, `video` and `reveal`, each with its hooks under "Parts" in `HOOKS.md`.
- The site's own markup (custom pages, collection templates, site sections) uses Tailwind utilities built from the tokens, such as `bg-surface`, `text-h2` or `md:grid-cols-2`. Tailwind's default colors, text sizes, radii, shadows and containers don't exist. Never write an arbitrary value, such as `p-[13px]` or `text-[#333]`.
- Colors belong only in `tokens/colors.css` and `presets/colors/`, and font names only in `tokens/type.css` and `fonts.css`. Any other color is mixed from a color role, such as `color-mix(in oklch, var(--color-fg) 8%, transparent)`. Run `npm run check:styles` after a style change: it fails on a raw value anywhere else.
- To change the site's colors, add a preset in `presets/colors/` with the same color names as the others and point `tokens/colors.css` at it. Don't edit a shipped preset. A new text and background pair gets a row in the theme's contrast table.
- Site CSS that isn't part of the theme goes in `src/styles/site.css`.

## Kit updates

To take kit release `<version>`:

1. `git switch -c kit-update/v<version>`
2. `npm install --save-exact @hostsmith/site-kit-astro@<version>`. If npm reports a conflict on `astro`, install the `astro` version the release notes name in the same command.
3. `npm run decap-config`, `npx site-kit schema` and `npm run check:styles`. `npx site-kit schema` writes `.hostsmith/schema.json`, which a site without it gains at the first update that runs it: commit it. For each deprecated-hook warning, rename the selector in `src/styles/theme/` and `src/styles/site.css` to the replacement it names. Don't keep a selector list with both names: once the old class is gone, that half matches nothing.
4. `npm run build` and `npm run check:urls`. For each build warning about deprecated content, change the content to the replacement it names.
5. `npm run check:styles -- --built`. Style every hook it reports as unstyled, in the theme or in `site.css`, and replace every class it reports without a rule with the theme's tokens, such as `text-h1` for `text-4xl`.
6. For a major release, apply the steps in its release notes, and the kit README's checklist for that release, such as "From 0.4 to 0.5". Before taking a release with a "Removed" section, clear every deprecation warning. If the site skipped the release that deprecated a hook, the "Removed" notes and the errors from `npm run check:styles` list what to change.
7. Commit, push the branch, check the preview site, then merge it to `main`.

Never merge the kit repository's history, and never copy the package's code into the site. Copy an example's files, such as its theme, only when a release's notes say to.

## Dependencies

Every dependency is pinned to an exact version, and `package-lock.json` is committed. Use only these packages:

- `@hostsmith/site-kit-astro`
- `astro`
- `tailwindcss` and `@tailwindcss/vite`
- `@astrojs/react`, `react` and `react-dom`, only for the DevLink experiment

Don't add a package that isn't on this list. If a change seems to need one, stop and raise it with the developer instead.

## Before pushing

Run these, in this order, and fix what they report before you push:

```bash
npm run check:styles
npm run build
npm run check:urls
npm run check:styles -- --built
```

`check:styles` and the build pass, `check:urls` finds a page for every path in `.hostsmith/old-urls.txt`, and `check:styles -- --built` warns about nothing. The deploy workflow runs the style checks and the build, but not `check:urls`.

## Owner requests

The site's owner sends change requests, such as "add our Saturday hours", by email or a messaging app. `.hostsmith/brief.md` says how requests arrive and who approves changes. Handle each request the same way:

1. Make the change on a new branch, such as `request/saturday-hours`, following these rules. Name the request in the commit message, with who asked and when, such as `Add Saturday hours (owner's email of 2026-10-24)`.
2. Run the checks in [Before pushing](#before-pushing), then push the branch. The deploy workflow deploys it to the preview site.
3. Send the owner the preview address, or give it to whoever sends it. The deploy run's summary and the repository's deployments list link to it.
4. Once the owner approves, merge the branch to `main`. The deploy workflow deploys it to production.

The preview site is optional, and a site has one only when its repository sets the variable `HOSTSMITH_PREVIEW_SITE_ID`. Without one, a pushed branch only builds, and there's no approval step: merge the change to `main` once `npm run build` and `npm run check:urls` pass. A site whose owner approves changes needs a preview site. If the brief names an approver and the site has no preview site, tell the developer before merging.

## Migrating a Webflow site

The kit's skill for moving a Webflow site into a kit site is `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/SKILL.md`. When asked to move, port or migrate a site from Webflow, read that file and follow it, step by step. It works from Webflow's code export and CMS CSV exports, never from the live site, and runs only in a site created from the kit's `webflow` example.

## In a core site

A site without `src/site.schema.ts` is a core site: an Astro site with its own pages, layout and components, which adds only the kit's core, `siteKitCore()` from `@hostsmith/site-kit-astro/core`. These rules apply there:

- **Field attributes.** Bind each element that shows a content value: a collection entry's with `fieldsFor(collection, entry.id)` from `@hostsmith/site-kit-astro/field`, page copy with `copy.fields(page, locale)`. Bind the element that shows the value, not a container around it. Mark text the CMS doesn't edit, such as a legal line, `data-field-ignore`.
- **Page copy.** Copy that a page writes in its markup goes in `src/content/copy/<page>.yml`, declared in `pageCopy()` in `src/content.config.ts`, and the page reads it with `copy.get(page, locale)`. Never name a collection `pages`.
- **Locales.** They are `content.locales` in `hostsmith.json`, and match Astro's `i18n` when the site sets it. Each translated collection keeps the default locale in its own folder or file suffix too, such as `news/en/a.md` or `news/a.en.md`. With locales, each copy file holds every locale's copy under its code.
- **Commands.** After a change to a collection's schema, run `npx site-kit schema` and `npx site-kit decap-config`, and commit `.hostsmith/schema.json` and `public/admin/config.yml`. After the build, `npx site-kit check-fields` lists the pages with text that isn't bound yet.
- **Static output.** Never set `output: "server"` or `export const prerender = false`: Hostsmith serves static files only.
- **Content source.** `content.source` in `hostsmith.json` says where the content lives: `repo`, the default, or `external`, for a headless CMS the build fetches from. In an external site, edit content in the CMS, never in the repository: there's no schema export, Decap config or page copy to keep up, and `check-fields` only reports. Never commit a CMS token: it belongs in the CI provider's secrets.

These don't apply in a core site: section types and `npm run section-id`, settings, header and footer blocks, interface strings, themes, the `sk-` hooks and `check-styles`, and the dependency list above. The site keeps its own markup, styles and dependencies.
