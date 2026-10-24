# Structural theme

The look of the `webflow` example: structural only. It gives every hook in the kit's `HOOKS.md` (`node_modules/@hostsmith/site-kit-astro/HOOKS.md`) the rules it needs to lay out, work and stay accessible, in grays and system fonts, with no decoration. Its breakpoints, text roles and element defaults follow Webflow's, so a port of a Webflow design restyles parts that already work.

To port a design:

1. Add the Webflow site's colors as a preset in `presets/colors/`, with the names below, and point `tokens/colors.css` at it.
2. Put the site's fonts in `public/assets/fonts/` and `fonts.css`, and its text scale in `tokens/type.css`, from its variables.
3. Set the content width, section spacing and gutter in `tokens/space.css`.
4. Restyle the parts in `layout.css`, `sections.css` and `prose.css`, keeping the rules that hide, collapse and size them.

## Coverage

| Covers | |
| --- | --- |
| Section types | `hero`, `rich-text`, `collection-list`, `services-grid`, `gallery`, `testimonials`, `faq`, `cta`, `hours-location`, `trust-bar`, `stats`, `steps`, `split`, `team`, `pricing-list`, `tabs`, `slider`, `embed` |
| Parts | `highlight`, `nested-nav`, `lightbox`, `video`, `reveal` |
| Header nav from | `lg`, 992 px |

## Files

| File | Holds | Travels to another design |
| --- | --- | --- |
| `tokens/colors.css` | the active color scheme: one `@import` of a preset | yes, with the preset |
| `presets/colors/*.css` | the color schemes | yes |
| `tokens/type.css` | the fonts and the text scale, which shrinks below `lg` and `md` | with `fonts.css` and the font files |
| `tokens/shape.css` | radii and shadows | yes. Shadows take their color from `--color-fg` |
| `tokens/space.css` | content width, section spacing, gutter, breakpoints | no: the layout CSS is tuned to them |
| `fonts.css` | `@font-face` for `/assets/fonts/`: none, with system fonts | with `type.css` |
| `base.css` | element defaults close to Webflow's: headings, paragraphs, lists, blockquote, figure, form controls, focus ring, reduced motion | no |
| `layout.css` | skip link, header, menu and submenus, breadcrumb, footer | no |
| `sections.css` | every section type, variant and tone, the shared parts, and the interactive parts | no |
| `prose.css` | rendered markdown (`sk-prose`) | no |

`src/styles/global.css` imports them in this order, with `base.css` in Tailwind's `base` layer and the last three in its `components` layer, so utilities in the site's own markup win over them. `src/styles/site.css` comes last and isn't part of the theme.

Raw colors belong only in `tokens/colors.css` and the presets, and font names only in `tokens/type.css` and `fonts.css`. `npm run check:styles` fails on them anywhere else.

## Breakpoints

Webflow's, desktop first. A ported rule for one of Webflow's `max-width` media queries takes the matching variant:

| Webflow | Variant | Width |
| --- | --- | --- |
| `max-width: 991px` | `@variant max-lg` | below 62rem, 992 px |
| `max-width: 767px` | `@variant max-md` | below 48rem, 768 px |
| `max-width: 479px` | `@variant max-sm` | below 30rem, 480 px |

The header shows its nav from `lg`. Site-owned markup's `md:` and `lg:` utilities switch at the same widths. A token that a Webflow variable changes per breakpoint changes in a `:root` rule under the variant, as `tokens/type.css` and `tokens/space.css` do. Theme CSS never writes a media query of its own.

## Roles

Each role is a Tailwind token: a CSS variable for the theme's rules, such as `var(--color-accent)`, and utilities for the site's markup, such as `bg-accent`. Tailwind's own colors, fonts, text sizes, radii, shadows and containers are reset, so `bg-red-500`, `text-4xl`, `rounded-md` or `max-w-6xl` render nothing. Its spacing scale stays, for `p-4` or `gap-6`.

| Role | Tokens | For |
| --- | --- | --- |
| page background | `--color-bg` | the page, and text on dark |
| text | `--color-fg` | text, dark sections, the footer, shadows |
| surface | `--color-surface` | surface sections, embed placeholders |
| tint | `--color-tint` | icon tiles, image placeholders, code |
| muted | `--color-muted` | secondary text |
| line | `--color-border` | rules and borders |
| brand | `--color-brand` | highlighted words, the focus ring |
| accent | `--color-accent`, `--color-accent-fg` | the main button, and the text on it |
| on dark | `--color-on-dark` | secondary text on dark |
| error | `--color-error` | form errors |
| fonts | `--font-heading`, `--font-body` | system fonts |
| text | `--text-display`, `-h1`, `-h2`, `-h3`, `-quote`, `-lead`, `-body`, `-small`, `-eyebrow` | the roles every example shares, each with `--line-height`, `--letter-spacing` and `--font-weight` |
| more text | `--text-h4`, `-h5`, `-h6`, `-large`, `-medium`, `-tiny` | this theme's own, as Client-First's scale has them |
| radii | `--radius-tag`, `-input`, `-card`, `-panel`, `-button` | by element |
| shadows | `--shadow-raised`, `--shadow-overlay` | raised parts, dropdowns |
| space | `--container-site`, `--spacing-section`, `--spacing-gutter` | the content width, the space between sections, the side gutter |
| breakpoints | `--breakpoint-sm`, `--breakpoint-md`, `--breakpoint-lg` | 480, 768 and 992 px |

A text utility such as `text-h2` sets all four of a role's properties. A rule in the theme's CSS names each one.

## Color schemes

| Scheme | File | |
| --- | --- | --- |
| `webflow/neutral` | `presets/colors/neutral.css` | grays only, the default |

Every preset defines the same `--color-*` names. For the site's own colors, add a preset with the same names, and point `tokens/colors.css` at it. `npm run check:styles` checks every preset against the others and against the contrast pairs below.

## Contrast pairs

The text and background pairs the theme's rules use, and the WCAG AA minimum each needs: 4.5 for text, 3 for text at 24 px and larger. Highlighted words are `--color-brand` on the page and on surfaces, and the text color on dark and accent. `npm run check:styles` checks every pair in every preset. A rule that puts a new pair together adds its row here.

| Text | Background | Minimum |
| --- | --- | --- |
| `--color-fg` | `--color-bg` | 4.5 |
| `--color-fg` | `--color-surface` | 4.5 |
| `--color-fg` | `--color-tint` | 4.5 |
| `--color-muted` | `--color-bg` | 4.5 |
| `--color-muted` | `--color-surface` | 4.5 |
| `--color-bg` | `--color-fg` | 4.5 |
| `--color-on-dark` | `--color-fg` | 4.5 |
| `--color-accent-fg` | `--color-accent` | 4.5 |
| `--color-accent` | `--color-accent-fg` | 4.5 |
| `--color-brand` | `--color-bg` | 4.5 |
| `--color-brand` | `--color-surface` | 4.5 |
| `--color-error` | `--color-surface` | 4.5 |
