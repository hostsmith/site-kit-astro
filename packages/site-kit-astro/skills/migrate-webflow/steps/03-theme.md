---
scope: kit
---

# 3. Theme

Port the old site's design onto the theme in `src/styles/theme/`, the `webflow` example's structural theme. Its breakpoints, text roles and element defaults already follow Webflow's, so the port fills in values and restyles parts that already work. Read `src/styles/theme/README.md` and the Client-First mapping, `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/references/client-first.md`, first.

Never copy Webflow's CSS. `webflow.css`, `normalize.css` and the site's own stylesheet, `<site>.webflow.css`, stay in the snapshot: read them, and write the theme's rules anew on its tokens. No `w-` class and no Webflow class name reaches the site.

Run `npm run check:styles` before you change anything. It passes on the example's theme.

## Tokens from the Webflow variables

The site's stylesheet, `.hostsmith/snapshot/code/css/<site>.webflow.css`, defines Webflow's variables as custom properties in `:root`, named `--_<group>---<name>`, such as `--_colors---cream` or `--_typography---size-h1`. Its media queries redefine some of them at 991, 767 and 479 px, on `:root`, on `body` or on a wrapper such as `.page-wrapper`: read every rule in each media query that sets a variable. A site without variables gets its values from its most used colors, sizes and spacings instead.

### Colors

1. **Roles:** map each color onto one of the theme's color roles (`src/styles/theme/README.md`, "Roles") by what the old site uses it for: the `body` background is `--color-bg`, the `body` text `--color-fg`, the secondary text `--color-muted`, the rules and borders `--color-border`, the eyebrows and highlighted words `--color-brand`, the main button's background and text `--color-accent` and `--color-accent-fg`, the alternate sections `--color-surface`, and the secondary text on dark sections `--color-on-dark`. The names usually tell: `cream` is the page background, `ink` the text, `ink-muted` the muted text, `green` the brand and `brown` the accent.
2. **Site colors:** a color with no role, such as `cream-dark`, becomes a named site color, such as `--color-cream-dark`. A role the old site doesn't define, such as `--color-error`, gets a value that fits its palette and passes its contrast pairs.
3. **The preset:** write one preset named after the site, such as `src/styles/theme/presets/colors/acme.css`, in the form of `neutral.css`, with every role and every site color. Point `src/styles/theme/tokens/colors.css` at it, delete `neutral.css`, and list the site's preset in the README's "Color schemes" in its place. Every preset defines the same names, so the site keeps one.

### Type

- **Fonts:** see "Fonts" below. Until their files arrive, `--font-heading` and `--font-body` name the family, then a fallback stack, such as `"Space Grotesk", ui-sans-serif, system-ui, sans-serif`.
- **Text roles:** write each role in `src/styles/theme/tokens/type.css` from the variables and the rules that use them, with its size, line height, letter spacing and weight. `--_typography---size-h1`, with the line height, tracking and weight of the rule for `h1`, becomes `--text-h1` and its three properties. The Client-First mapping maps `heading-style-*` and `text-size-*` onto the roles. A role the old site doesn't use keeps a value in its scale.
- **Per breakpoint:** a value the variables change at 991, 767 or 479 px changes in the `:root` rule under `@variant max-lg`, `max-md` or `max-sm`, in the same token file, as the theme already does. Write only the values that change.

For example, `--_typography---size-h1: 4.25rem`, redefined as `3.5rem` under `max-width: 991px` and `2.625rem` under `max-width: 767px`, becomes:

```css
@theme static {
  --text-h1: 4.25rem;
}

:root {
  @variant max-lg {
    --text-h1: 3.5rem;
  }

  @variant max-md {
    --text-h1: 2.625rem;
  }
}
```

### Space, radius and shadows

- **Space,** in `src/styles/theme/tokens/space.css`: the widest container, `container-large`, is `--container-site`, the section spacing the old site uses most is `--spacing-section`, and the side padding, `padding-global`, is `--spacing-gutter`. Other containers and section spacings become tokens of their own in `@theme`, such as `--container-small` and `--spacing-section-large`, so site markup can use them as `max-w-small` and `py-section-large`. Their values per breakpoint go under the variants, as for type.
- **Spacing inside sections,** such as `--_spacing---space-m: 1rem`, needs no token: write it as a length in theme CSS, or as Tailwind's spacing scale in site markup, where `gap-4` is 1rem.
- **Radii,** in `src/styles/theme/tokens/shape.css`: map the radius variables onto `--radius-tag`, `--radius-input`, `--radius-card`, `--radius-panel` and `--radius-button` by the elements that use them.
- **Shadows:** `--shadow-raised` and `--shadow-overlay`, each mixed from a color role, as the theme's are.

