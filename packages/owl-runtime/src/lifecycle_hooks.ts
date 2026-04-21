import { ComponentNode, getComponentScope } from "./component_node";
import { nodeErrorHandlers } from "./rendering/error_handling";
import { Scope, useScope } from "./scope";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: (scope: Scope) => Promise<void> | void | any) {
  const scope = useScope();
  scope.willStart.push(scope.decorate(fn, "onWillStart") as () => any);
}

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

export function onWillDestroy(fn: (scope: Scope) => void | any) {
  const scope = useScope();
  scope.onDestroy(scope.decorate(fn, "onWillDestroy") as () => void);
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
