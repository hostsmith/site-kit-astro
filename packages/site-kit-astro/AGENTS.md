# Kit rules

The rules of the Hostsmith site kit, for any agent working in a site built on it. The site's own `AGENTS.md` points here and adds the site's notes.

> The full rules for content edits, section types and the owner request workflow come in a later kit release.

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

`icon` takes one of the kit's icons, `calendar`, `check`, `clock`, `file-text`, `hammer`, `house`, `mail`, `map-pin`, `paint-roller`, `phone`, `ruler`, `shield-check`, `sparkles`, `star`, `users`, `wrench`, or one of the site's own, named after its file in `src/icons/`. Any other name fails the build. A site icon is drawn in `currentColor`, with a `viewBox` and no script, style, event handler or outside link, or the build fails. After adding one, run `npm run decap-config`, so the CMS offers it. List a third-party icon in `CREDITS.md`.

A section's `title`, and any other prop named `title`, may mark words for the theme to highlight with `==` on both sides, such as `Work ==together==`. The kit removes the marks wherever the title isn't shown, such as in the page's `<title>`. Site code renders such a title with `Title.astro` or `titleHtml`.

## Interactive parts

The kit's parts replace the interactive elements of site builders, such as Webflow's, which ran on their own scripts. Use them, never a script or a package of your own:

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
- The site's own markup (custom pages, collection templates, site sections) uses Tailwind utilities built from the tokens, such as `bg-surface`, `text-h2` or `md:grid-cols-2`. Tailwind's default colors, text sizes, radii, shadows and containers don't exist.
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

## In a core site

A site without `src/site.schema.ts` is a core site: an Astro site with its own pages, layout and components, which adds only the kit's core, `siteKitCore()` from `@hostsmith/site-kit-astro/core`. These rules apply there:

- **Field attributes.** Bind each element that shows a content value: a collection entry's with `fieldsFor(collection, entry.id)` from `@hostsmith/site-kit-astro/field`, page copy with `copy.fields(page, locale)`. Bind the element that shows the value, not a container around it. Mark text the CMS doesn't edit, such as a legal line, `data-field-ignore`.
- **Page copy.** Copy that a page writes in its markup goes in `src/content/copy/<page>.yml`, declared in `pageCopy()` in `src/content.config.ts`, and the page reads it with `copy.get(page, locale)`. Never name a collection `pages`.
- **Locales.** They are `content.locales` in `hostsmith.json`, and match Astro's `i18n` when the site sets it. Each translated collection keeps the default locale in its own folder or file suffix too, such as `news/en/a.md` or `news/a.en.md`. With locales, each copy file holds every locale's copy under its code.
- **Commands.** After a change to a collection's schema, run `npx site-kit schema` and `npx site-kit decap-config`, and commit `.hostsmith/schema.json` and `public/admin/config.yml`. After the build, `npx site-kit check-fields` lists the pages with text that isn't bound yet.
- **Static output.** Never set `output: "server"` or `export const prerender = false`: Hostsmith serves static files only.
- **Content source.** `content.source` in `hostsmith.json` says where the content lives: `repo`, the default, or `external`, for a headless CMS the build fetches from. In an external site, edit content in the CMS, never in the repository: there's no schema export, Decap config or page copy to keep up, and `check-fields` only reports. Never commit a CMS token: it belongs in the CI provider's secrets.

These don't apply in a core site: section types and `npm run section-id`, settings, header and footer blocks, interface strings, themes, the `sk-` hooks and `check-styles`, and the dependency list above. The site keeps its own markup, styles and dependencies.
