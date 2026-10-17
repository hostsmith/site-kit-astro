// Styling hooks (site-kit-design-system design D30). The kit ships no CSS:
// every element a theme may style carries an `sk-` class, and HOOKS.md lists
// them all. Renaming or removing a hook is a major release.

// The root classes of a library section: `sk-section`, the type's block
// class, the variant's modifier and the tone's modifier, such as
// "sk-section sk-cta sk-cta--card sk-tone-dark".
export function sectionClass(section: { type: string; variant?: string; tone?: string }): string {
  const classes = ["sk-section", `sk-${section.type}`];
  if (section.variant) classes.push(`sk-${section.type}--${section.variant}`);
  if (section.tone) classes.push(`sk-tone-${section.tone}`);
  return classes.join(" ");
}

// Hides an element visually and keeps it for assistive technology. It is an
// inline style rather than a class, so no theme can undo it by accident: the
// kit's one-h1-per-page rule depends on it.
export const VISUALLY_HIDDEN =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
