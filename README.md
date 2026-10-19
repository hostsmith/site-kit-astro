# Site Kit

A reusable kit for building websites with [Astro](https://astro.build), with guidelines for AI agents and example sites that carry their own designs. Content lives in Markdown and YAML files, so people and agents can change a site with ordinary edits and review them in a pull request.

The kit has two parts:

- the npm package [`@hostsmith/site-kit-astro`](https://www.npmjs.com/package/@hostsmith/site-kit-astro): an Astro integration, the section library, the layout, the routes, the content schemas, the `site-kit` command and the agent guidelines (`AGENTS.md`). It ships no CSS: its markup carries styling hooks, listed in [`HOOKS.md`](./packages/site-kit-astro/HOOKS.md);
- example sites, in [`examples/`](./examples): a new site starts as a copy of one (see [Examples](#examples)). Each example brings its own look, styled with [Tailwind CSS](https://tailwindcss.com).

A site repository holds only the site: its content, settings, look and its own sections. It takes kit releases with `npm install`. The kit is plain Astro, and Hostsmith appears only in deployment tooling, so a kit site builds and runs on any static host.

The kit is before 1.0, and built first for sites migrated from Webflow.

## Examples

Each example is a complete site, and each release deploys it from this repository.

| Example | What it shows | Live site |
| --- | --- | --- |
| [`basics`](./examples/basics) | Kestrel, a home repair and renovation business: every section type, a blog with categories and a custom page | [kit-astro-basics.us.hostsmith.link](https://kit-astro-basics.us.hostsmith.link) |

## Start a site

1. Create the site from an example of a kit release. `basics` names the example, and `v0.6.1` the release: use the latest one from the [releases](https://github.com/hostsmith/site-kit-astro/releases). `--no-ai` keeps the example's `AGENTS.md`, which points agents to the kit's rules. Without it, create-astro replaces the file with its own.

   ```bash
   npm create astro@latest my-site -- --template hostsmith/site-kit-astro/examples/basics#v0.6.1 --no-ai
   cd my-site
   npm run build   # writes the static site to dist/
   npm run dev     # local preview with live reload
   ```

2. Create a GitHub repository for the site and push it.
3. Replace the example content in `src/content/`, adjust the theme in `src/styles/theme/` (start with the tokens), and set `url` in `src/site.config.ts`.

## What a site holds

| Path | What it is |
| --- | --- |
| `src/content/` | pages, collection entries and settings, in a folder per [locale](#locales), such as `pages/en/` |
| `src/site.config.ts` | the production site URL, the [locales](#locales) and each collection's base path |
| `src/site.schema.ts` | the site's own section types, collections and [interface strings](#interface-strings) |
| `src/components/sections/site/` | the site's own section types |
| `src/components/collections/` | one detail template per collection |
| `src/components/pages/` | page templates: a `template: custom` page's markup, in every locale |
| `src/pages/` | hand-written pages, such as `template: custom` pages |
| `src/styles/theme/` | the site's look, taken from its example: tokens, fonts and the styles of the kit's parts (see [Themes](#themes)) |
| `src/styles/site.css` | the site's own CSS, outside the theme |
| `src/styles/global.css` | the site's stylesheet: imports Tailwind, the theme and `site.css` |
| `public/assets/` | media |
| `public/admin/config.site.yml` | the site's part of the Decap config |
| `public/admin/config.yml` | the Decap config, assembled by `npm run decap-config` |
| `astro.config.mjs`, `src/content.config.ts` | wire the kit and Tailwind in. They rarely change |
| `AGENTS.md`, `CLAUDE.md`, `.claude/skills/` | agent rules: the kit's rules come from the package |
| `.hostsmith/` | the site's brief and the old site's URLs |
| `.github/workflows/hostsmith.yml` | the deploy workflow |

Every file in a site repository is the site's. The kit's code is in `node_modules/@hostsmith/site-kit-astro/`, and no kit update changes the site's files, apart from `package.json`, `package-lock.json` and the generated `public/admin/config.yml`.

## How content works

- **Pages** are `src/content/pages/**/<page>.<locale>.md`, such as `pages/services/painting.en.md`. Every content file names its [locale](#locales) before its extension. A page is an ordered list of typed sections in its frontmatter, and its body stays empty. The default locale's `home` is served at `/`, and its other pages at their path without the locale, such as `/services/painting`.
- **Sections** have a stable `id` and a `type`. Get a new id with `npm run section-id -- <page file>`. The library's section types are in the package, and the site's own types go in `src/components/sections/site/`, with a schema in `src/site.schema.ts` and a Decap type in `public/admin/config.site.yml`.
- **Collections**, such as `news`, are folders of Markdown entries, one file per entry and locale, such as `news/fresh-rye.en.md`. Each is declared in `src/site.schema.ts` by its schema alone, and the kit loads it. It also has a base path in `src/site.config.ts` and a detail template in `src/components/collections/`.
- **Settings** are in `src/content/settings/site.<locale>.yml`: site name, logo, navigation, SEO defaults and [interface strings](#interface-strings), plus the header's actions and the footer's blocks (see [Header and footer](#header-and-footer)). The language isn't a setting: it's the locale's tag.
- `public/admin/config.yml` is the Decap CMS schema, assembled from the kit's part and `public/admin/config.site.yml`. The Zod schemas mirror it: change the site's Decap part and `src/site.schema.ts` together, then run `npm run decap-config`. The build fails while `config.yml` is stale.

## Section types

The library's section types. Variants change the markup's order or grouping; tones say which background a section sits on. Both show as modifier classes the site's styles draw (see [Styling](#styling)).

| Type | For | Props | Variants | Tones |
| --- | --- | --- | --- | --- |
| `hero` | the page's opening, or a page header | eyebrow, badge, title, subtitle, image, two buttons, note | `centered`, `image-left`, `image-right`, `background`, `page` | |
| `rich-text` | formatted text | title, markdown body | `narrow`, `wide`, `title-aside` | |
| `collection-list` | entries of a collection, such as blog posts | title, collection, limit, link | `cards`, `list`, `featured` | |
| `services-grid` | services or values as cards | eyebrow, title, intro, link, items with icon, image and link | `cards`, `list` | `plain`, `surface` |
| `gallery` | photos with captions | title, images | `grid`, `masonry` | |
| `testimonials` | customer quotes | title, items with photo, name and role | `grid`, `single` | `surface`, `dark` |
| `faq` | questions and answers | title, items | | |
| `cta` | a call to action | title, text, two buttons | `banner`, `card` | `accent`, `dark`, `surface` |
| `hours-location` | address, hours and a map link | title, address, hours, phone, email, note, map link | | |
| `trust-bar` | short trust signals, such as "Licensed & insured" | title, items | `line`, `chips` | |
| `stats` | two to four figures | title, items (value, label) | | `plain`, `dark` |
| `steps` | a process or what's included, numbered | eyebrow, title, intro, items | | |
| `split` | an image beside text | eyebrow, title, markdown body, image, figures, link | `image-left`, `image-right` | `plain`, `surface` |
| `team` | the people, with placeholders until the photos exist | title, intro, items (name, role, photo) | | |
| `pricing-list` | prices as the site writes them | title, items (label, price), note | | |

An `icon` prop takes one of the kit's icons: `calendar`, `check`, `clock`, `file-text`, `hammer`, `house`, `mail`, `map-pin`, `paint-roller`, `phone`, `ruler`, `shield-check`, `sparkles`, `star`, `users`, `wrench`. They are [Lucide](https://lucide.dev) icons, drawn in the current text color.

## Header and footer

The layout owns the frame of every page: the skip link, the brand link, the main nav (`nav`), the menu and the breadcrumb. The rest of the header and the footer are blocks that the site lists in its settings, like a page's sections. The kit defines no business facts: a phone number, an address or opening hours are props of the block that shows them, usually written as a [fact](#facts).

`header.actions` come after the nav, in the menu:

| Type | Props | Shows |
| --- | --- | --- |
| `phone` | number, callLabel | the number as a `tel:` link. With `callLabel`, also an icon-only call button for narrow screens, named by the label and the number. At most one action sets `callLabel` |
| `button` | label, link, style (`primary`, `secondary`) | a button |
| `link` | label, link | a text link |
| `locales` | | the language switcher of a site with several [locales](#locales) |

`footer.blocks` fill the footer in groups, which a theme usually shows as columns: each block starts a group, unless it sets `withPrevious: true` to join the one before it. `footer.bottom` is the last row. Both take these types:

| Type | Props | Shows |
| --- | --- | --- |
| `brand` | text | the logo or the site name, and a line of text |
| `contact` | title, address, phone, email | the contact details, with `tel:` and `mailto:` links |
| `links` | title, links | a nav of links, named by its title, or by `ui.footerNav` without one. At most one `links` block goes without a title |
| `hours` | title, rows (days, time) | rows such as opening hours |
| `text` | title, text | a paragraph |
| `copyright` | text | "©", the year, and the text or the site name |
| `locales` | | the language switcher of a site with several [locales](#locales) |

```yaml
header:
  actions:
    - type: phone
      number: (218) 555-0142
      callLabel: Call
    - type: button
      label: Get an estimate
      link: /contact
footer:
  blocks:
    - type: brand
    - type: contact
      withPrevious: true
      address: |-
        1420 Mill Street
        Fenwick Falls, MN 56645
    - type: hours
      title: Hours
      rows:
        - days: Mon-Fri
          time: 7:30 AM - 5:00 PM
  bottom:
    - type: copyright
      text: Kestrel Home Services LLC
```

### Facts

A fact that appears in several places, such as the phone number, is written once in the settings' `facts`, with a name the site picks. Any text in the content uses it as `{name}`: a block's or section's prop, a page's or entry's frontmatter, or a Markdown body. The build fills in the value before checking the content, so `email: "{email}"` is checked as an email address and a `phone` action builds its `tel:` link from the number. Markdown code stays as written.

```yaml
facts:
  - name: phone
    value: (218) 555-0142
header:
  actions:
    - type: phone
      number: "{phone}"   # quote a YAML value that starts with a brace
```

A name starts with a lowercase letter, then letters or digits. An unknown name fails the build with the file, the field and the defined facts. In the CMS, facts are a list under Settings, and the fields that usually hold one say so. In `npm run dev`, a changed fact shows on a page once that page's file changes or the server restarts.

## Interface strings

The settings' `ui` holds the text that isn't content: the kit's skip link, menu button, nav names, breadcrumb, "Read more" link and language switcher name, and the labels of the site's own templates, such as a blog post's "Keep reading". No visible text is written into a template, so the owner can change it in the CMS, and a site with several [locales](#locales) translates it with the rest of the settings.

A site declares its own keys as `siteUi` in `src/site.schema.ts`, each with the parameters its template fills in, and the parameter that picks its plural form, if any:

```ts
import { uiString } from "@hostsmith/site-kit-astro/schema";

export const siteUi = {
  keepReading: uiString(),
  // "4 min read": `minutes` picks the plural form.
  minRead: uiString({ params: ["minutes"], plural: "minutes" }),
};
```

The settings give each key its text. A plural string is an object of [CLDR plural forms](https://cldr.unicode.org/index/cldr-spec/plural-rules): `other`, and every other form the locale's language uses, such as `one` for English and German, or `one`, `few` and `many` for Polish.

```yaml
ui:
  keepReading: Keep reading
  minRead:
    one: "{minutes} min read"
    other: "{minutes} min read"
```

In a value, `{name}` is a parameter when the key declares `name`, and a [fact](#facts) otherwise. A key starts with a lowercase letter, then letters or digits. The build fails, naming the key and the file, on a key that collides with one of the kit's, a declared key without a value, a value without a declared key, and a plural form the language needs and the value lacks.

Each key also needs a field in the site's Decap part, under `ui`. A plural string's fields are the kit's plural forms:

```yaml
ui:
  - { name: keepReading, label: Blog post - heading of related posts, widget: string }
  - { name: minRead, label: "Blog post - reading time, with {minutes}", widget: object, fields: *plural_forms }
```

The build fails when `siteUi` and these fields differ. A template reads the strings with `getUi`, for its page's locale, and gives each one its field attribute:

```astro
---
import { getUi } from "@hostsmith/site-kit-astro/ui";

const ui = await getUi(Astro.props.locale);
---

<span {...ui.field("minRead")}>{ui.text("minRead", { minutes })}</span>
```

`text` formats a number parameter for the locale. An unknown key fails the build, naming the keys that exist.

## Locales

Every site lists its languages as `locales` in `src/site.config.ts`, the default first. A site in one language lists one:

```ts
locales: [{ code: "en", tag: "en-US" }],
```

The default locale is served at the root, and each other one under its path, as Webflow does. A locale's tag sets its pages' `lang`, their date and number formats, and the plural forms of its [interface strings](#interface-strings). Every content file names its locale, so adding a language adds files beside the existing ones and renames none. Only a site with more than one locale gets locale prefixes, translated URL segments, [link localization](#links), alternates and a [language switcher](#language-switcher). A site with two:

```ts
export const siteConfig = {
  url: "https://www.example.com",
  locales: [
    { code: "en", tag: "en-US" },
    { code: "de", tag: "de-DE", path: "/de" },
  ],
  collections: {
    news: { basePath: { en: "/blog", de: "/aktuelles" } },
  },
} as const;
```

| Option | What it is | Default |
| --- | --- | --- |
| `code` | the locale's suffix in content file names and its CMS key, lowercase, such as `de` or `fr-ca` | required |
| `tag` | the BCP 47 tag for `lang`, `hreflang`, `og:locale` and formatting | the code |
| `path` | the URL prefix of a locale other than the default, one lowercase segment | `/` and the tag lowercased, such as `/de-de` |
| `label` | its name in the language switcher | the language's own name, such as "Deutsch", with the region when two locales share a language |
| `dir` | `ltr` or `rtl` | the tag's script direction |

A collection's `basePath` is one path for every locale, or one per locale.

### Content per locale

Every page, entry and settings file has its locale code before its extension, the default locale's included. A translation sits beside its source, with the same name and its own code:

```
src/content/
  pages/
    home.en.md  404.en.md  about.en.md  services.en.md  careers.en.md
    home.de.md  404.de.md  about.de.md  services.de.md
    services/
      painting.en.md
      painting.de.md
  news/
    fresh-rye.en.md  opening-hours.en.md
    fresh-rye.de.md
  settings/
    site.en.yml
    site.de.yml
```

An entry's id is its file's path without the extension, such as `services/painting.de`, and its field attributes name it the same way: `pages/services/painting.de#title`. Every locale has its settings, its `home` and its `404` page. Any other page or entry may exist in some locales only, such as `careers` above. A content file without one of the site's locales in its name fails the build, naming the file.

The kit loads every collection from its folder, so `src/site.schema.ts` declares a collection by its schema alone, as `news: { schema: z.strictObject({ ... }) }`. A collection that sets a `loader` fails the build.

Each locale's settings hold its name, nav, header actions, footer blocks, SEO defaults, facts and interface strings. Their language is the locale's tag: a settings file doesn't set `language`, and the settings that `getSettings` returns have it from the tag. Every locale's settings define the same fact names and interface string keys, and in a site with several locales, `ui.locales` names the language switcher. The build fails naming the file and what it lacks. Content in a locale fills in its facts from its own locale's settings.

### URLs

A locale's `home` is served at its prefix, `/de` for German, and its other pages at the prefix plus their path. A translation can give its URL segment in its own language with `localSlug`, page by page, so a nested page's URL is built segment by segment:

```yaml
# src/content/pages/services.de.md
title: Leistungen
localSlug: leistungen
```

```yaml
# src/content/pages/services/painting.de.md
title: Malerarbeiten
localSlug: malerarbeiten
```

| File | URL |
| --- | --- |
| `pages/services/painting.en.md` | `/services/painting` |
| `pages/services/painting.de.md` | `/de/leistungen/malerarbeiten` |
| `news/fresh-rye.en.md` | `/blog/fresh-rye` |
| `news/fresh-rye.de.md`, with `localSlug: frisches-roggenbrot` | `/de/aktuelles/frisches-roggenbrot` |

The default locale's pages and entries use their file names, without the locale. A `localSlug` there, on `home` or on `404`, or in a site with one locale, fails the build, as do two files with one URL. A hand-written page in `src/pages/` belongs to the locale whose prefix starts its URL, so `src/pages/de/impressum.astro` has the German header and footer.

### Links

Content writes an internal link as its target's path in the default locale, in every locale: `/contact`, never `/de/kontakt`. On a German page, the kit turns each link to a page or entry that has a German translation into the translation's URL, with its query and fragment, wherever the link comes from: a section, the settings, a Markdown body or the site's own markup. A link to a page without a German translation stays as written, and leads to the default locale's page. A link that already starts with a locale's prefix, such as `/de/kontakt`, also stays as written, and breaks when that page's `localSlug` changes: the build doesn't check internal links.

A `collection-list` section lists the entries of its page's locale. Site code gets them with `getEntryRoutes(collection, locale)`, and builds a link the HTML doesn't hold as an `a`, such as one a script reads, with `localizedPath(path, locale)` from `@hostsmith/site-kit-astro/locales`.

### Language switcher

The header action and the footer block `locales` list every locale by its label. Each links to the current page's translation in that locale, or to that locale's home when the page has none, and carries `lang` and `hreflang`. The current locale has `aria-current="page"`. The switcher is plain links, so it works without scripts. A site with several locales and no switcher builds with a warning. With one locale, the switcher renders nothing.

```yaml
header:
  actions:
    - type: locales
```

### SEO

Every page has its locale's `lang`, and in a site with several locales, its `dir`. A page with translations links to each of them, itself included, with `hreflang`, and to the default locale's as `x-default`. Its `og:locale` is its tag, with `og:locale:alternate` for the others. The sitemap lists every locale's URLs, each with its alternates. Each locale's `404` page is written to its prefix, as `/404.html` and `/de/404.html`, so a host that serves the nearest `404.html` shows a visitor the one in their language.

### Custom pages

A `template: custom` page is rendered in every locale that has it by its page template, `src/components/pages/<page>.astro`, where the page is its entry id without the locale, such as `about` for `about.de.md`. The template gets the page's `entry`, `locale` and `path`, and reads its page through `customPage`:

```astro
---
import Sections from "@hostsmith/site-kit-astro/components/Sections.astro";
import { customPage } from "@hostsmith/site-kit-astro/custom-page";
import Base from "@hostsmith/site-kit-astro/layouts/Base.astro";

const { entry, locale, path } = Astro.props;
const { ref, data } = await customPage(entry);
---

<Base title={data.title} description={data.description} image={data.ogImage} path={path} locale={locale}>
  <Sections entry={ref} title={data.title} sections={data.sections ?? []} />
</Base>
```

A custom page has no props of its own, since the CMS can't translate the files collection that would edit them. Its content is the common page fields and its sections, with a site section type for anything the library lacks, and an unknown frontmatter key fails the build. The template may show any of its sections in its own markup, as `basics`' about page shows its first section, a hero, with `sectionFields` for the field attributes. A hand-written page in `src/pages/` still renders a custom page at its one URL, and names the page by its entry id: `customPage("about.en")`. A page with both a page template and a hand-written page, or with neither, fails the build.

### Translating

To translate a page or an entry, copy its file beside it with the other locale's code, such as `about.en.md` to `about.de.md`, and translate its text. Keep its section ids: the same section has the same id in every locale, and `npm run section-id` prints an id that no translation of the page has used. Give it a `localSlug` if its URL segment should be in its language.

In the CMS, the pages, the collections and the settings show each locale side by side. `npm run decap-config` writes the Decap config's `i18n` settings from `locales`, for one locale or several, with the settings as one entry per locale and, with several, a `localSlug` field for translations and a hint on every `link` field, the site's own too, to write a page's path in the default locale, as [Links](#links) says. With one locale, Decap shows a language menu with that locale only, and an empty "Fill in from another locale" menu, on every entry.

### Adding a language

To add German to a site whose default locale is English:

1. Add German to `locales` in `src/site.config.ts`, such as `{ code: "de", tag: "de-DE", path: "/de" }`. Without `path`, its URL prefix is the tag lowercased, `/de-de`. Give each collection whose German path differs a base path per locale.
2. In `settings/site.en.yml`, set `ui.locales`, such as "Language", and add a `locales` header action or footer block. Copy the file to `settings/site.de.yml`, and translate it: the nav, the interface strings, and the facts' values under the same names.
3. Style the switcher's hooks, `sk-locales`, `sk-locales__list`, `sk-locales__item` and `sk-locales__link`, and `sk-footer__block--locales` for a footer block, in the theme's `layout.css`, as `basics`' theme does. A theme from before 0.6 has no rules for them.
4. Copy `pages/home.en.md` and `pages/404.en.md` to `pages/home.de.md` and `pages/404.de.md`, and translate them. Translate the other pages and entries the German site should have, as in [Translating](#translating).
5. Have each collection template take the `locale` prop it receives, and pass it to `getSettings`, `getUi` and `getEntryRoutes`, as `basics`' blog template does.
6. Run `npm run decap-config`, `npm run build`, `npm run check:urls` and `npm run check:styles -- --built`. The default locale's URLs stay as they were, so the old site's URL list still passes, and `--built` names any switcher hook the theme doesn't style yet.

## Styling

The kit ships no CSS. Its markup is semantic and accessible, and carries styling hooks: `sk-` classes for every part (`sk-hero`, `sk-hero__title`), modifier classes for variants and tones (`sk-hero--page`, `sk-tone-dark`), and attributes for states (`data-open` on the menu, `aria-current` on the current page). [`HOOKS.md`](./packages/site-kit-astro/HOOKS.md) lists them all, for the layout (`header`, `menu`, `nav`, `footer`, `breadcrumb`) and every section type. A site's stylesheet styles them, so an example's look and a client's look are each the site's own, and a kit update never changes how a site looks.

Without any CSS, a kit page reads as a plain HTML document. The kit keeps its accessibility promises in markup: landmarks, one `h1`, alt texts, keyboard use of the menu and the FAQ, names for icon-only controls. Contrast, focus styles, target sizes and motion are the stylesheet's to get right.

## Themes

Every example carries its look as a theme, in one folder. A site takes the theme with its example and owns it from then on:

```
src/styles/
  global.css             imports Tailwind, the theme and site.css, in their layers
  theme/
    README.md            the design's roles, color schemes and contrast pairs
    tokens/
      colors.css         the active color scheme: one @import of a preset
      type.css           fonts and the text scale
      shape.css          radii and shadows
      space.css          content width, section spacing, gutter, breakpoint
    presets/
      colors/
        navy.css         a color scheme
        pine.css         another one
    fonts.css            @font-face rules for the fonts in public/assets/fonts/
    base.css             element defaults: page colors, fonts, focus ring, reduced motion
    layout.css           the skip link, header, menu, breadcrumb and footer
    sections.css         every section type, variant and tone
    prose.css            rendered markdown (sk-prose)
  site.css               the site's own CSS, kept when the theme changes
```

`global.css` imports the token files and `fonts.css` first. Then it imports `base.css` into Tailwind's `base` layer and the other three style files into its `components` layer, and `site.css` last, outside a layer. So utilities in the site's own markup win over the theme: `<a class="sk-button sk-button--primary w-full">` is full width. `site.css` wins over both.

What goes where:

- **Theme files** style the kit's hooks in plain CSS, reading the tokens as variables. A rule that reads a text role reads all four of its properties, which a utility such as `text-h1` sets at once:

  ```css
  .sk-hero__title {
    font-size: var(--text-h1);
    line-height: var(--text-h1--line-height);
    letter-spacing: var(--text-h1--letter-spacing);
    font-weight: var(--text-h1--font-weight);
  }
  ```

  No `@apply`, and no hand-written media queries: layouts switch with `@variant md` and `@variant max-md`.
- **The site's own markup**, its custom pages, collection templates and site sections, uses Tailwind utilities built from the tokens, such as `bg-surface`, `text-h2` or `md:grid-cols-2`. The token files reset Tailwind's default colors, fonts, text sizes, radii, shadows and containers, so only the theme's roles exist: `bg-red-500`, `text-4xl` or `max-w-6xl` render nothing. The spacing scale stays.
- **Raw values:** colors appear only in `tokens/colors.css` and the color presets, and font names only in `tokens/type.css` and `fonts.css`. Any other color, such as a shadow's, is mixed from a color role, so it follows the scheme. A value the site's markup shouldn't use goes in plain `:root`, not in `@theme`, so it makes no utility.
- **A theme styles every hook** in `HOOKS.md`, the variants and tones its own example doesn't use included, so any site content looks right with any theme.
- **A theme meets the accessibility duties** only CSS can: contrast of at least 4.5:1 (3:1 for large text) in every color scheme, a visible focus style, a skip link that shows on focus, buttons and header controls of at least 44 by 44 pixels, a menu hidden only while it is `[data-ready]:not([data-open])`, a `display` rule on the menu button only with `:not([hidden])`, and no motion under `prefers-reduced-motion: reduce`.

### Color schemes

A theme's colors are presets in `theme/presets/colors/`, and `theme/tokens/colors.css` picks one with a single `@import`. `basics` ships `basics/navy`, its default, and `basics/pine`. Every preset defines the same color names. A site's own palette is a new preset with those names, never an edit to a shipped one.

The theme's `README.md` lists the text and background pairs its rules use. `npm run check:styles` fails on a preset whose color names differ from the others', or that fails one of those pairs.

### Token roles

The kit owns no list of token roles: a site's design may rename, add or drop them. The kit's own examples define the same roles, so the site's own markup works with any example's theme:

| Tokens | Role |
| --- | --- |
| `--color-bg`, `--color-fg` | page background, text |
| `--color-surface`, `--color-tint` | cards and alternate sections; icon tiles, placeholders and badges |
| `--color-muted`, `--color-border` | secondary text; rules and input borders |
| `--color-brand` | eyebrows, numbers, the focus ring |
| `--color-accent`, `--color-accent-fg` | the main call to action, and text on it |
| `--color-on-dark`, `--color-error` | secondary text on dark sections; form errors |
| `--font-heading`, `--font-body` | heading and body fonts |
| `--text-display`, `--text-h1`, `--text-h2`, `--text-h3`, `--text-quote`, `--text-lead`, `--text-body`, `--text-small`, `--text-eyebrow` | the type scale, each with its line height, letter spacing and weight |
| `--radius-tag`, `--radius-input`, `--radius-card`, `--radius-panel`, `--radius-button` | radii by element |
| `--shadow-raised`, `--shadow-overlay` | shadows |
| `--container-site`, `--spacing-section`, `--spacing-gutter` | the content width, section spacing and side gutter |
| `--breakpoint-md` | the width where the header's nav appears, and where `md:` switches |

### Swapping a theme

To give a site another example's look:

1. Copy `src/styles/theme/` and `public/assets/fonts/` from that example, at the release tag of the kit version the site uses. To keep the site's colors, keep its `tokens/colors.css` and its own preset, and check that the preset defines the new theme's color roles.
2. Run `npm run check:styles`, `npm run build` and `npm run check:styles -- --built`.
3. Review the site's own markup, whose colors and fonts follow the tokens but whose spacing was tuned to the old look, and its content's tones and variants.

## What a site may rely on

The kit's public API is what a minor release keeps working:

- the integration and its options, `siteKit({ url, collections, locales })` in `astro.config.mjs`;
- the exports of `src/site.schema.ts`, `siteSectionSchemas`, `siteCollections`, each collection as its schema alone, and the optional `siteUi`;
- the paths the kit reads from the site: `src/site.config.ts`, `src/site.schema.ts`, `src/components/sections/site/*.astro`, `src/components/collections/<collection>.astro`, `src/components/pages/<page>.astro`, `src/pages/**/*.astro`, `src/styles/global.css`, and the content in `src/content/`, one file per page, entry or settings and locale, such as `pages/about.en.md`;
- the styling hooks and state attributes in [`HOOKS.md`](./packages/site-kit-astro/HOOKS.md);
- the package's exports:

| Import | What it gives |
| --- | --- |
| `@hostsmith/site-kit-astro` | the integration |
| `@hostsmith/site-kit-astro/content` | `collections`, for `src/content.config.ts`, and the `Section` type |
| `@hostsmith/site-kit-astro/schema` | field types and helpers for `src/site.schema.ts`, `uiString` among them |
| `@hostsmith/site-kit-astro/field` | `field` and `sectionFields`, for field attributes |
| `@hostsmith/site-kit-astro/markdown` | `renderMarkdown` and `assertNoH1` |
| `@hostsmith/site-kit-astro/settings` | `getSettings(locale)`, `settingsRef(locale)` and `SETTINGS` |
| `@hostsmith/site-kit-astro/ui` | `getUi(locale)`, for [interface strings](#interface-strings) |
| `@hostsmith/site-kit-astro/locales` | `locales`, `localized`, `localeOfPath(path)` and `localizedPath(path, locale)`, for the site's [locales](#locales) |
| `@hostsmith/site-kit-astro/routes` | `getEntryRoutes(collection, locale)` |
| `@hostsmith/site-kit-astro/custom-page` | `customPage(entry)`, for `template: custom` pages and page templates |
| `@hostsmith/site-kit-astro/components/Sections.astro` | renders a list of sections |
| `@hostsmith/site-kit-astro/layouts/Base.astro` | the base layout |

Anything else in the package can change in any release, and the package doesn't let a site import it.

## Kit updates

A site takes kit release `0.6.1` on a branch, which the deploy workflow deploys to the preview site:

```bash
git switch -c kit-update/v0.6.1
npm install --save-exact @hostsmith/site-kit-astro@0.6.1
npm run decap-config
npm run check:styles
npm run build
npm run check:urls
npm run check:styles -- --built
```

Then commit, push, check the preview site and merge the branch to `main`. If npm reports a conflict on `astro`, the release notes name the `astro` version to install with the kit. A major release's notes give the steps for the site's files.

`check:styles` checks the site's theme against the new release's hooks. It fails on a hook the release no longer has, and warns about one it deprecates, naming the replacement. After the build, `--built` warns about hooks the site's pages carry and its theme doesn't style yet, such as a new variant, and about any class that no rule in the built CSS matches, such as a Tailwind default the theme resets. A hook is deprecated in a minor release before a major one removes it, so a site that clears the warnings at each update takes the major release without surprises (`HOOKS.md`, "Deprecated").

### From 0.5 to 0.6

0.6 names the [locale](#locales) in every content file's name, loads the site's collections itself, adds [interface strings](#interface-strings), and fixes what Decap and Sveltia couldn't save. A site's pages and URLs stay as they were, but its content files are renamed once. Follow the [v0.6.1 release notes](https://github.com/hostsmith/site-kit-astro/releases/tag/v0.6.1), and before the commands above:

1. Rename every content file with the default locale's code before its extension, with its history, so `pages/about.md` becomes `pages/about.en.md` and `settings/site.yml` becomes `settings/site.en.yml`:

   ```bash
   for file in $(find src/content -type f \( -name "*.md" -o -name "*.yml" \)); do
     git mv "$file" "${file%.*}.en.${file##*.}"
   done
   ```

2. Add `locales` to `src/site.config.ts`, with the settings' `language` as the tag, such as `locales: [{ code: "en", tag: "en-US" }]`. Then delete `language` from `settings/site.en.yml`: the build fails while the settings still set it.
3. In `src/site.schema.ts`, declare each collection by its schema alone, since the kit loads it: `news: defineCollection({ loader: glob(...), schema: ... })` becomes `news: { schema: ... }`. Remove the imports of `defineCollection` and `glob`.
4. Move each custom page's own props into sections, such as a `hero` with the `page` variant for its header, with an id from `npm run section-id`. Then either remove its `template: custom` and its hand-written page, or move its markup to a page template in `src/components/pages/`, which can show the hero in the old markup, as `basics`' about page does. Remove the custom pages' files collection, such as `custom-pages`, from `public/admin/config.site.yml`.
5. A hand-written page names its page entry with its locale, such as `customPage("about.en")`, and `customPage` takes no props. `pagePath` is gone: a page template gets its `path` as a prop.

Field attributes now name the locale, such as `settings/site.en#name`.

### From 0.4 to 0.5

0.5 makes the kit designless: a site's look moves into its own theme. Follow the v0.5.0 release notes, and also:

1. Install Tailwind at the versions the `basics` example pins, `4.3.3` for 0.5: `npm install --save-exact tailwindcss@4.3.3 @tailwindcss/vite@4.3.3`.
2. Add the script `"check:styles": "site-kit check-styles"` to `package.json`. The commands above need it.
3. Add the example's two style-check steps to `.github/workflows/hostsmith.yml`: "Check styles" before the build and "Check built styles" after it.
4. Delete `src/styles/tokens.css` once its colors are a preset, or once the site takes the example's color scheme, and the font files the new theme doesn't load.
5. Put `footer.links` and the `social` links in one untitled `links` block in `footer.bottom`. Two untitled `links` blocks fail the build, because their navs would share a name.
6. Move the site's own markup (custom pages, collection templates and site sections) to the theme's tokens. The theme resets Tailwind's default sizes, radii, shadows and containers, so classes like `text-4xl`, `max-w-6xl` or `rounded-lg` render nothing: use `text-h1`, `max-w-site` or `rounded-card`, and `sk-prose` in place of `prose`. `npm run check:styles -- --built` names every class left without a rule.

## Commands

In a site:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the site into `dist/`. Set `SITE_NOINDEX=true` for preview builds. |
| `npm run dev` | Starts the dev server. |
| `npm run section-id -- <page file>` | Prints a new section id for that page, unused in its translations too. |
| `npm run check:urls` | Checks that every path in `.hostsmith/old-urls.txt` has a page. Add `--live <url>` to check a deployed site. |
| `npm run check:styles` | Finds raw colors outside the color presets, font names outside `tokens/type.css` and `fonts.css`, arbitrary Tailwind values, `sk-` classes the installed kit doesn't list, and color presets that disagree or fail the theme's contrast pairs. Warns about deprecated hooks. The deploy workflow runs it before the build. |
| `npm run check:styles -- --built` | Warns about `sk-` classes in the built pages that the theme and `site.css` don't style. The deploy workflow runs it after the build. |
| `npm run decap-config` | Assembles `public/admin/config.yml`, with the `i18n` settings for the site's locales. Add `--check` to only check it. |

## Deploying to Hostsmith

`.github/workflows/hostsmith.yml` deploys a push to `main` to the production site (`site.id` in `hostsmith.json`), and a push to any other branch to the preview site. Each deploy runs in the GitHub environment named after its target, `production` or `preview`, and the repository's deployments list links to the site.

In the repository settings, under Environments:

1. In `production`, add the secret `HOSTSMITH_TOKEN`: a Hostsmith API token restricted to the production site, with "Custom" permissions `sites:read` and `files:write`. Under deployment branches, allow only `main`, so other branches can't use this token.
2. In `preview`, add the secret `HOSTSMITH_TOKEN`: a token restricted to the preview site, with the same permissions.

Private repositories on GitHub Free have no environment secrets. There, add one repository secret `HOSTSMITH_TOKEN` restricted to both sites instead.

Variables, in the repository or the environment:

| Setting | Kind | What it is |
| --- | --- | --- |
| `HOSTSMITH_PREVIEW_SITE_ID` | variable | The preview site. Without it, branch pushes only build. |
| `HOSTSMITH_PARTITION` | variable | `us` or `eu`, when the sites aren't in your account's home partition |
| `SITE_NOINDEX` | variable | `true` until the site's domain points to Hostsmith. Previews are always no-index. |

## Working on the kit

This repository is an npm workspace: the package in `packages/site-kit-astro/` and the examples in `examples/`, which use the package from the workspace. `npm ci` installs them, `npm run build` builds the `basics` example, and `npm test` runs the kit's tests. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Every example is also a reference site: each release deploys it to its production site, and each branch of this repository to its preview site.

## License

[MIT](./LICENSE). The examples' photos and fonts aren't covered: they're under their own licenses, listed in each example's `CREDITS.md`.
