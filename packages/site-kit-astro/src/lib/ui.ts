// Interface strings for site code (site-kit-locales design D46). A label that
// a collection template, a page template or a site section shows on every
// page lives in the settings' `ui`, declared in `siteUi` in
// src/site.schema.ts, so the owner can change it in the CMS:
//
//   const ui = await getUi(locale);
//   <h2 {...ui.field("keepReading")}>{ui.text("keepReading")}</h2>
//   <span {...ui.field("minRead")}>{ui.text("minRead", { minutes })}</span>
//
// text() fills the string's parameters and picks its plural form by the
// settings' language. Facts in the string were filled at build time.
/// <reference path="../../virtual.d.ts" />
import * as siteSchema from "virtual:site-kit/site-schema";
import { field, type FieldAttrs } from "./field.ts";
import { getSettings, settingsRef } from "./settings.ts";

export type UiValues = Record<string, string | number>;

// `locale` is the page's locale code: templates get it as a prop. Without it,
// the default locale's strings.
export async function getUi(locale?: string) {
  const settings = await getSettings(locale);
  const ref = settingsRef(locale);
  const ui = settings.ui as Record<string, string | Record<string, string>>;
  const declared = siteSchema.siteUi ?? {};
  const numbers = new Intl.NumberFormat(settings.language);
  const plurals = new Intl.PluralRules(settings.language);

  const valueOf = (key: string) => {
    if (!Object.hasOwn(ui, key)) {
      throw new Error(`Unknown interface string "${key}". The interface strings are ${Object.keys(ui).join(", ")}. Declare a site's own in siteUi in src/site.schema.ts.`);
    }
    return ui[key];
  };

  return {
    // The string's text, with its parameters filled from `values`.
    text(key: string, values: UiValues = {}): string {
      const value = valueOf(key);
      const { params = [], plural } = declared[key] ?? {};
      let text = typeof value === "string" ? value : (value[plurals.select(Number(values[plural!]))] ?? value.other);
      for (const name of params) {
        const given = values[name];
        if (given === undefined) throw new Error(`Interface string "${key}" needs a value for {${name}}.`);
        text = text.replaceAll(`{${name}}`, typeof given === "number" ? numbers.format(given) : given);
      }
      return text;
    },
    // The field attributes of the string's settings value.
    field(key: string): FieldAttrs {
      valueOf(key);
      return field(ref, "ui", key);
    },
  };
}
