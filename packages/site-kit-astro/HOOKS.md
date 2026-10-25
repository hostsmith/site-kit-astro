# Styling hooks

The kit ships no CSS. Its markup carries classes, the hooks, and a few state attributes, and a site's theme styles them. This file lists every hook and state. Together with the integration's options, the package's exports and the site paths the kit reads, they are the kit's public API.

How hooks change:

- A minor release can add a hook, a state, a variant, a tone or a section type.
- A rename or a removal takes two releases. First a minor release deprecates the hook: it keeps working, a renamed hook's element carries the old class and the new one, and its row moves to [Deprecated](#deprecated) with its replacement. A later major release removes it, never the same one.
- The release notes say what to change in a site's theme and content, under "Deprecated" and then "Removed". `npm run check:styles` warns about every deprecated hook a site's theme still styles.
- The nesting of the kit's elements isn't API. A minor release can change it, keeping the hooks.

How the hooks are named:

- `sk-<block>` for a component or section type, such as `sk-header` or `sk-hero`. Every section's root also has `sk-section` and `data-section="<type>"`.
- `sk-<block>__<part>` for a part of it, such as `sk-hero__title`.
- `sk-<block>--<variant>` for a variant, always set, the default included, such as `sk-hero--centered`.
- Parts that recur across sections share one class instead, such as `sk-section__title` or `sk-card`. Tell types apart through the block: `.sk-faq .sk-section__title`.

An element carries one part class, its own or a shared one, plus modifiers. The exceptions are `sk-prose`, which joins a part class on an element that holds rendered markdown, and a deprecated hook, which stays next to its replacement until a major release removes it.

