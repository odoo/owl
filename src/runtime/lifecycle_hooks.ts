import { ComponentNode, getCurrent } from "./component_node";
import { PluginManager } from "./plugins";
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
  const node = getCurrent();
  node.willStart.push(decorate(node, fn, "onWillStart"));
}

export function onWillUpdateProps(fn: (nextProps: any) => Promise<void> | void | any) {
  const node = getCurrent();
  node.willUpdateProps.push(decorate(node, fn, "onWillUpdateProps"));
}

export function onMounted(fn: () => void | any) {
  const node = getCurrent();
  node.mounted.push(decorate(node, fn, "onMounted"));
}

export function onWillPatch(fn: () => any | void) {
  const node = getCurrent();
  node.willPatch.unshift(decorate(node, fn, "onWillPatch"));
}

export function onPatched(fn: () => void | any) {
  const node = getCurrent();
  node.patched.push(decorate(node, fn, "onPatched"));
}

export function onWillUnmount(fn: () => void | any) {
  const node = getCurrent();
  node.willUnmount.unshift(decorate(node, fn, "onWillUnmount"));
}

export function onWillDestroy(fn: () => void | any) {
  const pm = PluginManager.current;
  if (pm) {
    (pm as any).onDestroyCb.push(fn);
  } else {
    const node = getCurrent();
    node.willDestroy.unshift(decorate(node, fn, "onWillDestroy"));
  }
}

type OnErrorCallback = (error: any) => void | any;
export function onError(callback: OnErrorCallback) {
  const node = getCurrent();
  let handlers = nodeErrorHandlers.get(node);
  if (!handlers) {
    handlers = [];
    nodeErrorHandlers.set(node, handlers);
  }
  handlers.push(callback.bind(node.component));
}
