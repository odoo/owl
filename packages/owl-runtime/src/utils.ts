import { OwlError } from "@odoo/owl-core";

export { batched, EventBus, htmlEscape, Markup, markup } from "@odoo/owl-core";

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

/**
 * Determine whether the given element is contained in a specific root documnet:
 * either directly or with a shadow root in between or in an iframe.
 */
function isAttachedToDocument(
  element: HTMLElement | ShadowRoot,
  documentElement: Document
): boolean {
  let current: Node = element;
  const shadowRoot = documentElement.defaultView!.ShadowRoot;
  while (current) {
    if (current === documentElement) {
      return true;
    }
    if (current.parentNode) {
      current = current.parentNode;
    } else if (current instanceof shadowRoot && current.host) {
      current = current.host;
    } else {
      return false;
    }
  }
  return false;
}

export function validateTarget(target: HTMLElement | ShadowRoot) {
  // Get the document and HTMLElement corresponding to the target to allow mounting in iframes
  const document = target && target.ownerDocument;
  if (document) {
    if (!document.defaultView) {
      throw new OwlError(
        "Cannot mount a component: the target document is not attached to a window (defaultView is missing)"
      );
    }
    const HTMLElement = document.defaultView.HTMLElement;
    if (target instanceof HTMLElement || target instanceof ShadowRoot) {
      if (!isAttachedToDocument(target, document)) {
        throw new OwlError("Cannot mount a component on a detached dom node");
      }
      return;
    }
  }
  throw new OwlError("Cannot mount component: the target is not a valid DOM element");
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
