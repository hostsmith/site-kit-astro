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
- `@hostsmith/site-kit-astro/field`: `field` and `sectionFields`, for field attributes;
- `@hostsmith/site-kit-astro/markdown`: `renderMarkdown` and `assertNoH1`;
- `@hostsmith/site-kit-astro/settings`: `getSettings` and `SETTINGS`;
- `@hostsmith/site-kit-astro/routes`: `pagePath` and `getEntryRoutes`;
- `@hostsmith/site-kit-astro/custom-page`: `customPage`, for `template: custom` pages;
- `@hostsmith/site-kit-astro/components/Sections.astro` and `@hostsmith/site-kit-astro/layouts/Base.astro`.

Never edit files in `node_modules`: the next install replaces them.

## The site's files

Every file in the site repository is the site's. The kit reads these from it, so keep them where they are:

- `src/site.config.ts`: the production site URL and each collection's base path;
- `src/site.schema.ts`: the site-local section types and the site's collections;
- `src/components/sections/site/<type>.astro`: site-local section types;
- `src/components/collections/<collection>.astro`: each collection's detail template;
- `src/pages/`: hand-written pages, such as `template: custom` pages;
- `src/styles/global.css`: the site's stylesheet. It imports Tailwind, the theme in `src/styles/theme/` and the site's own `src/styles/site.css`.

To change a library section for this site, copy it from the kit into `src/components/sections/site/` under a new name, change its imports to the package names above, and register the copy as a site-local type: its schema in `src/site.schema.ts`, its Decap type in `public/admin/config.site.yml`. The copy may keep the kit's `sk-` classes, so the site's styles apply to it, only while its markup keeps their structure. Once it differs, give it classes of its own.

Don't edit `public/admin/config.yml`. Edit `public/admin/config.site.yml`, then run `npm run decap-config`, which assembles `config.yml` from it and the kit's part. The build fails while `config.yml` is stale.

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
- photos: `gallery`;
- blog posts or other entries: `collection-list`;
- address, hours, phone, email and a map link: `hours-location`;
- a call to action: `cta`. Keep one accent call to action per screen.

`icon` takes one of `calendar`, `check`, `clock`, `file-text`, `hammer`, `house`, `mail`, `map-pin`, `paint-roller`, `phone`, `ruler`, `shield-check`, `sparkles`, `star`, `users`, `wrench`. Any other name fails the build.

## Header and footer

The header's actions and the footer's blocks are listed in `src/content/settings/site.yml`, like a page's sections; the kit's README lists their types and props. To add a phone number, a button, opening hours or a link column, add a block there, never a setting or a component.

A fact that appears in more than one place, such as the phone number, the address or a license number, belongs in the settings' `facts`, and every text that shows it writes `{name}`, such as `{phone}`. Never copy a fact's value into the content: change it in `facts`, once. Quote a YAML value that starts with a brace, such as `number: "{phone}"`. The build fails on an unknown name.

## Styling

The kit ships no CSS. Its markup carries the `sk-` classes and state attributes in `HOOKS.md`, and the site's stylesheet styles them. To change how a kit part looks, edit the site's styles, never the kit. Style a kit part through its hook, such as `.sk-hero__title`. Don't depend on the nesting of its elements, which can change in a minor release. A hook is renamed or removed only in a major release, after a minor one has deprecated it (`HOOKS.md`, "Deprecated").

The site's look is its theme, in `src/styles/theme/`. Its `README.md` lists the theme's token roles, color schemes and contrast pairs:

- Kit parts are styled in the theme's plain CSS files (`layout.css`, `sections.css`, `prose.css`), on the theme's variables, such as `var(--color-accent)`. A rule that reads a text role sets all four of its properties: `font-size: var(--text-h2)`, plus its `--line-height`, `--letter-spacing` and `--font-weight`. Don't use `@apply` or `@layer`: `global.css` puts these files in Tailwind's `components` layer, so utilities still win over them.
- Switch layouts in theme CSS with `@variant md` and `@variant max-md`, not a hand-written media query. `md` is where the header shows its nav, so the site's own `md:` utilities switch with it.
- A rule that sets `display` on an element the kit hides with `hidden`, such as `.sk-header__menu-button`, needs `:not([hidden])` in its selector.
- The site's own markup (custom pages, collection templates, site sections) uses Tailwind utilities built from the tokens, such as `bg-surface`, `text-h2` or `md:grid-cols-2`. Tailwind's default colors, text sizes, radii, shadows and containers don't exist.
- Colors belong only in `tokens/colors.css` and `presets/colors/`, and font names only in `tokens/type.css` and `fonts.css`. Any other color is mixed from a color role, such as `color-mix(in oklch, var(--color-fg) 8%, transparent)`. Run `npm run check:styles` after a style change: it fails on a raw value anywhere else.
- To change the site's colors, add a preset in `presets/colors/` with the same color names as the others and point `tokens/colors.css` at it. Don't edit a shipped preset. A new text and background pair gets a row in the theme's contrast table.
- Site CSS that isn't part of the theme goes in `src/styles/site.css`.

## Kit updates

To take kit release `<version>`:

1. `git switch -c kit-update/v<version>`
2. `npm install --save-exact @hostsmith/site-kit-astro@<version>`. If npm reports a conflict on `astro`, install the `astro` version the release notes name in the same command.
3. `npm run decap-config` and `npm run check:styles`. For each deprecated-hook warning, rename the selector in `src/styles/theme/` and `src/styles/site.css` to the replacement it names. Don't keep a selector list with both names: once the old class is gone, that half matches nothing.
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