States are attributes, never classes (see [States](#states)).

Unstyled, a kit page is a readable HTML document. Some elements the kit hides with the `hidden` attribute. A theme rule that sets `display` on them overrides `hidden`, so write such rules as `.sk-header__menu-button:not([hidden])`.

## Layout

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-skip-link` | `a` | The skip link to `main`, the first element of the page. Visible unstyled. A theme usually shows it only on focus |
| `sk-header` | `header` | The site header |
| `sk-header__brand` | `a` | The home link, holding the logo or the site name |
| `sk-header__logo` | `img` | The logo, when settings have one |
| `sk-header__name` | `span` | The site name, when settings have no logo |
| `sk-header__call` | `a` | An icon-only `tel:` link, from the `phone` action that sets `callLabel`. Usually shown only on narrow screens. Its accessible name is the `callLabel` and the number |
| `sk-header__menu-button` | `button` | Opens and closes the menu. `hidden` until the layout's script runs. Holds a `menu` icon, an `x` icon and the label |
| `sk-header__menu-label` | `span` | The menu button's text, from `ui.menu`. A theme can hide it visually and keep it for screen readers |
| `sk-menu` | `div` | The menu, rendered once: the nav and the header's actions. A row on wide screens, a panel on narrow ones: the theme decides where |
| `sk-nav` | `nav` | The main nav, named by `ui.mainNav` |
| `sk-nav__list` | `ul` | Its list |
| `sk-nav__link` | `a` | A nav link |
| `sk-header__actions` | `div` | The actions from `header.actions`, in order, inside the menu |
| `sk-header__phone` | `a` | A `phone` action: the number as a `tel:` link |
| `sk-header__link` | `a` | A `link` action: a text link. A `button` action is `sk-button` with `sk-button--primary` or `sk-button--secondary` |
| `sk-locales` | `nav` | The language switcher of a site with several locales, from a `locales` header action or footer block. Named by `ui.locales` |
| `sk-locales__list` | `ul` | Its list, one item per locale |
| `sk-locales__item` | `li` | One locale |
| `sk-locales__link` | `a` | A locale, by its label, with `lang` and `hreflang`: the current page in that locale, or its home page |
| `sk-main` | `main` | The page content |
| `sk-breadcrumb` | `nav` | The breadcrumb, first in `main` on every page whose path has more than one segment. Named by `ui.breadcrumb` |
| `sk-breadcrumb__list` | `ol` | Its list. Unstyled it reads as a numbered list: a theme draws the separators |
| `sk-breadcrumb__item` | `li` | One step |
| `sk-breadcrumb__link` | `a` | The home link, or a parent page by its title |
| `sk-breadcrumb__current` | `span` | The current page's title, not linked |
| `sk-footer` | `footer` | The site footer, when settings have footer blocks |
| `sk-footer__group` | `div` | One group of `footer.blocks`: a block and the blocks after it that set `withPrevious`. A theme usually lays groups out as columns |
| `sk-footer__bottom` | `div` | The last row: the blocks of `footer.bottom` |
| `sk-footer__block` | `div`, `nav` or `p` | Every footer block's root, with the modifier of its type |
| `sk-footer__block--brand` | `div` | A `brand` block: the logo or the site name, and its text |
| `sk-footer__block--contact` | `div` | A `contact` block: its title and the contact details |
| `sk-footer__block--links` | `nav` | A `links` block, named by its title, or by `ui.footerNav` without one |
| `sk-footer__block--hours` | `div` | An `hours` block: its title and rows |
| `sk-footer__block--text` | `div` | A `text` block: its title and text |
| `sk-footer__block--copyright` | `p` | A `copyright` block: "©", the year, and its text or the site name |
| `sk-footer__block--locales` | `div` | A `locales` block: the language switcher, `sk-locales` |
| `sk-footer__logo` | `img` | The logo in a `brand` block, when settings have one |
| `sk-footer__name` | `span` | The site name in a `brand` block, when settings have no logo |
| `sk-footer__text` | `p` | A `brand` or `text` block's text |
| `sk-footer__title` | `h2` | A block's title |
| `sk-footer__contact` | `address` | A `contact` block's details |
| `sk-footer__address` | `span` | The postal address, its lines split by `br` |
| `sk-footer__links` | `ul` | A `links` block's links |
| `sk-footer__link` | `a` | A footer link, or a `contact` block's phone or email link |
| `sk-footer__hours-list` | `dl` | An `hours` block's rows |
| `sk-footer__hours-row` | `div` | One row: days (`dt`) and time (`dd`) |

## States

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-menu` | The layout's script has run. Hide the menu only while it is `[data-ready]:not([data-open])`, so it stays usable without scripts |
| `data-open` | `sk-menu` | The menu is open |
| `aria-expanded` | `sk-header__menu-button` | `true` while the menu is open |
| `aria-current` | `sk-nav__link`, `sk-breadcrumb__current`, `sk-locales__link` | `page` on the link to the current page, on the breadcrumb's last step, and on the switcher's current locale |

## Other attributes

Attributes that name something rather than a state. A theme may select on them, but needn't.

| Attribute | Element | Holds |
| --- | --- | --- |
| `data-icon` | `sk-icon` | The icon's name, such as `menu` or `x`, to tell icons apart. Show one of the menu button's icons with `[aria-expanded="true"]` |
| `data-section` | `sk-section` | The section's type, the same as its block class. Prefer the block class |

## Shared parts

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-container` | `div` | The content width inside the header, the footer and every section |
| `sk-section` | `section` | The root of every section, next to its type's block class |
| `sk-section__header` | `div` | A section's heading group: eyebrow, title and intro |
| `sk-section__title` | `h2` | A section's title |
| `sk-section__intro` | `p` | The text under a section's title |
| `sk-section__link` | `a` | A link after the title, such as "All services" |
| `sk-eyebrow` | `p` | A short label above a title, such as "About us" |
| `sk-buttons` | `div` | A group of buttons |
| `sk-button` | `a` | A button-styled link, in a section or as the header button |
| `sk-button--primary` | `a` | The main action |
| `sk-button--secondary` | `a` | A second action beside it |
| `sk-card` | `li` | One item of a card list: a service or a collection entry |
| `sk-card--linked` | `li` | A card whose title is a link. Stretch the link over the card to make the whole card the target |
| `sk-card--featured` | `li` | The first card of a `featured` collection list |
| `sk-card__media` | `img` | The card's image |
| `sk-card__body` | `div` | The card's text |
| `sk-card__icon` | `span` | The tile around an item's icon, first in the body |
| `sk-card__category` | `p` | A collection entry's category, before its title |
| `sk-card__title` | `h3` | The card's title, holding a link when the item has one |
| `sk-card__text` | `p` | The card's description |
| `sk-card__meta` | `time` | A collection entry's date |
| `sk-card__more` | `a` | A collection entry's "read more" link |
| `sk-icon` | `svg` | One of the kit's icons: 24 by 24, in the current text color, hidden from assistive technology |
| `sk-stat` | `li` | One figure, in `stats` and `split` |
| `sk-stat__value` | `p` | The figure, such as "500+" |
| `sk-stat__label` | `p` | What it counts |
| `sk-prose` | `div` | Rendered markdown: a rich-text body, an FAQ answer, a collection entry's body |

## Tones

A section type that offers a `tone` puts its modifier on the section's root, next to the variant's. The tone is the theme's to draw: colors for the background, the text, links and buttons.

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-tone-plain` | `section` | On the page background |
| `sk-tone-surface` | `section` | On the surface color, set apart from the page |
| `sk-tone-dark` | `section` | On a dark background, usually the text color, with light text |
| `sk-tone-accent` | `section` | On the accent color, for the page's main call to action |

## Sections

### hero

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-hero` | `section` | |
| `sk-hero--centered` | `section` | Text centered, image below it |
| `sk-hero--image-left` | `section` | Image on the left of the text |
| `sk-hero--image-right` | `section` | Image on the right of the text |
| `sk-hero--background` | `section` | Image behind the text |
| `sk-hero--page` | `section` | A page header: eyebrow, title and subtitle, then the image at full width below them |
| `sk-hero__content` | `div` | The text and the buttons, first in reading order |
| `sk-hero__badge` | `p` | A short highlight above the title |
| `sk-hero__title` | `h1` or `h2` | The title, `h1` in the page's first hero |
| `sk-hero__subtitle` | `p` | The subtitle |
| `sk-hero__note` | `p` | A short line under the buttons |
| `sk-hero__media` | `img` | The image |

### rich-text

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-rich-text` | `section` | |
| `sk-rich-text--narrow` | `section` | A reading-width column |
| `sk-rich-text--wide` | `section` | A wider column |
| `sk-rich-text--title-aside` | `section` | The title beside the body on wide screens, stacked on narrow ones |
| `sk-rich-text__body` | `div` | The body, with `sk-prose` |

### collection-list

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-collection-list` | `section` | |
| `sk-collection-list--cards` | `section` | Entries as cards |
| `sk-collection-list--list` | `section` | Entries as a list. A theme often leaves out the images |
| `sk-collection-list--featured` | `section` | The first entry featured, the rest as cards |
| `sk-collection-list__list` | `ul` | The entries, each an `sk-card` |

### services-grid

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-services-grid` | `section` | |
| `sk-services-grid--cards` | `section` | Items as cards |
| `sk-services-grid--list` | `section` | Items as rows, image beside the text |
| `sk-services-grid__list` | `ul` | The items, each an `sk-card` |

### gallery

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-gallery` | `section` | |
| `sk-gallery--grid` | `section` | Images in a grid, in order across |
| `sk-gallery--masonry` | `section` | Images in columns, in order down each column |
| `sk-gallery__list` | `ul` | The images |
| `sk-gallery__item` | `li` | One image with its caption, in a `figure` |
| `sk-gallery__image` | `img` | The image |
| `sk-gallery__caption` | `figcaption` | The caption |

### testimonials

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-testimonials` | `section` | |
| `sk-testimonials--grid` | `section` | Testimonials side by side |
| `sk-testimonials--single` | `section` | Each testimonial large, one after another |
| `sk-testimonials__list` | `ul` | The testimonials |
| `sk-testimonials__item` | `figure` | One testimonial |
| `sk-testimonials__quote` | `blockquote` | The quote |
| `sk-testimonials__author` | `figcaption` | The photo, name and role |
| `sk-testimonials__avatar` | `img` | The photo |
| `sk-testimonials__placeholder` | `span` | Empty, in the photo's place when the item has none. Hidden from assistive technology |
| `sk-testimonials__name` | `div` | The name |
| `sk-testimonials__role` | `div` | The role |

### faq

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-faq` | `section` | |
| `sk-faq__list` | `div` | The questions |
| `sk-faq__item` | `details` | One question and its answer |
| `sk-faq__question` | `summary` | The question |
| `sk-faq__answer` | `div` | The answer, with `sk-prose` |

### cta

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-cta` | `section` | The title and text are an `sk-section__header`, the buttons an `sk-buttons` |
| `sk-cta--banner` | `section` | A full-width band |
| `sk-cta--card` | `section` | A box within the page |

### hours-location

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-hours-location` | `section` | |
| `sk-hours-location__contact` | `div` | The section's phone number and email address |
| `sk-hours-location__contact-link` | `a` | A `tel:` or `mailto:` link, with a `phone` or `mail` icon before the text |
| `sk-hours-location__place` | `div` | The address and the map link |
| `sk-hours-location__address` | `address` | The address, its lines split by `br` |
| `sk-hours-location__map-link` | `a` | The link to a map |
| `sk-hours-location__hours` | `dl` | The opening hours |
| `sk-hours-location__row` | `div` | One row: days and time |
| `sk-hours-location__days` | `dt` | The days |
| `sk-hours-location__time` | `dd` | The time |
| `sk-hours-location__note` | `p` | The note |

### trust-bar

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-trust-bar` | `section` | |
| `sk-trust-bar--line` | `section` | The items in one row, usually between two rules |
| `sk-trust-bar--chips` | `section` | Each item as a pill |
| `sk-trust-bar__list` | `ul` | The items |
| `sk-trust-bar__item` | `li` | One item |

### stats

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-stats` | `section` | Its tone is `sk-tone-plain` or `sk-tone-dark` |
| `sk-stats__list` | `ul` | Two to four `sk-stat` figures |

### steps

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-steps` | `section` | |
| `sk-steps__list` | `ol` | The steps. Draw two-digit numbers with a CSS counter in `decimal-leading-zero` |
| `sk-steps__item` | `li` | One step |
| `sk-steps__title` | `h3` | Its title |
| `sk-steps__text` | `p` | Its text |

### split

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-split` | `section` | Its tone is `sk-tone-plain` or `sk-tone-surface` |
| `sk-split--image-left` | `section` | The image on the left of the text |
| `sk-split--image-right` | `section` | The image on the right of the text. It still comes first in reading order |
| `sk-split__media` | `img` | The image |
| `sk-split__content` | `div` | The heading group, the body, the figures and the link |
| `sk-split__body` | `div` | The body, with `sk-prose` |
| `sk-split__stats` | `ul` | Up to four `sk-stat` figures |
| `sk-split__link` | `a` | A link after the text, such as "Meet the team" |

### team

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-team` | `section` | |
| `sk-team__list` | `ul` | The people |
| `sk-team__member` | `li` | One person |
| `sk-team__photo` | `img` | The photo |
| `sk-team__placeholder` | `span` | Empty, in the photo's place when the person has none. Hidden from assistive technology |
| `sk-team__name` | `p` | The name |
| `sk-team__role` | `p` | The role |

### pricing-list

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-pricing-list` | `section` | |
| `sk-pricing-list__list` | `dl` | The prices |
| `sk-pricing-list__row` | `div` | One label and its price |
| `sk-pricing-list__label` | `dt` | What is priced |
| `sk-pricing-list__price` | `dd` | The price, as the site wrote it |
| `sk-pricing-list__note` | `p` | The note |

### tabs

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-tabs` | `section` | |
| `sk-tabs--horizontal` | `section` | The tabs in a row above the panels |
| `sk-tabs--vertical` | `section` | The tabs in a column beside the panels. The up and down arrow keys move between them |
| `sk-tabs__list` | `div` | The tab list, `role="tablist"`. `hidden` until the section's script runs |
| `sk-tabs__tab` | `button` | One tab, `role="tab"`, holding its label |
| `sk-tabs__panels` | `div` | The panels |
| `sk-tabs__panel` | `div` | One panel. The script hides every panel but the selected one with `hidden` |
| `sk-tabs__label` | `h3` | The panel's label, which shows without scripts. Hide it under `.sk-tabs[data-ready]`, where its tab shows it |
| `sk-tabs__title` | `p` | The panel's title |
| `sk-tabs__body` | `div` | The panel's body, with `sk-prose` |
| `sk-tabs__link` | `a` | A link after the body |
| `sk-tabs__media` | `img` | The panel's image, after its text |

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-tabs` | The script has run: the tab list shows, and one panel at a time |
| `aria-selected` | `sk-tabs__tab` | `true` on the selected tab, `false` on the others |

### slider

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-slider` | `section` | |
| `sk-slider--full` | `section` | One slide at a time |
| `sk-slider--cards` | `section` | Several slides in a row |
| `sk-slider__list` | `ul` | The slides. Without scripts it's all there is, so lay it out as a row that scrolls sideways, with scroll snapping. The buttons scroll it too |
| `sk-slider__slide` | `li` | One slide, a group named like "Slide 2 of 4" |
| `sk-slider__media` | `img` | A slide's image |
| `sk-slider__title` | `h3` | A slide's title |
| `sk-slider__body` | `div` | A slide's body, with `sk-prose` |
| `sk-slider__link` | `a` | A slide's link |
| `sk-slider__controls` | `div` | The buttons and the status. `hidden` until the script runs |
| `sk-slider__pause` | `button` | Pauses and restarts the rotation, only with `autoplay`. Holds a `pause` and a `play` icon: show one by `[data-playing]` on the slider |
| `sk-slider__previous` | `button` | Shows the previous slide. Holds a `chevron-left` icon |
| `sk-slider__next` | `button` | Shows the next slide. Holds a `chevron-right` icon |
| `sk-slider__status` | `p` | The current slide, such as "Slide 2 of 4", announced as it changes |

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-slider` | The script has run: the controls show |
| `data-playing` | `sk-slider` | The slider rotates by itself |

### embed

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-embed` | `section` | An embed section. A video link alone in a Markdown paragraph renders the parts below without it |
| `sk-embed__media` | `figure` | The embed: its frame and its caption |
| `sk-embed__frame` | `div` | The box that holds the placeholder, then the frame. Its modifier gives its aspect ratio |
| `sk-embed__frame--16-9` | `div` | 16 by 9, the default |
| `sk-embed__frame--4-3` | `div` | 4 by 3 |
| `sk-embed__frame--1-1` | `div` | Square |
| `sk-embed__frame--21-9` | `div` | 21 by 9 |
| `sk-embed__placeholder` | `div` | What shows until the frame loads: the notice, the button and the link |
| `sk-embed__notice` | `p` | "Loads content from" the provider's host |
| `sk-embed__button` | `button` | Loads the frame and moves focus to it. `hidden` until the script runs |
| `sk-embed__link` | `a` | Opens the content on the provider's site |
| `sk-embed__iframe` | `iframe` | The frame, once the button is pressed, or at once with `load: direct` |
| `sk-embed__caption` | `figcaption` | The caption, or a video link's text |

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-embed__media` | The script has run: the button shows |

## Parts

Behaviors that sit on the layout or on a section type, each with its own hooks and states. A theme's `README.md` lists the types and parts it supports, and a theme that doesn't list a part leaves its hooks unstyled: `npm run check:styles -- --built` then warns about them on any page that renders the part.

### highlight

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-highlight` | `span` | Words a title marks with `==`, such as "Work ==together==". Adds no meaning for assistive technology |

### nested-nav

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-nav__item` | `li` | A nav item with children, as in Webflow's Dropdown |
| `sk-nav__toggle` | `button` | Shows and hides the item's children. It holds the label and a `chevron-down` icon, or, beside the item's own `sk-nav__link`, the icon alone, named by `ui.navSubmenu`, and is then `hidden` until the layout's script runs |
| `sk-nav__submenu` | `ul` | The children, one level deep. In the menu panel on narrow screens, a nested list |
| `sk-nav__sublink` | `a` | A child link |

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-nav__item` | The layout's script has run. Collapse the children only while the item is `[data-ready]:not([data-open])`, so they stay usable without scripts |
| `data-open` | `sk-nav__item` | The children show |
| `aria-expanded` | `sk-nav__toggle` | `true` while the children show |
| `data-current` | `sk-nav__toggle` | One of the children links to the current page |
| `aria-current` | `sk-nav__sublink` | `page` on the link to the current page |

### lightbox

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-gallery__link` | `a` | With `lightbox`, the link around each gallery image, to its file |
| `sk-lightbox` | `dialog` | The gallery's dialog, opened as a modal |
| `sk-lightbox__figure` | `figure` | The image and its caption |
| `sk-lightbox__image` | `img` | The image, large |
| `sk-lightbox__caption` | `figcaption` | Its caption, `hidden` when it has none |
| `sk-lightbox__previous` | `button` | The previous image, with a `chevron-left` icon |
| `sk-lightbox__next` | `button` | The next image, with a `chevron-right` icon |
| `sk-lightbox__close` | `button` | Closes the dialog, with an `x` icon |

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-gallery` | The script has run: an image opens the dialog |
| `data-open` | `sk-lightbox` | The dialog is open. It leaves a moment after the dialog closes, so a rule that sets `display` selects `.sk-lightbox[data-open][open]` |

### video

| Hook | Element | Marks |
| --- | --- | --- |
| `sk-video` | `div` | A `hero`'s background video, or a `split`'s, in the image's place |
| `sk-video__media` | `video` | The video, muted and looping, with the image as its poster |
| `sk-video__button` | `button` | Pauses and plays it. `hidden` until the script runs. Holds a `pause` and a `play` icon: show one by `[data-playing]` |

| State | Element | Means |
| --- | --- | --- |
| `data-ready` | `sk-video` | The script has run: the button shows |
| `data-playing` | `sk-video` | The video plays |

### reveal

| State | Element | Means |
| --- | --- | --- |
| `data-reveal` | a section's root, or any element of the site's own markup | Its entrance animation: `fade`, `fade-up`, `fade-down`, `slide-left`, `slide-right` or `scale`. Hide it only under `[data-sk-ready]`, and only inside `prefers-reduced-motion: no-preference` |
| `data-revealed` | the same element | It has entered the viewport: animate it to its place |
| `data-sk-ready` | `html` | The reveal script has run, before the page renders. Without scripts it's missing, so nothing is hidden |

## Deprecated

Hooks that still render, and the hooks to use instead. A later major release removes them. Style the replacement, never both: once the old class is gone, a selector that names it matches nothing.

| Hook | Use instead | Deprecated in | Note |
| --- | --- | --- | --- |
