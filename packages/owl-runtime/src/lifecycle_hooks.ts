import { useScope, type PluginManager } from "@odoo/owl-core";
import { ComponentNode, getComponentScope } from "./component_node";
import { nodeErrorHandlers } from "./rendering/error_handling";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export { onWillDestroy, onWillStart } from "@odoo/owl-core";

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
  // the only concrete scopes are ComponentNode and PluginManager
  const scope = useScope() as ComponentNode | PluginManager;
  if (scope instanceof ComponentNode) {
    // matching the other lifecycle hooks, bind the handler to the component
    callback = callback.bind(scope.component);
  }
  let handlers = nodeErrorHandlers.get(scope);
  if (!handlers) {
    handlers = [];
    nodeErrorHandlers.set(scope, handlers);
  }
  handlers.push(callback);
}
