export class EventBus extends EventTarget {
  trigger(name: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(name, { detail: payload }));
  }
}

/**
 * Compares two values one level deep: arrays element by element, plain
 * objects own key by own key (with `Object.is` on each value). Anything else
 * (Map, Set, class instances, ...) only compares equal by identity. Meant to
 * be used as the `equals` option of `signal` or `computed` when a fresh
 * array/object is produced on each recompute.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  // restrict to plain objects: a Map or a class instance has no own enumerable
  // keys and would otherwise compare equal to anything similar
  const protoA = Object.getPrototypeOf(a);
  const protoB = Object.getPrototypeOf(b);
  if (
    (protoA !== Object.prototype && protoA !== null) ||
    (protoB !== Object.prototype && protoB !== null)
  ) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }
  return true;
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
