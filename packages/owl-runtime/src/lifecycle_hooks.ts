import { ComponentNode, getComponentScope } from "./component_node";
import { nodeErrorHandlers } from "./rendering/error_handling";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export { onWillDestroy, onWillStart } from "@odoo/owl-core";

/**
 * @deprecated will be removed in a future version. A prop that the component
 * must react to should be given as a signal (validated with `t.signal(...)`):
 * derive state from it with `computed`, or run code when it changes with
 * `useEffect` or `useOnChange`.
 */
export function onWillUpdateProps(
  fn: (nextProps: any, scope: ComponentNode) => Promise<void> | void | any
) {
  const scope = getComponentScope();
  // decorate prepends scope as the first arg, but onWillUpdateProps's public
  // signature is (nextProps, scope) — swap back.
  function swapped(this: any, s: ComponentNode, nextProps: any) {
    return fn.call(this, nextProps, s);
  }
  scope.willUpdateProps.push(scope.decorate(swapped, "onWillUpdateProps"));
}

export function onMounted(fn: (scope: ComponentNode) => void | any) {
  const scope = getComponentScope();
  scope.mounted.push(scope.decorate(fn, "onMounted"));
}

export function onWillPatch(fn: (scope: ComponentNode) => any | void) {
  const scope = getComponentScope();
  scope.willPatch.unshift(scope.decorate(fn, "onWillPatch"));
}

export function onPatched(fn: (scope: ComponentNode) => void | any) {
  const scope = getComponentScope();
  scope.patched.push(scope.decorate(fn, "onPatched"));
}

export function onWillUnmount(fn: (scope: ComponentNode) => void | any) {
  const scope = getComponentScope();
  scope.willUnmount.unshift(scope.decorate(fn, "onWillUnmount"));
}

type OnErrorCallback = (error: any) => void | any;
export function onError(callback: OnErrorCallback) {
  const scope = getComponentScope();
  let handlers = nodeErrorHandlers.get(scope);
  if (!handlers) {
    handlers = [];
    nodeErrorHandlers.set(scope, handlers);
  }
  handlers.push(callback.bind(scope.component));
}
