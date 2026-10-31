---
scope: any
---

# 6. CMS to collections

Turn each Webflow CMS collection into a collection of the site, one Markdown file per item and locale, from its CSV export in `.hostsmith/snapshot/cms/`.

Read the CSVs with the skill's reader, `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/csv.mjs`. Run on a CSV, it prints its rows and columns, with how many rows have a value in each, and with `--columns Slug,Author`, those columns of every row, long values cut short. A script of your own in `.hostsmith/snapshot/work/`, such as one that writes the entries, imports its `readCsv` by the file's path from the script's folder: it gives the columns and the rows by column name, and reads the quoted fields that hold commas, quotes and line breaks, as rich text fields do.

## Each collection

- **Name:** short and lowercase, from the Webflow collection's name, such as `posts` for Blog Posts or `team` for Team. It names the folder, `src/content/<name>/`, and the collection in the CMS. The URL comes from the base path.
- **Base path:** the one the person confirmed in step 2, under `collections` in `src/site.config.ts`.
- **Schema:** in `siteCollections` in `src/site.schema.ts`, by its schema alone, as `z.strictObject({ ... })`, since the kit loads the collection.
- **Decap:** a folder collection in `public/admin/config.site.yml`, with a field for each schema field, as the example's `news` has.
- **Detail template:** `src/components/collections/<name>.astro`, ported from `detail_<collection>.html` as step 5 ports a page, in site markup styled by the theme, with each field bound by `fieldsFor("<name>", entry.id)` from `@hostsmith/site-kit-astro/field`. Start from the example's `src/components/collections/news.astro`. A Component the template shares with pages, such as a call to action band, keeps that type's markup and classes, with its text from interface strings (below).

- **Breadcrumb:** Webflow has no breadcrumb element, so a template has one only if its designer built it: a trail of links home, often with a `breadcrumb` class or `aria-label="Breadcrumb"`. The kit's layout shows its own breadcrumb on every entry's page, so set `breadcrumb: false` on the collection in `src/site.config.ts` when its template has none, which is the usual case for a blog whose template has only a "Back" link. When it has one, leave the switch out, and port the template without its trail, since the kit's replaces it. Record the switch in the report's "Collections".

The example's `news` collection stays until step 11. Run `npm run decap-config` and `npx site-kit schema` after adding each collection.

## Fields

The columns Webflow adds to every CSV:

| Column | Becomes |
| --- | --- |
| `Name` | `title` |
| `Slug` | the file's name: `src/content/<name>/<Slug>.<code>.md` |
| `Draft` | `draft: true` when it's `true`, and nothing otherwise |
| `Archived` | an item with `true` gets no file, and goes into the report's "Not carried over" |
| `Item ID` | nothing, except to pair a localized site's rows across locales |
| `Collection ID`, `Locale ID`, `Created On`, `Updated On`, `Published On` | nothing. A site in one language ignores `Locale ID` |

Every other column is a field the site defined. Name each after what it holds, and check it against the template page, `detail_<collection>.html`, which shows where each field appears: its bound elements are the empty ones, marked `w-dyn-bind-empty`. Where it fits, give a field the name `collection-list` reads, so list cards show it: `date`, `description`, `image` with `imageAlt`, and `category`.

| Webflow field | In the CSV | Schema | Decap widget |
| --- | --- | --- | --- |
| Plain text | the text | `z.string().min(1)` | `string`, or `text` for several lines |
| Rich text | HTML | the entry's Markdown body. A second rich text field is a `z.string()` of Markdown | `markdown` |
| Image | a file URL | `mediaPath`, with an alt text field and `requireAlt` | `image` |
| Multiple images | file URLs, separated by `; ` | a list of objects with `image` and `alt` | `list` |
| Video link | a video's URL | `link`, which the template shows as an embed | `string` |
| Link | a URL | `link` | `string` |
| Email, Phone | the text | `z.string()` | `string` |
| Number | a number | `z.number()` | `number` |
| Switch | `true` or `false` | `z.boolean()` | `boolean` |
| Option | the option's name | `z.enum([...])`, with every option | `select` |
| Date | a date in JavaScript's `Date.toString()` form, such as `Tue Aug 25 2026 09:00:00 GMT+0000 (Coordinated Universal Time)` | `isoDate`, written as the date it shows, quoted: `"2026-08-25"` | `datetime` |
| Reference | the referenced item's slug | `z.string()`, the slug | `relation` to that collection, with `value_field: "{{slug}}"` |
| Multi-reference | slugs, separated by `; ` | `z.array(z.string())` | `relation` with `multiple: true` |
| Color | a hex color | nothing: colors belong in the theme. List the field in the report | |
| File | a file URL | `mediaPath`, to a file under `/assets/files/` | `file` |

