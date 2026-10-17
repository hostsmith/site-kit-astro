// The tel: link of a phone number as a site writes it, such as
// "(218) 555-0142": only the digits and a leading "+" stay.
export function telHref(number: string): string {
  return `tel:${number.replace(/[^+\d]/g, "")}`;
}
