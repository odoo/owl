import { getCurrent } from "./component_node";
import { nodeErrorHandlers, OwlError } from "./error_handling";

const TIMEOUT = Symbol("timeout");
function wrapError(fn: (...args: any[]) => any, hookName: string) {
  const error = new OwlError(`The following error occurred in ${hookName}: `) as Error & {
    cause: any;
  };
  const timeoutError = new OwlError(`${hookName}'s promise hasn't resolved after 3 seconds`);
  const node = getCurrent();
  return (...args: any[]) => {
    const onError = (cause: any) => {
      error.cause = cause;
      if (cause instanceof Error) {
        error.message += `"${cause.message}"`;
      } else {
        error.message = `Something that is not an Error was thrown in ${hookName} (see this Error's "cause" property)`;
      }
      throw error;
    };
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        if (hookName === "onWillStart" || hookName === "onWillUpdateProps") {
          const fiber = node.fiber;
          Promise.race([
            result.catch(() => {}),
            new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), 3000)),
          ]).then((res) => {
            if (res === TIMEOUT && node.fiber === fiber) {
              console.warn(timeoutError);
            }
          });
        }
        return result.catch(onError);
      }
      return result;
    } catch (cause) {
      onError(cause);
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
  fn = decorate(fn.bind(node.component), "onWillRender");
  node.renderFn = () => {
    fn();
    return renderFn();
  };
}

export function onRendered(fn: () => void | any) {
  const node = getCurrent();
  const renderFn = node.renderFn;
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  fn = decorate(fn.bind(node.component), "onRendered");
  node.renderFn = () => {
    const result = renderFn();
    fn();
    return result;
  };
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
