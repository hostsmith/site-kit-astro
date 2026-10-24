# DevLink experiment

An optional step, for a site whose Webflow Components the person exports with DevLink, Webflow's tool that writes Components as typed React code. It tests whether that export gives better site-local types than finding Components by repetition (step 5). Run it only when the person asks for it, or when the site has many Components and the person agrees.

## The export

The person exports the Components with DevLink, as Webflow's DevLink documentation describes, into a folder outside the site, and gives you the folder. Copy it into `.hostsmith/snapshot/devlink/`, which git ignores. Use no Webflow API or token yourself.

The export holds Webflow's own runtime and styles, such as its `_Builtin` components, its interactions and its CSS modules. These stay in the snapshot, as `webflow.js` does: read the Components' structure and props, and copy no Webflow code into the site.

## Two ways to use it

Try the first. Try the second only when the person asks.

1. **Convert each Component to a site-local type in `.astro`:** its element tree as the component's markup, its props as the type's props, with the same names where they fit the content, and its styles rewritten on the theme's tokens, as step 3 says. Nothing new is installed.
2. **Render the React components at build time,** with `@astrojs/react`, `react` and `react-dom`, which the kit's rules allow for this experiment only, each pinned to an exact version. Render them statically: never with a `client:` directive, so no React reaches the visitor's browser. Each one still needs a site-local type, with its schema and Decap type, whose component renders the React component with the section's props. If the result doesn't meet the kit's rules, such as its styles, its hardcoded text or its scripts, remove the three packages again.

## What to record

In the report, under "Site-local types and Components", add a "DevLink" part:

- which Components were exported, and which way each was used;
- whether the props' names carried over, and which you renamed;
- whether the result met the kit's rules: the theme's tokens only, no hardcoded text, no Webflow class names, no scripts;
- how long it took, compared with finding the Components by repetition;
- whether you'd use DevLink for the next site.
