import { getCurrent } from "./component_node";
import { nodeErrorHandlers } from "./rendering/error_handling";
import { OwlError } from "../common/owl_error";

const TIMEOUT = Symbol("timeout");
const HOOK_TIMEOUT: { [key: string]: number } = {
  onWillStart: 3000,
  onWillUpdateProps: 3000,
};
function wrapError(fn: (...args: any[]) => any, hookName: string) {
  const error = new OwlError() as Error & {
    cause: any;
  };
  const timeoutError = new OwlError();
  const node = getCurrent();
  return (...args: any[]) => {
    const onError = (cause: any) => {
      error.cause = cause;
      error.message =
        cause instanceof Error
          ? `The following error occurred in ${hookName}: "${cause.message}"`
          : `Something that is not an Error was thrown in ${hookName} (see this Error's "cause" property)`;
      throw error;
    };
    let result;
    try {
      result = fn(...args);
    } catch (cause) {
      onError(cause);
    }
    if (!(result instanceof Promise)) {
      return result;
    }
    const timeout = HOOK_TIMEOUT[hookName];
    if (timeout) {
      const fiber = node.fiber;
      Promise.race([
        result.catch(() => {}),
        new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), timeout)),
      ]).then((res) => {
        if (res === TIMEOUT && node.fiber === fiber && node.status <= 2) {
          timeoutError.message = `${hookName}'s promise hasn't resolved after ${
            timeout / 1000
          } seconds`;
          console.log(timeoutError);
        }
      });
    }
    return result.catch(onError);
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

export function onWillPatch(fn: () => any | void) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willPatch.unshift(decorate(fn.bind(node.component), "onWillPatch"));
}

export function onPatched(fn: () => void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.patched.push(decorate(fn.bind(node.component), "onPatched"));
}

export function onWillUnmount(fn: () => void | any) {
  const node = getCurrent();
  const decorate = node.app.dev ? wrapError : (fn: any) => fn;
  node.willUnmount.unshift(decorate(fn.bind(node.component), "onWillUnmount"));
}

export function onWillDestroy(fn: () => void | any) {
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
