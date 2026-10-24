# Site

This site is built with the [Hostsmith site kit](https://github.com/hostsmith/site-kit-astro), on [Astro](https://astro.build), from the kit's `webflow` example: the starting point for porting a Webflow design onto the kit. Its content is in `src/content/`, as Markdown and YAML.

```bash
npm ci
npm run dev     # local preview with live reload
npm run build   # writes the static site to dist/
```

The example shows every section type of the kit, with each variant and tone, and every part that replaces one of Webflow's built-in elements: tabs, sliders, embeds that load on a click, a gallery's lightbox, background video, dropdowns in the nav, entrance animations and highlighted words in titles. Its theme, in `src/styles/theme/`, is structural: grays and system fonts, Webflow's breakpoints and element defaults, and only the rules each part needs to work and stay accessible. A port puts the Webflow site's colors, fonts and spacing into its tokens and restyles the parts, as `src/styles/theme/README.md` describes. Its content names the part each section shows, and a port replaces it.

The kit isn't affiliated with Webflow. The example holds no Webflow code, class names or files from a Webflow export.

The kit's README explains how content works, what this repository holds, and how to take kit updates. Agents start with `AGENTS.md`.

The code from the kit's `webflow` example is under [MIT-0](https://github.com/hostsmith/site-kit-astro/blob/main/examples/LICENSE), so the site owes no notice for it. Its images and video were made for the example, so `CREDITS.md` lists no third-party files until the site adds some.