## Fonts

For each font family the export's CSS names, in an `@font-face` rule, a variable or a rule, find out where it comes from, and its license where one can be established:

| Source | How to tell | Recommend |
| --- | --- | --- |
| A file in the export | an `@font-face` whose file is in `.hostsmith/snapshot/code/fonts/` | the file, with its license: for an open font, its license text beside it. Otherwise ask the owner for the license |
| An upload the export left out | an `@font-face` whose `src` points at no file, such as `url('../images/')` | for an open font, where to get the files and their license text. For a font under an unknown license, ask the owner for the files and the license |
| Google Fonts | `WebFont.load` with `google` families in the pages' head | the font's files and license text, to host with the site. The site never loads a font from Google |
| Adobe Fonts | `use.typekit.net` in the pages' head | the nearest open font, naming both. Adobe Fonts doesn't allow hosting its files elsewhere. If the owner would rather keep Adobe's embed, raise it with the developer: the kit's layout has no place for it, and the privacy notice must name Adobe |
| The system's | no `@font-face`, and a generic or system family | nothing |

Never download a font file yourself, from any source. Tell the person what you found, recommend a next step, and wait. For example: "Space Grotesk is under the SIL Open Font License. Take the variable WOFF2 and `OFL.txt` from Google Fonts or Fontsource, and put them in `public/assets/fonts/`."

When the person adds the files, or confirms another option:

- write an `@font-face` for each file in `src/styles/theme/fonts.css`, from `/assets/fonts/`, with `font-display: swap`, and the weights and styles each file covers;
- keep the license text beside the files, such as `public/assets/fonts/OFL.txt`;
- add a row for the font to `CREDITS.md`, with its source and license.

Until then, the theme uses the fallback stack. The report's "Fonts" lists each font, what you found, your recommendation and whether its files arrived. A font file in the export under a license you can't establish is listed in `CREDITS.md` as awaiting the owner's confirmation, as the kit's rules on third-party files say, and the report names it.

## Element defaults, header and footer

- **Element defaults,** in `src/styles/theme/base.css`: the page's font, size and colors, headings, paragraphs, links, lists, blockquotes and figures, from the export's rules for `body`, `h1` to `h6`, `p`, `a` and the like. Client-First's global styles embed, a `<style>` in a `w-embed` on every page, holds more of these, such as font smoothing: port its rules too.
- **Buttons:** the old `button` class and its combo classes become the rules for `.sk-button`, `.sk-button--primary` and `.sk-button--secondary`, in `src/styles/theme/sections.css`.
- **Header and menu,** in `src/styles/theme/layout.css`: from the navbar's rules, such as `navbar_component`, its links, logo, buttons and menu. The theme already shows the nav from `lg`, where Webflow's navbar collapses by default.
- **Footer,** in `src/styles/theme/layout.css`: its columns, headings, links, logo and bottom row.
- **Rich text,** in `src/styles/theme/prose.css`: from the export's rules for its rich text elements, such as a blog post's body.

Keep the theme's rules that make the parts work: what hides, collapses and sizes them, `[data-ready]`, `:not([hidden])`, the focus styles and the 44 px targets. Restyle only how they look.

Step 5 styles each section as it ports it, with the same rules as below, from the export's CSS, and settles the theme on a sample of pages before it ports the rest.

## How to rewrite a rule