Leave an empty value out of the entry, never `''` or `null`. A field that's empty in some rows is optional in the schema.

A reference holds the referenced entry's slug. The template finds that entry with `getEntry("<collection>", \`${slug}.${locale}\`)` from `astro:content`, where `locale` is the template's `locale` prop. Check each slug against the referenced collection's CSV, and list any that doesn't match in the report's "Links to check". Ask which of the referenced item's fields the template shows, such as an author's name, unless the template page makes it plain.

## Rich text

Turn each rich text field's HTML into Markdown in the kit's portable dialect: CommonMark, with no raw HTML.

| HTML | Markdown |
| --- | --- |
| `h2` to `h6` | `##` to `######`. An `h1` becomes `##`: a body never has its own |
| `p`, `strong`, `em`, `a`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre` | the same, in Markdown |
| `br` | a line break: a backslash at the end of the line |
| a figure with an image and a caption | the image, `![alt](/assets/images/<name>)`, in its own paragraph, then its caption as an italic paragraph right after it, such as `_Laptops and coffee on a long table._` |
| a figure with a YouTube or Vimeo frame | a link alone in its paragraph, with the frame's `title` as its text and the video's page as its URL, such as `[A tour of the mill](https://www.youtube.com/watch?v=3URtTIdnXIk)` |
| a figure or embed with any other frame or code | nothing: list it in the report's "Not carried over", with its item |
| a link to a page or an item | its clean path, such as `/blog/hot-desk-or-private-office` |

A YouTube frame's `https://www.youtube.com/embed/<id>` is the video page `https://www.youtube.com/watch?v=<id>`, and a Vimeo frame's `https://player.vimeo.com/video/<id>` is `https://vimeo.com/<id>`. Drop Webflow's figure classes, such as `w-richtext-align-fullwidth`: the theme's prose styles decide how a figure shows. Drop every inline style.

The owner's contact details that step 4 made facts, such as the email and the phone number, become their placeholders wherever a body shows them, in its text and in a link's address: `hello@acme.com` linked to `mailto:hello@acme.com` becomes `[{email}](mailto:{email})`, and a `tel:` link `tel:{phone}`. So a change in the settings reaches the bodies too.

## Images in the CMS

Each image URL in a CSV, in an image field or in a rich text body, is a file on Webflow's CDN, which step 7 downloads. Write its local path into the entry now: `/assets/images/<name>`, from the file's name after the CDN's ids, lowercase, with the image's own extension, so `64f1a2b3c4d5e6f708192a3c_64f1a2b3c4d5e6f708192a3d_acme-laptops-coffee.jpeg` becomes `acme-laptops-coffee.jpg`. List each URL with its local name in `.hostsmith/snapshot/work/cms-images.txt`, one image per line, the URL, a space, then the name, for step 7 and the fidelity check.

An empty image field is allowed: the entry has no image there. List the entries without one in the report's "Missing pieces", such as "Team: 3 entries without a photo".

## Template text

The fixed text of a template page, such as "Related posts", "min read", "Written by" or a call to action band's text, becomes interface strings of its detail template, as the kit's rules say: declared in `siteUi`, with a field under `ui` in `public/admin/config.site.yml`, and its text in every locale's settings.

Ask the person for what the export doesn't hold, unless it was given in advance, and record each answer in the report's "Answers":

- which field a reference shows;
- each collection list's limit, sort order and filters (below).

## Title and description patterns

Write the template's patterns from step 4 as interface strings named after the collection (the kit's README, "Title and description patterns"): `<name>PageTitle` and `<name>PageDescription`, and `<name>OgTitle` and `<name>OgDescription` only when the Open Graph ones differ. Each is declared in `siteUi` with the fields it shows as its parameters, with a field under `ui` in `public/admin/config.site.yml`, and its text in every locale's settings. Webflow's `{Name}` is `{title}`, and each other field is its entry field's name. For `{Name} | Acme Blog` on Blog Posts:

