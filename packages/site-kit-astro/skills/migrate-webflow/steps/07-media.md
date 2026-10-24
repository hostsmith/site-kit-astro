---
scope: any
---

# 7. Media

Copy every image, icon and video the content refers to into the site, under the names steps 4 to 6 gave them, so no page loads media from Webflow.

## Which files

- **From the code export:** the files in `.hostsmith/snapshot/code/images/` that the pages and settings use, copied to `public/assets/images/`. Take the originals only, never Webflow's resized copies, whose names end in `-p-500`, `-p-800`, `-p-1080`, `-p-1600` or `-p-2000` before the extension.
- **From the CMS:** each URL in `.hostsmith/snapshot/work/cms-images.txt`, from step 6, downloaded to its local name. These are the owner's own files, which the CSV export links to:

  ```bash
  curl -fsSL "<url>" -o public/assets/images/<name>
  ```

- **Videos:** a background video's MP4, and its WebM if there is one, to `public/assets/video/`. Keep a background clip short and small: a large one goes in the report, for the owner.
- **Names:** lowercase, with hyphens, after what the image shows, and stable: once a page is published, an image's name never changes. A changed image gets a new name, as the kit's rules say.

Then check that every `/assets/` path in `src/content/` has its file, and that no file in `public/assets/images/` is left that nothing uses, apart from the example's, which step 11 removes.

## Sizes

The build serves images as their files are: it never resizes or converts them. Resize each image that's larger than the page shows it: no wider than twice its widest display width, and no more than 2400 px, as a JPEG or WebP at about 80% quality. Use a tool already on the machine, such as `sips` on macOS or ImageMagick's `magick`, and ask the person when there's none. Never add an image package to the site. Keep a PNG for an image with transparency or flat colors, such as a logo.

## SVGs

Check every SVG before you copy it. Remove nothing silently: an SVG that has a `script` element, an event attribute such as `onload`, a `foreignObject`, or a link to anything other than an element in the same file, goes in the report, and isn't copied until the person decides.

- **An icon drawn in a fixed color,** such as `stroke="#2e5a45"`, becomes a site icon: `src/icons/<name>.svg`, with every color replaced by `currentColor`, apart from `none`, so it follows the theme. Its name is lowercase letters, digits and hyphens, and no kit icon's name, such as `check` or `star`. It keeps its `viewBox`, and loses any `style` element or attribute, `class` and `id` it doesn't need. Content uses it by name, as `icon: <name>`. Run `npm run decap-config`, so the CMS offers it.
- **A logo** keeps its colors, in `public/assets/images/`.

## The head's icons

Copy the favicon to `public/favicon.ico` and the touch icon to `public/apple-touch-icon.png`, as step 4 says.

## Credits

Every third-party file the site now holds gets a row in `CREDITS.md`, with its source and license, as the kit's rules on third-party files say: an icon set, a stock photo, a font. Ask the person where the photos came from, unless they're the owner's own. A file whose license you can't establish is listed as awaiting the owner's confirmation, and the report says so. Remove the example's rows, if any, in step 11.
