// -----------------------------------------------------------------------------
// Hooks for component-side router usage.
// -----------------------------------------------------------------------------

import { plugin, onWillDestroy } from "@odoo/owl-runtime";
import { Router } from "./router";
import { RouterPlugin } from "./plugin";

/**
 * Returns the router from the nearest plugin manager that started a
 * `RouterPlugin`. Throws if no router has been provided.
 *
 * Generic parameter lets consumers narrow the state type:
 *
 *   const router = useRouter<MyAppState>();
 */
export function useRouter<
  TState extends Record<string, any> = Record<string, any>,
>(): Router<TState> {
  const p = plugin(RouterPlugin);
  return p.router as Router<TState>;
}

// -----------------------------------------------------------------------------
// useLinkInterceptor
// -----------------------------------------------------------------------------

export interface LinkInterceptorOptions {
  /**
   * Predicate deciding whether a click on `<a>` should be soft-navigated
   * (intercepted) instead of letting the browser do a full page load. Only
   * called once we have determined the click is otherwise eligible
   * (single-button, no modifier, parsable href, no `target=_blank`, etc.).
   */
  match: (anchor: HTMLAnchorElement, url: URL) => boolean;
  /**
   * Where to listen for clicks. Defaults to `document`. Pass an element to
   * scope interception (e.g. inside a single-page-app shell).
   */
  target?: EventTarget;
  /**
   * Whether to call `replaceState` instead of `pushState`. Defaults to
   * `false` (pushState).
   */
  replace?: boolean;
}

/**
 * Subscribe to clicks on internal links and soft-navigate via the router.
 * Cleans up automatically when the surrounding scope (component or plugin
 * manager) is destroyed.
 *
 * Example:
 *
 *   useLinkInterceptor(router, {
 *     match: (a, url) =>
 *       url.origin === window.location.origin &&
 *       url.pathname.startsWith("/odoo"),
 *   });
 */
export function useLinkInterceptor(router: Router, options: LinkInterceptorOptions): void {
  const target = options.target ?? document;
  const handler = (event: Event) => {
    const ev = event as MouseEvent;
    if (ev.defaultPrevented) return;
    if (ev.button !== undefined && ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    const path = (ev.composedPath?.() ?? []) as EventTarget[];
    let anchor: HTMLAnchorElement | null = null;
    for (const node of path) {
      if (node instanceof HTMLAnchorElement || (node as HTMLElement)?.tagName === "A") {
        anchor = node as HTMLAnchorElement;
        break;
      }
    }
    if (!anchor) return;
    if (anchor.target === "_blank") return;
    // contenteditable surfaces typically want browser-default behavior.
    if ((anchor as HTMLElement).closest?.("[contenteditable]")) return;

    const href = anchor.getAttribute("href");
    if (!href) return;
    if (href.startsWith("#")) return;

    let url: URL;
    try {
      url = new URL(anchor.href);
    } catch {
      return;
    }
    if (!options.match(anchor, url)) return;

    ev.preventDefault();
    router.navigate(url, options.replace ? { replace: true } : undefined);
  };

  target.addEventListener("click", handler);
  // Tie cleanup to the surrounding scope (component or plugin manager).
  onWillDestroy(() => target.removeEventListener("click", handler));
}