```ts
postsPageTitle: uiString({ params: ["title"] }),   // siteUi in src/site.schema.ts
```

```yaml
postsPageTitle: "{title} | Acme Blog"   # ui in src/content/settings/site.<code>.yml
```

A description pattern that is one field alone, such as the summary, needs no key: map that field onto `description`. Record each pattern in the report's "Collections".

## Collection lists

A collection list on a page, `w-dyn-list`, exports empty: only its empty state, `w-dyn-empty`, shows. Map it to a `collection-list` section, or to a site-local type when its cards show an element the kit's cards don't render. A difference of look is the theme's, from step 3. For each, ask the person its limit, its sort order and its filters, unless the page makes them plain. `collection-list` shows the newest entries first, by `date`, up to its `limit`. Another order or a filter needs a site-local type, or goes into the report.

## The fill file

Webflow exports each template and each collection list empty, so step 9's fidelity check fills them from the CSVs as it shoots the export, to compare them with the build's entries. Write the map you made into `.hostsmith/snapshot/fidelity/fill.json`:

```json
{
  "templates": {
    "detail_blog.html": {
      "csv": "acme - Blog Posts - 64f1a2b3c4d5e6f708192a3b.csv",
      "fields": [
        "Name",
        "Summary",
        { "column": "Published On", "date": { "month": "long", "day": "numeric", "year": "numeric" } },
        { "column": "Author", "ref": { "csv": "acme - Team - 64f1a2b3c4d5e6f708192a3c.csv", "column": "Name" } },
        "Main Image",
        "Post Body"
      ]
    }
  },
  "lists": {
    "index.html": [
      {
        "csv": "acme - Blog Posts - 64f1a2b3c4d5e6f708192a3b.csv",
        "entries": ["hot-desk-or-private-office", "inside-our-calendar", "from-mill-to-workspace"],
        "fields": ["Main Image", { "column": "Published On", "date": { "month": "short", "day": "numeric" } }, "Name", "Summary"]
      }
    ]
  }
}
```

- **`templates`:** for each `detail_<collection>.html`, its CSV, by its name in `.hostsmith/snapshot/cms/`, and the columns that fill its empty elements, those marked `w-dyn-bind-empty` outside its lists, in their order in the page, as its outline shows them.
- **`lists`:** for each page with collection lists, a template too, its lists in their order in the page, each with its CSV, the entries the build shows in it, by their Slug and in the build's order, and the columns that fill its item's empty elements, in their order.
- **A field** is a column's name, as the CSV's header has it, or:
  - a date: `{ "column": ..., "date": ... }`, with the `Intl.DateTimeFormat` options that show it as the build does;
  - a reference: `{ "column": ..., "ref": { "csv": ..., "column": ... } }`, the column of the referenced entry that the element shows;
  - `null`, for an element the build leaves empty, such as one Webflow shows only when its field is set.
- **A list the build shows empty** has `"entries": []`, so the export shows its empty state too.

Images come from `cms-images.txt`, by their URLs. On a large site with subagents, the collections' subagent writes the file, and says so in its summary.

## Localized sites

Each locale's CSV gives that locale's entries. Pair its rows with the primary locale's by `Item ID`:

- a translation is `<the primary row's Slug>.<code>.md`, beside the primary entry;
- when its own `Slug` differs, that slug is its `localSlug`;
- an item missing from a locale's CSV, or a draft there, has no file in that locale.

## Then

Run `npm run build` and `npm run check:urls`. Each collection has one entry per published or draft item, and every item URL in `.hostsmith/old-urls.txt` has its page.
