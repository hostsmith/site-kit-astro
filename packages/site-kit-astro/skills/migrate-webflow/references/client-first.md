# Client-First mapping

Most Webflow sites are built with Client-First, Finsweet's class system: a frame of wrapper classes, utility classes for text, spacing and color, and component classes named `<component>_<element>`, such as `home-hero_content`. This table maps its classes onto the `webflow` example's theme: its tokens, the utilities they make, and the kit's hooks.

No Webflow class name reaches the site. A utility class becomes a theme utility in site markup, or a rule on the theme's tokens in theme CSS. A component class becomes a class of the site-local type it ends up in, named after the type. The values below are Client-First's defaults: read the site's own from its stylesheet, since a site may change any of them.

A site that doesn't use Client-First goes through the same steps: derive the roles from its own classes, by what they do.

## Frame

| Client-First | Becomes |
| --- | --- |
| `page-wrapper`, `main-wrapper` | the kit's layout and its `main`: drop them |
| `section_<name>` | a section entry's root element: the type's own class, such as `.amenities` |
| `padding-global` | the gutter, `--spacing-gutter`: `px-gutter`. In the kit's parts, `sk-container` has it |
| `container-large` | the content width, `--container-site`: `mx-auto max-w-site`. In the kit's parts, `sk-container` |
| `container-medium`, `container-small` | tokens of their own, such as `--container-medium` and `--container-small`: `mx-auto max-w-medium` |
| `padding-section-medium` | the section spacing, `--spacing-section`: `py-section` |
| `padding-section-large`, `padding-section-small` | tokens of their own, such as `--spacing-section-large`: `py-section-large` |
| `skip-link` | the kit's skip link, in the layout: drop it |
| `global-styles`, the embed with Client-First's `<style>` | its rules, ported into `base.css` |

## Text

| Client-First | Becomes |
| --- | --- |
| `heading-style-h1`, `heading-style-h2`, `heading-style-h3`, `heading-style-h4`, `heading-style-h5`, `heading-style-h6` | the text roles `--text-h1` to `--text-h6`: `text-h1` to `text-h6` |
| `text-size-large` | `--text-large`: `text-large` |
| `text-size-medium` | `--text-medium`: `text-medium` |
| `text-size-regular` | `--text-body`: `text-body` |
| `text-size-small` | `--text-small`: `text-small` |
| `text-size-tiny` | `--text-tiny`: `text-tiny` |
| `text-style-tagline`, or a site's `text-style-eyebrow` | `--text-eyebrow`, in the brand color: `text-eyebrow text-brand`. In the kit's parts, the section's eyebrow |
| `text-style-quote` | `--text-quote`: `text-quote` |
| `text-style-allcaps` | `uppercase` |
| `text-style-italic` | `italic` |
| `text-style-strikethrough` | `line-through` |
| `text-style-nowrap` | `whitespace-nowrap` |
| `text-style-2lines`, `text-style-3lines` | `line-clamp-2`, `line-clamp-3` |
| `text-style-link` | a link styled as the site's links, in `base.css` |
| `text-style-muted` | `text-muted` |
| `text-weight-light`, `text-weight-normal`, `text-weight-medium`, `text-weight-semibold`, `text-weight-bold`, `text-weight-xbold` | `font-light`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `font-extrabold` |
| `text-align-left`, `text-align-center`, `text-align-right` | `text-left`, `text-center`, `text-right` |
| `text-rich-text` | the kit's rendered Markdown, `sk-prose`, styled in `prose.css` |

## Color

| Client-First | Becomes |
| --- | --- |
| `text-color-primary` | `text-fg` |
| `text-color-secondary` | `text-muted` |
| `text-color-alternate` | the text on dark, `text-bg` |
| `text-color-alternate-secondary` | the secondary text on dark, `text-on-dark` |
| `text-color-accent`, `text-color-brand` | `text-brand`. On a heading's words, a `==` highlight instead |
| `text-color-accent-light`, and other site colors | the role it does, or the site color of that name in the preset, such as `text-accent-light` |
| `background-color-primary` | the page background: no class, or the `plain` tone |
| `background-color-secondary`, `background-color-tertiary` | the `surface` tone of a library type, or `bg-surface` |
| `background-color-alternate` | the `dark` tone of a library type, or `bg-fg text-bg` |
| `is-alternate`, on a section or a card | the `dark` tone, or the type's own dark variant |
| `is-alternate`, on text such as an eyebrow | the secondary text on dark, `text-on-dark`, or the text on dark, `text-bg` |

## Spacing and size

