export class EventBus extends EventTarget {
  trigger(name: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(name, { detail: payload }));
  }
}

export function whenReady(fn?: any): Promise<void> {
  return new Promise(function (resolve) {
    if (document.readyState !== "loading") {
      resolve(true);
    } else {
      document.addEventListener("DOMContentLoaded", resolve, false);
    }
  }).then(fn || function () {});
}

export async function loadFile(url: string): Promise<string> {
  const result = await fetch(url);
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  return await result.text();
}

/*
 * This class just transports the fact that a string is safe
 * to be injected as HTML. Overriding a JS primitive is quite painful though
 * so we need to redfine toString and valueOf.
 */
export class Markup extends String {}

/*
 * Marks a value as safe, that is, a value that can be injected as HTML directly.
 * It should be used to wrap the value passed to a t-out directive to allow a raw rendering.
 */
export function markup(value: any) {
  return new Markup(value);
}
