---
scope: any
---

# 9. Verify

Check the migrated site against the kit's rules, against the export, and, through the person, against the old site. The style checks are the kit's, `scope: kit`. The rest works in any Astro site.

## The checks

```bash
npm run check:styles            # scope: kit
npm run build
npm run check:urls
npm run check:styles -- --built # scope: kit
```

`check:styles` and the build pass, `check:urls` finds a page for every path in `.hostsmith/old-urls.txt`, and `check:styles -- --built` warns about nothing: style every hook it names in the theme, and give every class it names a rule or replace it with a utility. Fix what fails and run them again.

## No Webflow left

The built pages load no Webflow script and nothing from a Webflow host:

```bash
grep -rnoE 'webflow\.js|website-files\.com|webflow\.com|webflow\.io|data-wf-[a-z-]*|jquery' dist
grep -rnoE '(class="|class="[^"]* )w-[a-z-]+' dist
```

Each match is a leftover to remove, unless it's the site's own text, such as a blog post that names Webflow. Tailwind's `w-` utilities, such as `w-full`, are the site's own too.

## Size

Compare the size of `dist/` (`du -sh dist`) with the upload and storage limits of the Hostsmith plan the site will be on, which the account's plan shows. Ask the person when you can't see them. If the site is close to a limit, the largest images and videos are the place to start.

## The fidelity check

Compare each page of the build with the same page of the export, as screenshots at Webflow's widths, 479, 767, 991 and 1440 px. The comparison is with the export, never the live site. The script `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/fidelity.mjs` serves both on `localhost`, takes the screenshots under reduced motion, renders the export with its scripts off, so Webflow's interactions show their end state, and answers any other host with nothing.

1. **Install Playwright for the check,** in a folder of its own inside the ignored snapshot, never in the site's `package.json`:

   ```bash
   npm install --prefix .hostsmith/snapshot/fidelity/tools playwright@1.64.0
   ```

   The script uses Playwright's Chromium, or Google Chrome where that isn't installed. If neither is on the machine, tell the person that Playwright will download Chromium, about 150 MB, outside the site, and wait for their go-ahead before you run:

   ```bash
   .hostsmith/snapshot/fidelity/tools/node_modules/.bin/playwright install chromium
   ```

2. **List the pages** in `.hostsmith/snapshot/fidelity/pages.txt`, one per line: the export's file, then the build's path. Every static page, the 404 page, and each template with one of its entries:

   ```
   index.html /
   about.html /about
   404.html /404
   detail_blog.html /blog/from-woolen-mill-to-workspace
   ```

3. **Build, then run it:**

   ```bash
   npm run build
   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/fidelity.mjs \
     --tools .hostsmith/snapshot/fidelity/tools \
     --export .hostsmith/snapshot/code \
     --build dist \
     --pages .hostsmith/snapshot/fidelity/pages.txt \
     --out .hostsmith/snapshot/fidelity/shots \
     --fonts src/styles/theme/fonts.css --font-files public/assets/fonts
   ```

   Leave out `--fonts` and `--font-files` while the site has no font files of its own. With them, the export's pages get the site's fonts, so a font the export lacks isn't a difference.

   **In a sandbox,** the script may fail to serve on `localhost`, such as with `EPERM` on `listen`, or its browser may fail to start. Never work around a sandbox. Say what it must allow: in Claude Code, `sandbox.network.allowLocalBinding: true` lets it serve on `localhost`. If the browser still can't start, as Google Chrome can't inside Claude Code's sandbox on macOS, say that the person can run the command above outside the sandbox, or skip the check. Record the check as not run, and why, in the report's "Fidelity check", and go on to the person's comparison.

4. **Review the pictures** in `.hostsmith/snapshot/fidelity/shots/<page>/`. Each holds both sides, the export on the left and the build on the right, each labelled. Don't open the full-page screenshots, `<width>-export.png` and `<width>-build.png`: a picture that tall reaches you too shrunk to see a button. In this order:
   1. **Every page's overview at every width,** `<width>-overview.png`: the order of the sections, a section missing or added, and the columns at that width.
   2. **The header and the footer at every width,** on the home page: its first slice, `<width>-slice-01.png`, and its end, `<width>-end.png`. Every page shares them, and they change the most between widths: a button beside the menu button, a menu that collapses, columns that stack.
   3. **The slices where an overview shows a difference,** `<width>-slice-<n>.png`, a screen each at full size, to see it in detail. Both sides are cut at the same offset, so below a section of another height they drift apart: find the same content in the next slice.

   Look at the layout, the order, the spacing, the type, the colors, the images and what shows at each width. `fidelity.json` lists a page that answered 404 on either side, which usually means a wrong line in `pages.txt`.
   - **CMS areas:** a collection list, and a template's bound fields, are empty in the export. Check those areas against the collection's entries instead of the picture.
   - **Fonts:** while the site uses a fallback, its type differs from the export's in every picture. Note it once.
   - **Fix what you can:** a difference in spacing, size, color or order usually has its cause in the theme or the section's markup. Fix it, build, and run the script again.
   - **The rest goes in the report's "Fidelity check",** with its page and width.
   - **Record what you compared** in the report's "Fidelity check": the overviews, the header and footer pictures, and the slices you opened, by page and width, and every page and width you didn't look at. Never write that a page or width was compared when you didn't open its picture.

## The person's comparison

Last, ask the person to compare each page of the build (`npm run preview`) with the old site, in a browser, side by side, and to tell you what differs. Record that they did, and what they found, in the report's "Fidelity check".