| Client-First | Becomes |
| --- | --- |
| `margin-top`, `margin-bottom`, `margin-left`, `margin-right`, `margin-vertical`, `margin-horizontal`, with a size such as `margin-medium` | `mt-`, `mb-`, `ml-`, `mr-`, `my-` or `mx-`, with the size on Tailwind's spacing scale, where 1 is 0.25rem: `margin-top margin-medium`, at 2rem, is `mt-8` |
| `padding-top`, `padding-bottom` and the other `padding-` directions, with a size | `pt-`, `pb-` and so on, the same way |
| `margin-0`, `padding-0` | `m-0`, `p-0` |
| `spacer-tiny` to `spacer-huge` | a gap or margin on the elements around it, such as `gap-8`: drop the spacer element |
| sizes: `tiny` 0.125rem, `xxsmall` 0.25rem, `xsmall` 0.5rem, `small` 1rem, `medium` 2rem, `large` 3rem, `xlarge` 4rem, `xxlarge` 5rem, `huge` 6rem, `xhuge` 8rem, `xxhuge` 12rem | `0.5`, `1`, `2`, `4`, `8`, `12`, `16`, `20`, `24`, `32`, `48` on the spacing scale |
| `max-width-xxsmall`, `max-width-xsmall`, `max-width-small`, `max-width-medium`, `max-width-large`, `max-width-xlarge`, `max-width-xxlarge`, 20rem to 80rem | a token of its own, named by its use, such as `--container-text: 48rem` for `max-w-text` |
| `max-width-full` | `max-w-none` |
| `max-width-full-tablet`, `max-width-full-mobile-landscape`, `max-width-full-mobile-portrait` | `max-lg:max-w-none`, `max-md:max-w-none`, `max-sm:max-w-none` |
| `icon-1x1-small`, `icon-1x1-medium`, `icon-1x1-large`, and `icon-height-` with a size | `size-` or `h-` on the spacing scale, such as `size-8` for 2rem |

## Parts

| Client-First | Becomes |
| --- | --- |
| `button` | `sk-button sk-button--primary`, styled in `sections.css` |
| `button is-secondary` | `sk-button sk-button--secondary`. In content, the secondary of a pair, such as `secondaryCta`, or a `split`'s `link` with `style: secondary` |
| `button` with `is-text`, `is-small`, `is-large`, `is-icon` or `is-alternate` | utilities on the `sk-button`, such as `px-4 py-2 text-small`, or a class of the site's own in `sections.css` |
| `button` with `is-full-width` or `is-center` | `w-full`, `mx-auto` |
| `is-center`, on a component such as a section header | a library type's centered variant, or `mx-auto text-center` |
| `button-group` | `sk-buttons` in the kit's parts, or `flex flex-wrap gap-4` in site markup |
| `image-cover` | `size-full object-cover` |
| `overflow-hidden`, `pointer-events-none`, `pointer-events-auto` | the Tailwind utilities of the same names |
| `z-index-1`, `z-index-2` | `z-1`, `z-2` |
| `align-center` | `mx-auto` |
| `layer` | `absolute inset-0` |
| `form_*`, `form-message-success`, `form-message-error`, `is-text-area` | forms: the report's "Forms" |
| `fs-styleguide_*` | Finsweet's style guide page: not carried. Its values show the site's tokens |
| `utility-page-wrap`, `utility-page-content`, `utility-page-form` | Webflow's 404 and password pages: the 404 page's sections, or nothing |

## Visibility

Client-First's breakpoints are Webflow's, so they map one for one:

| Client-First | Webflow's media query | Becomes |
| --- | --- | --- |
| `hide` | | `hidden` |
| `hide-tablet` | `max-width: 991px` | `max-lg:hidden` |
| `hide-mobile-landscape` | `max-width: 767px` | `max-md:hidden` |
| `hide-mobile-portrait` | `max-width: 479px` | `max-sm:hidden` |

In theme CSS, a rule in one of these media queries goes under `@variant max-lg`, `max-md` or `max-sm`, inside the rule it changes.

## Component classes

A class named `<component>_<element>`, such as `home-amenities_item`, its combo classes, such as `is-featured`, and the component's own class, such as `check-list` beside `check-list_item`, belong to one component. Rename them after the site-local type they end up in, as `.amenities__item` and `.amenities__item--featured`, and rewrite their rules in `sections.css` on the theme's tokens. A component that becomes a library type loses its classes: the theme styles the type's hooks to look the same. A combo class that gives one of its uses a look of its own, such as `is-boxed` on one FAQ among plain ones, becomes a site variant of the type (step 5).
