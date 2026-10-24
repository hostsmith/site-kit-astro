# Kestrel theme

The look of the `basics` example, from the design canvas "Astro Small Business Kit". It styles the hooks in the kit's `HOOKS.md` (`node_modules/@hostsmith/site-kit-astro/HOOKS.md`) of the base layout and of the section types below, and the site's own markup uses its tokens through Tailwind utilities.

## Coverage

The theme doesn't style the parts in `HOOKS.md`'s "Parts", or a section type it doesn't list: `npm run check:styles -- --built` names their hooks when a page renders them.

| Covers | |
| --- | --- |
| Section types | `hero`, `rich-text`, `collection-list`, `services-grid`, `gallery`, `testimonials`, `faq`, `cta`, `hours-location`, `trust-bar`, `stats`, `steps`, `split`, `team`, `pricing-list` |
| Parts | none |
| Header nav from | `md`, 820 px |

## Files

| File | Holds | Travels to another design |
| --- | --- | --- |
| `tokens/colors.css` | the active color scheme: one `@import` of a preset | yes, with the preset |
| `presets/colors/*.css` | the color schemes | yes |
| `tokens/type.css` | the fonts and the text scale | with `fonts.css` and the font files |
| `tokens/shape.css` | radii and shadows | yes. Shadows take their color from `--color-fg` |
| `tokens/space.css` | content width, section spacing, gutter, breakpoint | no: the layout CSS is tuned to it |
| `fonts.css` | `@font-face` for `/assets/fonts/` | with `type.css` |
| `base.css` | element defaults: page colors, fonts, focus ring, reduced motion | no |
| `layout.css` | skip link, header and menu, breadcrumb, footer | no |
| `sections.css` | every section type, variant and tone, and the shared parts | no |
| `prose.css` | rendered markdown (`sk-prose`) | no |

`src/styles/global.css` imports them in this order, with `base.css` in Tailwind's `base` layer and the last three in its `components` layer, so utilities in the site's own markup win over them. `src/styles/site.css` comes last and isn't part of the theme.

Raw colors belong only in `tokens/colors.css` and the presets, and font names only in `tokens/type.css` and `fonts.css`. `npm run check:styles` fails on them anywhere else.

## Roles

Each role is a Tailwind token: a CSS variable for the theme's rules, such as `var(--color-accent)`, and utilities for the site's markup, such as `bg-accent`. Tailwind's own colors, fonts, text sizes, radii, shadows and containers are reset, so `bg-red-500`, `text-4xl`, `rounded-md` or `max-w-6xl` render nothing. Its spacing scale stays, for `p-4` or `gap-6`.

| Role | Tokens | For |
| --- | --- | --- |
| page background | `--color-bg` | the page, and text on dark |
| text | `--color-fg` | text, dark sections, the header button, shadows |
| surface | `--color-surface` | cards, the menu panel, surface sections |
| tint | `--color-tint` | icon tiles, badges, image placeholders |
| muted | `--color-muted` | secondary text |
| line | `--color-border` | rules and borders |
| brand | `--color-brand` | eyebrows, step numbers, links in prose, the focus ring |
| accent | `--color-accent`, `--color-accent-fg` | the main call to action, and the text on it |
| on dark | `--color-on-dark` | secondary text on dark |
| error | `--color-error` | form errors |
| fonts | `--font-heading`, `--font-body` | Bricolage Grotesque for headings, Figtree for text |
| text | `--text-display`, `-h1`, `-h2`, `-h3`, `-quote`, `-lead`, `-body`, `-small`, `-eyebrow` | each with `--line-height`, `--letter-spacing` and `--font-weight` |
| radii | `--radius-tag`, `-input`, `-card`, `-panel`, `-button` | by element, so a square-button look changes one token |
| shadows | `--shadow-raised`, `--shadow-overlay` | cards that lift, the menu panel |
| space | `--container-site`, `--spacing-section`, `--spacing-gutter` | the content width, the space between sections, the side gutter |
| breakpoint | `--breakpoint-md` | 820 px: where the header shows its nav, and where `md:` switches |

A text utility such as `text-h2` sets all four of a role's properties. A rule in the theme's CSS names each one:

```css
.sk-section__title {
  font-size: var(--text-h2);
  line-height: var(--text-h2--line-height);
  letter-spacing: var(--text-h2--letter-spacing);
  font-weight: var(--text-h2--font-weight);
}
```

Theme CSS switches layouts with `@variant md` and `@variant max-md`, never a hand-written media query, so it follows `--breakpoint-md`.

## Color schemes

| Scheme | File | |
| --- | --- | --- |
| `basics/navy` | `presets/colors/navy.css` | the design's colors, the default |
| `basics/pine` | `presets/colors/pine.css` | pine greens and cool neutrals, with an amber accent |

To switch, change the one line in `tokens/colors.css`:

```css
@import "../presets/colors/pine.css";
```

Every preset defines the same `--color-*` names. For the site's own colors, add a preset, such as `presets/colors/acme.css`, with the same names, and point `tokens/colors.css` at it. Don't edit a shipped preset. `npm run check:styles` checks every preset against the others and against the contrast pairs below.

## Contrast pairs

The text and background pairs the theme's rules use, and the WCAG AA minimum each needs: 4.5 for text, 3 for text at 24 px and larger. `npm run check:styles` checks every pair in every preset. A rule that puts a new pair together adds its row here.

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
| `--color-brand` | `--color-bg` | 4.5 |
| `--color-brand` | `--color-surface` | 4.5 |
| `--color-error` | `--color-surface` | 4.5 |
| `--color-accent` | `--color-fg` | 4.5 |
