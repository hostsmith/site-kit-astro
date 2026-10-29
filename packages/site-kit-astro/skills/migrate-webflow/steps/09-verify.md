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

Compare each page of the build with the same page of the export, as screenshots at Webflow's widths, 479, 767, 991 and 1440 px. The comparison is with the export, never the live site. The script `node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/fidelity.mjs` serves both on `localhost`, renders the export with its scripts off, and answers any other host with nothing. It takes the screenshots under reduced motion, unless the site has `reducedMotion: "ignore"`: the build then plays its motion, as its visitors see it, and each element is shot where its motion ends. Webflow writes the start of an animation on page load or on scroll into view into the page, which hides or moves the element until its script plays it: the script serves the export's pages without those start states, so each such element shows where its animation ends. Never edit or copy the export for the check.

1. **Install Playwright and axe-core for the checks,** in a folder of its own inside the ignored snapshot, never in the site's `package.json`:

   ```bash
   npm install --prefix .hostsmith/snapshot/fidelity/tools playwright@1.64.0 @axe-core/playwright@4.14.0
   ```

   The script uses Playwright's Chromium, or Google Chrome where that isn't installed. If neither is on the machine, tell the person that Playwright will download Chromium, about 150 MB, outside the site, and wait for their go-ahead before you run:

   ```bash
   .hostsmith/snapshot/fidelity/tools/node_modules/.bin/playwright install chromium
   ```

2. **List the pages** in `.hostsmith/snapshot/fidelity/pages.txt`, one per line: the export's file, then the build's path. Step 5 wrote it for its sample: complete it. Every static page, the 404 page, and each template with one of its entries:

   ```
   index.html /
   about.html /about
   404.html /404
   detail_blog.html /blog/from-woolen-mill-to-workspace
   ```

3. **Check the content first,** with a script that compares each export page with its build page as HTML, so the review is left only the look:

   ```bash
   npm run build
   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/content.mjs \
     --export .hostsmith/snapshot/code \
     --build dist \
     --pages .hostsmith/snapshot/fidelity/pages.txt \
     --out .hostsmith/snapshot/fidelity/content.json
   ```

   It lists, by page, each text of the export the build doesn't have, each longer one it has in another order, each link it doesn't have and each image's alt text it doesn't have. It leaves out what the export can't show or the migration doesn't carry, such as a collection list, a form, custom code and hidden content. Fix each gap in the content, build and run it again, until only the gaps that stay are left, such as a page written anew, a form the kit doesn't carry yet, or a fault of the kit, which you name to the person. The report says why each one stays.

4. **Build, then run the fidelity check** on every page:

   ```bash
   npm run build
   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/fidelity.mjs \
     --tools .hostsmith/snapshot/fidelity/tools \
     --export .hostsmith/snapshot/code \
     --build dist \
     --pages .hostsmith/snapshot/fidelity/pages.txt \
     --out .hostsmith/snapshot/fidelity/shots \
     --fonts src/styles/theme/fonts.css --font-files public/assets/fonts \
     --reduced-motion ignore
   ```

   Leave out `--fonts` and `--font-files` while the site has no font files of its own. With them, the export's pages get the site's fonts, so a font the export lacks isn't a difference. Pass `--reduced-motion ignore` only when `src/site.config.ts` has `reducedMotion: "ignore"`, as step 4 set it.

   Read all of its output, a few lines: what went wrong first, such as the pages that answered 404, then what it shot, what it kept from the last run, the largest measured differences and their average, and how many pictures to open. The script measures each page and width as the share of the page that differs, to order the review and to show the rounds converging. The number decides nothing.

   **In a sandbox,** the script may fail to serve on `localhost`, such as with `EPERM` on `listen`, or its browser may fail to start. Never work around a sandbox. Say what it must allow: in Claude Code, `sandbox.network.allowLocalBinding: true` lets it serve on `localhost`. If the browser still can't start, as Google Chrome can't inside Claude Code's sandbox on macOS, say that the person can run the command above outside the sandbox, or skip the check. Record the check as not run, and why, in the report's "Fidelity check", and go on to the person's comparison.

5. **Review every picture on the checklist first,** `.hostsmith/snapshot/fidelity/shots/review.md`, which the script writes, and fix nothing until you have. Each picture holds both sides, the export on the left and the build on the right, each labelled. Open them in the checklist's order, worst first, three or four in one turn, never one at a time, and tick each one in the file once you've looked at it. A small measured share can still hide a missing button, so open every one. Don't skip a width because another looked fine: most layout changes show only at the narrow widths. Don't open the full-page screenshots, `<width>-export.png` and `<width>-build.png`: a picture that tall reaches you too shrunk to see a button. The checklist holds:
   1. **Every page's overview at every width,** `<width>-overview.png`, worst first: the order of the sections, a section missing or added, and the columns at that width.
   2. **The header and the footer at every width,** on the home page: its first slice, `<width>-slice-01.png`, and its end, `<width>-end.png`. Every page shares them, and they change the most between widths: a button beside the menu button, a menu that collapses, columns that stack.
   3. **The slices where an overview shows a difference,** `<width>-slice-<n>.png`, a screen each at full size, to see it in detail. Add each one you open to the checklist. Both sides are cut at the same offset, so below a section of another height they drift apart: find the same content in the next slice.

   Write each difference you see into the checklist's table, "Differences found", as you go: its page, its width or `all`, what differs, and the cause where you see it.

   Look at the layout, the order, the spacing, the type, the colors, the images and what shows at each width. `fidelity.json` lists a page that answered 404 on either side, which usually means a wrong line in `pages.txt`.
   - **CMS areas:** a collection list, and a template's bound fields, are empty in the export. Check those areas against the collection's entries instead of the picture.
   - **Fonts:** while the site uses a fallback, its type differs from the export's in every picture. Note it once.

   **With subagents,** such as Claude Code's, hand the review to them, so the pictures stay out of your own context and fresh eyes judge them: start new ones, never one that ported the pages. Give each a group of pages, about 16 pictures, and one the header and the footer. Tell each the checklist's path, the pictures it reviews, what to look for, as above, and to open three or four at a time, to open the slices where an overview shows a difference, and to change no file. Each returns the pictures it opened, and its differences as rows of the table. Then tick its pictures, add its slices to the checklist, and put its rows into the table.

