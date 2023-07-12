import { OwlError } from "./error_handling";
export type Callback = () => void;

/**
 * Creates a batched version of a callback so that all calls to it in the same
 * microtick will only call the original callback once.
 *
 * @param callback the callback to batch
 * @returns a batched version of the original callback
 */
export function batched(callback: Callback): Callback {
  let scheduled = false;
  return async (...args) => {
    if (!scheduled) {
      scheduled = true;
      await Promise.resolve();
      scheduled = false;
      callback(...args);
    }
  };
}

/**
 * Determine whether the given element is contained in its ownerDocument:
 * either directly or with a shadow root in between.
 */
export function inOwnerDocument(el?: HTMLElement) {
  if (!el) {
    return false;
  }
  if (el.ownerDocument.contains(el)) {
    return true;
  }
  const rootNode = el.getRootNode();
  return rootNode instanceof ShadowRoot && el.ownerDocument.contains(rootNode.host);
}

export function validateTarget(target: HTMLElement | ShadowRoot) {
  // Get the document and HTMLElement corresponding to the target to allow mounting in iframes
  const document = target && target.ownerDocument;
  if (document) {
    const HTMLElement = document.defaultView!.HTMLElement;
    if (target instanceof HTMLElement || target instanceof ShadowRoot) {
      if (!document.body.contains(target instanceof HTMLElement ? target : target.host)) {
        throw new OwlError("Cannot mount a component on a detached dom node");
      }
      return;
    }
  }
  throw new OwlError("Cannot mount component: the target is not a valid DOM element");
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
    throw new OwlError("Error while fetching xml templates");
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