- **Breakpoints:** a rule in `@media screen and (max-width: 991px)` goes inside the theme's rule as `@variant max-lg`, `767px` as `@variant max-md`, and `479px` as `@variant max-sm`. In site markup, these are the `max-lg:`, `max-md:` and `max-sm:` utilities. Never write a media query.
- **Variables and values:** `var(--_colors---green)` becomes its role, `var(--color-brand)`, and a raw color its role or site color. A rule that reads a text role reads all four of its properties. Font names appear only in `tokens/type.css` and `fonts.css`.
- **Kit parts:** style a library type or the layout through its hooks in `node_modules/@hostsmith/site-kit-astro/HOOKS.md`, such as `.sk-hero__title`, never through its elements' nesting or order. Every difference of look a library type shows, its colors, band, borders, spacing, sizes, type, capitals, decoration and the arrangement of its elements at each width, is fixed here.
- **Site variants,** from step 5: style each in `src/styles/theme/sections.css`, beside the site-local types' styles. Select the root by its block class and the attribute, and its elements only by their hooks and states, such as `.sk-faq[data-site-variant="boxed"] .sk-faq__item`, or `::before` for drawn quote marks: `npm run check:styles` fails on an element name or a position, such as `li` or `:nth-child`. Take its colors from a tone where one fits.
- **Site-local types,** from step 5: give their elements class names of their own, after the type, such as `.amenities` and `.amenities__icon`, and style them in `src/styles/theme/sections.css`, or with utilities in their markup. Every class needs a rule or is a utility: `npm run check:styles -- --built` warns about one with neither. A site-local navbar's links collapse below the theme's nav breakpoint, as step 5 says: hide its `summary` from that breakpoint up, and show the links as a row there.
- **Client-First utilities:** see the Client-First mapping.
- **Focus styles:** a `:focus-visible` rule stays `:focus-visible`, so its ring shows for the keyboard and not on a click. When the old element was a link and the port puts the link inside it, such as a card whose title's link covers the whole card, ring the card with `:has(:focus-visible)`, such as `.entry-cards__item:has(.entry-cards__link:focus-visible)`. Never draw a ring with `:focus-within`, which also matches a click.

## Builder defaults

`webflow.css` gives each of Webflow's elements a default look, and the old site shows a default wherever its own stylesheet never sets that property or state. A Tabs element's selected tab, for example, is `#C8C8C8` grey from `.w-tab-link.w--current` when the site has no rule for its current state. These defaults are part of the old site's look, so the port keeps them, apart from the theme, where the owner can drop them:

1. **Find them.** For each element in the export's pages with a `w-` class, such as `w-tab-link`, `w-button`, `w-nav-link`, `w-dropdown-link` or `w-slider-dot`, read the rules for that class in `.hostsmith/snapshot/code/css/webflow.css`, its states included (`w--current`, `w--open`, `w--active`). A property one of them sets, which none of the site's own rules for the element's classes sets in the same state, shows on the old site.
2. **Keep each one** in `src/styles/theme/builder-defaults.css`, written anew on the hook of the kit part or site-local type that replaced the element, with the value the old site showed, never `webflow.css`'s rule. Its colors become site colors named `--color-builder-*` in the site's preset, such as `--color-builder-tab-current: #c8c8c8`. For the selected tab:

   ```css
   /* Webflow's defaults the old site showed (the report, "Builder defaults kept"). */
   .sk-tabs__tab[aria-selected="true"] {
     background-color: var(--color-builder-tab-current);
   }
   ```

3. **Import it** in `src/styles/global.css`, after the theme's rules and before `site.css`: `@import "./theme/builder-defaults.css" layer(components);`. Write the file and its import only when a default shows.
4. **List each one** in the report's "Builder defaults kept": where it shows and its old value. When one puts text on a background, add the pair to the README's contrast table, as for any other pair.

Webflow's default favicon and touch icon aren't styles: they're Webflow's logo, and step 4 never carries them.

## Check

```bash
npm run check:styles
```

It fails on a raw color outside the presets, a font name outside `tokens/type.css` and `fonts.css`, an arbitrary Tailwind value, an `sk-` class the kit doesn't have, and a preset that fails a contrast pair from the theme's README. The migration carries the old design as it was, its colors included, and asks nothing about them. When a pair fails with the old site's colors, keep the colors: write the pair's measured ratio, rounded down to two decimals, as its minimum in the README's contrast table, and list it under the table as the old site's, below WCAG's 4.5:1, or 3:1 for large text. `check:styles` then passes, and still fails a change that makes the pair worse. Step 9's accessibility check finds every pair the pages show, and the report's "Accessibility" notes each with a shade that passes. When the port's rules put a new text and background pair together, add its row to the README's contrast table.

Keep the README's opening line, which names the `webflow` example, and update its tables for what the port changed.