6. **Then sort each difference, and fix it where it belongs,** all at once:

   | The difference | Where it's fixed |
   | --- | --- |
   | CSS can reach it: a color, a band, a border, spacing, a size, type, capitals, a decoration, the arrangement of the elements the type renders, a breakpoint | the theme, always. Never left |
   | One section should look different from its type's others | a site variant, as the kit's `AGENTS.md`, "Site variants", says |
   | The library type doesn't render an element the section needs | a site-local type, as step 5 says |
   | A kit part lacks an element of the old one | kept, as "Kit parts first" says. Left, and listed |
   | A deliberate choice, such as a map or a video that loads on a click | left, and listed |
   | Content the export lacks, such as logos loaded from another site | left, and listed |

   Fixing means matching the export, as the old design was: look up the old rules with `css-rules.mjs` and the classes the page's outline shows, never the stylesheet whole. In the checklist's last column, write the row that applies and the fix, such as "theme: the names in capitals" or "a deliberate choice".

   **On a large site with subagents,** sort the rows yourself, from the table, and hand the fixes to them, as the skill's "With subagents" says: the rows the theme fixes to one, and the rows of each type or page to another, side by side where they touch different files. Give each its rows, the export's files and the build's for its pages, and this table. Each fixes its rows, builds, and returns how it fixed each one, for the table's last column, and the rows it couldn't fix, with why.

7. **Then review again, in rounds, until it converges.** Build, run the content check, then the fidelity check again:
   - **On every page,** without `--only`: a fix in the theme or a shared type can change a page it wasn't made for. `--only` is for step 5's sample.
   - **The export's screenshots are kept,** so a rerun shoots only the build. `--fresh` shoots the export again too, which only a change to the snapshot needs.
   - **The rerun unticks every picture whose screenshots changed,** and keeps the rest of the checklist. Review the unticked pictures as in item 5, in new subagents where you have them, say in the table how each difference was fixed, and fix what the round finds as in item 6.
   - **Stop** when a round finds only differences that may stay, by the table in item 6, or the same ones as the round before, and after five rounds at most. The average the script prints should fall from round to round.
   - **Stop sooner** when a rerun's average fell by less than 0.5 points against the run before, as the script then says: open none of the pictures it unticked, and list them under the report's "Not compared", unreviewed because the rounds had converged. When the average rose, the last fixes made pages differ more: review the unticked pictures for what they broke, fix that, and run again.

8. **Record it** in the report's "Fidelity check":
   - **the differences left:** each row of the checklist's table that isn't fixed, as a row of the report's table, never as a list, with the row of the table above that lets it stay in the last column: a kit part lacks it, a deliberate choice, or content the export lacks. A difference CSS can reach is never left. "No differences." when none is left;
   - **what you compared,** from the checklist: the ticked pictures under "Compared", and every one left unticked under "Not compared", with the reason. Never write that a page or width was compared when you didn't open its picture;
   - **the rounds:** how many ran, and the script's average after each, such as "3 rounds: 14.2%, 6.1%, 5.8%";
   - **the content check's gaps left,** each with why it stays.

## Accessibility

The migration carries the old design as it was, so it fixes none of its accessibility gaps and asks nothing about them: the report notes each one, with enough for a follow-up to fix it if the owner wants. After the fidelity check's fixes, build and run axe-core on the same pages:

```bash
npm run build
node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/accessibility.mjs \
  --tools .hostsmith/snapshot/fidelity/tools \
  --build dist \
  --pages .hostsmith/snapshot/fidelity/pages.txt \
  --out .hostsmith/snapshot/fidelity/accessibility.json \
  --reduced-motion ignore
```

Pass `--reduced-motion ignore` as for the fidelity check. Its output lists each text and background pair below WCAG 1.4.3's contrast minimum, with its ratio, its pages and the nearest shade of the text's color that meets it, then each other violation axe-core rates serious or critical, with its pages. Write a note in the report's "Accessibility" for each one the old design brings: for a pair, the colors as the theme names them, such as `--color-muted` on `--color-bg`, its ratio, its pages, WCAG 1.4.3 (AA), and the shade as the value to change. One that the kit's own markup causes, such as a part's missing name, isn't the old design's: say so to the person, as a fault of the kit. With `reducedMotion: "ignore"`, add the motion note, as the report template says.

## The person's comparison

Last, ask the person to compare each page of the build (`npm run preview`) with the old site, in a browser, side by side, and to tell you what differs. Record that they did, and what they found, in the report's "Fidelity check".
