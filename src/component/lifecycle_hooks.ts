import { getCurrent } from "./component_node";
import { nodeErrorHandlers } from "./error_handling";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willStart.push(fn);
}

export function onWillUpdateProps(fn: (nextProps: any) => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willUpdateProps.push(fn);
}

export function onMounted(fn: () => void | any) {
  const node = getCurrent()!;
  node.mounted.push(fn);
}

export function onWillPatch(fn: () => Promise<void> | any | void) {
  const node = getCurrent()!;
  node.willPatch.unshift(fn);
}

export function onPatched(fn: () => void | any) {
  const node = getCurrent()!;
  node.patched.push(fn);
}

export function onWillUnmount(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willUnmount.unshift(fn);
}

export function onWillDestroy(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willDestroy.push(fn);
}

export function onWillRender(fn: () => void | any) {
  const node = getCurrent()!;
  const renderFn = node.renderFn;
  node.renderFn = () => {
    fn();
    return renderFn();
  };
}

export function onRendered(fn: () => void | any) {
  const node = getCurrent()!;
  const renderFn = node.renderFn;
  node.renderFn = () => {
    const result = renderFn();
    fn();
    return result;
  };
}

type OnErrorCallback = (error: any) => void | any;
export function onError(callback: OnErrorCallback) {
  const node = getCurrent()!;
  let handlers = nodeErrorHandlers.get(node);
  if (!handlers) {
    handlers = [];
    nodeErrorHandlers.set(node, handlers);
  }
  handlers.push(callback);
}
