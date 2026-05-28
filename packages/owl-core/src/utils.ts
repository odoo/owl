export class EventBus extends EventTarget {
  trigger(name: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(name, { detail: payload }));
  }
}

/*
 * This class just transports the fact that a string is safe
 * to be injected as HTML. Overriding a JS primitive is quite painful though
 * so we need to redfine toString and valueOf.
 */
export class Markup extends String {}

export function htmlEscape(str: any): Markup {
  if (str instanceof Markup) {
    return str;
  }
  if (str === undefined) {
    return markup("");
  }
  if (typeof str === "number") {
    return markup(String(str));
  }
  [
    ["&", "&amp;"],
    ["<", "&lt;"],
    [">", "&gt;"],
    ["'", "&#x27;"],
    ['"', "&quot;"],
    ["`", "&#x60;"],
  ].forEach((pairs) => {
    str = String(str).replace(new RegExp(pairs[0], "g"), pairs[1]);
  });
  return markup(str);
}

/*
 * Marks a value as safe, that is, a value that can be injected as HTML directly.
 * It should be used to wrap the value passed to a t-out directive to allow a raw rendering.
 *
 * If called as a tag function, the interpolated strings are escaped.
 */
export function markup(strings: TemplateStringsArray, ...placeholders: unknown[]): Markup;
export function markup(value: string): Markup;
export function markup(
  valueOrStrings: string | TemplateStringsArray,
  ...placeholders: unknown[]
): Markup {
  if (!Array.isArray(valueOrStrings)) {
    return new Markup(valueOrStrings);
  }
  const strings = valueOrStrings;
  let acc = "";
  let i = 0;
  for (; i < placeholders.length; ++i) {
    acc += strings[i] + htmlEscape(placeholders[i]);
  }
  acc += strings[i];
  return new Markup(acc);
}
