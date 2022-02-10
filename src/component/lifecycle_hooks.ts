import { getCurrent } from "./component_node";
import { nodeErrorHandlers } from "./error_handling";

function wrapError(fn: (...args: any[]) => any, hookName: string) {
  const error = new Error(`The following error occurred in ${hookName}: `) as Error & {
    cause: any;
  };
  return (...args: any[]) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((cause) => {
          error.cause = cause;
          if (cause instanceof Error) {
            error.message += `"${cause.message}"`;
          }
          throw error;
        });
      }
      return result;
    } catch (cause) {
      if (cause instanceof Error) {
        error.message += `"${cause.message}"`;
      }
      throw error;
    }
  };
}

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: () => Promise<void> | void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willStart.push(decorate(fn.bind(node.component), "onWillStart"));
}

export function onWillUpdateProps(fn: (nextProps: any) => Promise<void> | void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willUpdateProps.push(decorate(fn.bind(node.component), "onWillUpdateProps"));
}

export function onMounted(fn: () => void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.mounted.push(decorate(fn.bind(node.component), "onMounted"));
}

export function onWillPatch(fn: () => Promise<void> | any | void) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willPatch.unshift(decorate(fn.bind(node.component), "onWillPatch"));
}

export function onPatched(fn: () => void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.patched.push(decorate(fn.bind(node.component), "onPatched"));
}

export function onWillUnmount(fn: () => Promise<void> | void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willUnmount.unshift(decorate(fn.bind(node.component), "onWillUnmount"));
}

export function onWillDestroy(fn: () => Promise<void> | void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willDestroy.push(decorate(fn.bind(node.component), "onWillDestroy"));
}

export function onWillRender(fn: () => void | any) {
  const node = getCurrent();
  const renderFn = node.renderFn;
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.renderFn = decorate(() => {
    fn.call(node.component);
    return renderFn();
  }, "onWillRender");
}

export function onRendered(fn: () => void | any) {
  const node = getCurrent();
  const renderFn = node.renderFn;
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.renderFn = decorate(() => {
    const result = renderFn();
    fn.call(node.component);
    return result;
  }, "onRendered");
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
