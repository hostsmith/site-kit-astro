---
scope: kit
---

# 4. Settings

Move what every page shares into the site's config and settings: the locales, the header, the footer, the facts and the head. The kit's README, "Header and footer", lists every block type and its props.

## Site config

In `src/site.config.ts`:

- **`url`:** the site's production URL, the domain the old site is served on, such as `https://www.acme.com`, which the site keeps once the domain moves. Never the `webflow.io` address. If the old site has no domain of its own yet, ask the person.
- **`locales`:** the primary locale, with its `code`, such as `en`, and its `tag`. The tag is the code export's `<html lang>`, with the region that the site's spelling, dates and phone numbers show, such as `en-US` for US spelling, or `en-GB` for British. Ask when you can't tell.
- **A localized site's other locales:** from the sitemap's alternates, each with its tag, its `hreflang`, and its `path`, the folder its URLs start with, such as `/de`. Confirm the list with the person before you write it.
- **`breadcrumb`:** the kit's layout shows a breadcrumb on every page whose path has more than one segment, such as a page in a Webflow folder, `/services/painting`. Webflow has no breadcrumb element, so set `breadcrumb: false` unless one of those pages has a trail of links home its designer built. Step 6 sets each collection's own switch. Record it in the report's "Collections".

Run `npx site-kit schema` after a change to the locales.

## The primary locale's settings

Write `src/content/settings/site.<code>.yml` from the export's navbar and footer, which every page shares. Rename the example's file if its code differs.

- **`name`:** the business's name, as the navbar's logo or the footer gives it.
- **`logo`:** the navbar's logo, as step 7 names it, with its alt text.
- **`nav`:** the navbar's links, in order. A Webflow Dropdown (`w-dropdown`) becomes an item with `children`, one level deep, with the dropdown toggle's text as the item's `label`.
- **`header.actions`:** the navbar's buttons, as `button` actions with `style: primary` or `secondary`, and a phone link as a `phone` action.
- **`footer.blocks` and `footer.bottom`:** the footer's columns, as blocks:
  - the logo and its line of text as `brand`, with its own `logo` and `logoAlt` when the footer shows another version, such as a reversed logo on a dark footer;
  - a column of links as `links`, with its heading as `title`;
  - the address, phone and email as `contact`, and opening hours as `hours`;
  - a paragraph as `text`, and the copyright line as `copyright`;
  - a newsletter form goes to the report's "Forms", for the kit's contact form in a later release.
- **`facts`:** each fact the site shows in more than one place, such as its phone number, email or address, written once here. Every text that shows it, in the settings and in the content, writes `{name}`, such as `{phone}`.
- **`seo.description`:** the home page's meta description, the default for pages without their own.
- **`seo.ogImage`:** the Open Graph image the pages share, if they share one. When no page has one, ask the person whether to add a default.
- **`ui`:** the kit's interface strings. Keep the example's keys, in the site's language and voice: the parts the site uses need theirs, and the build names any that are missing.

## The head

- **Titles:** each page's `<title>` becomes its page entry's `title` in step 5, and its meta description its `description`.
- **Templates:** a collection template's title, such as `| Acme Blog` in `detail_blog.html`, shows its SEO title pattern with its fields left out, and its meta description and Open Graph tags do the same. The export doesn't say which fields, so ask for each template's SEO title and description patterns, and its Open Graph ones when they differ, unless they were given in advance. Record each in the report's "Answers". Step 6 writes them as interface strings, once the collection's fields exist.
- **The favicon and touch icon:** the favicon becomes `public/favicon.ico`, and the touch icon, the "webclip" in the `apple-touch-icon` link, becomes `public/apple-touch-icon.png`, where browsers ask for them. But a site that never set its own exports Webflow's defaults, `images/favicon.ico` and `images/webclip.png`, which show Webflow's logo: as of 2026-10, their SHA-1 hashes are `743a2c39f538650d53664d19ab5079cfc9ba55d2` and `8f20cc5b884b7c2642558d11d7cf79e416ea4a7f` (`shasum`), and a look at the image confirms it. Never carry a default. Ask the person for the owner's icons, and until they arrive list them in the report's "Missing pieces".

## Other locales

In a localized site, copy the primary locale's settings to `site.<code>.yml` for each other locale, untranslated, and list each copy in the report's "To translate". Set `ui.locales`, such as "Language", in each, and add a `locales` header action or footer block, as the kit's README, "Adding a language", says.

## Then

Run `npm run decap-config` and `npm run build`. The build names any setting the kit doesn't know, and any fact or interface string that's missing.
