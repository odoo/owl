export type Callback = () => void;

/**
 * Creates a batched version of a callback so that all calls to it in the same
 * microtick will only call the original callback once.
 *
 * @param callback the callback to batch
 * @returns a batched version of the original callback
 */
export function batched(callback: Callback): Callback {
  let called = false;
  return async () => {
    // This await blocks all calls to the callback here, then releases them sequentially
    // in the next microtick. This line decides the granularity of the batch.
    await Promise.resolve();
    if (!called) {
      called = true;
      // wait for all calls in this microtick to fall through before resetting "called"
      // so that only the first call to the batched function calls the original callback.
      // Schedule this before calling the callback so that calls to the batched function
      // within the callback will proceed only after resetting called to false, and have
      // a chance to execute the callback again
      Promise.resolve().then(() => (called = false));
      callback();
    }
  };
}

export function validateTarget(target: HTMLElement) {
  if (!(target instanceof HTMLElement)) {
    throw new Error("Cannot mount component: the target is not a valid DOM element");
  }
  if (!document.body.contains(target)) {
    throw new Error("Cannot mount a component on a detached dom node");
  }
}

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

// -----------------------------------------------------------------------------
//  xml tag helper
// -----------------------------------------------------------------------------
export const globalTemplates: { [key: string]: string | Element } = {};

export function xml(...args: Parameters<typeof String.raw>) {
  const name = `__template__${xml.nextId++}`;
  const value = String.raw(...args);
  globalTemplates[name] = value;
  return name;
}

xml.nextId = 1;
