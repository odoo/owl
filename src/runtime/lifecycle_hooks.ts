import { ComponentNode } from "./component_node";
import { getContext } from "./context";
import { nodeErrorHandlers } from "./rendering/error_handling";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

function decorate(node: ComponentNode, f: Function, hookName: string) {
  const result = f.bind(node.component);
  if (node.app.dev) {
    const suffix = f.name ? ` <${f.name}>` : "";
    Reflect.defineProperty(result, "name", {
      value: hookName + suffix,
    });
  }
  return result;
}

export function onWillStart(fn: () => Promise<void> | void | any) {
  const { node } = getContext("component");
  node.willStart.push(decorate(node, fn, "onWillStart"));
}

export function onWillUpdateProps(fn: (nextProps: any) => Promise<void> | void | any) {
  const { node } = getContext("component");
  node.willUpdateProps.push(decorate(node, fn, "onWillUpdateProps"));
}

export function onMounted(fn: () => void | any) {
  const { node } = getContext("component");
  node.mounted.push(decorate(node, fn, "onMounted"));
}

export function onWillPatch(fn: () => any | void) {
  const { node } = getContext("component");
  node.willPatch.unshift(decorate(node, fn, "onWillPatch"));
}

export function onPatched(fn: () => void | any) {
  const { node } = getContext("component");
  node.patched.push(decorate(node, fn, "onPatched"));
}

export function onWillUnmount(fn: () => void | any) {
  const { node } = getContext("component");
  node.willUnmount.unshift(decorate(node, fn, "onWillUnmount"));
}

export function onWillDestroy(fn: () => void | any) {
  const context = getContext();
  if (context.type === "component") {
    context.node.willDestroy.unshift(decorate(context.node, fn, "onWillDestroy"));
  } else {
    context.manager.onDestroyCb.push(fn);
  }
}

type OnErrorCallback = (error: any) => void | any;
export function onError(callback: OnErrorCallback) {
  const { node } = getContext("component");
  let handlers = nodeErrorHandlers.get(node);
  if (!handlers) {
    handlers = [];
    nodeErrorHandlers.set(node, handlers);
  }
  handlers.push(callback.bind(node.component));
}
