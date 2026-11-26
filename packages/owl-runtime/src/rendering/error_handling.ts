import type { ComponentNode } from "../component_node";

export const nodeErrorHandlers: WeakMap<
  ComponentNode,
  ((error: any, finalize: Function) => void)[]
> = new WeakMap();

/**
 * Routes an error to the nearest onError handler, from `node` (inclusive) up
 * to the root. A handler that returns normally handles the error; one that
 * throws replaces it by what it threw, for the next handler. An unhandled
 * error destroys the app and is given to `app._handleError`.
 */
export function handleError(params: { node: ComponentNode | null; error: any }) {
  let { node, error } = params;
  if (!node) {
    throw error;
  }
  const app = node.app;

  // Once the app has been destroyed (e.g. by a prior unhandled error), stop
  // re-running error handling as the stack unwinds.
  if (app.destroyed) {
    throw error;
  }

  const finalize = () => {
    try {
      app.destroy();
    } catch (e) {
      // mute all errors here because we are in a corrupted state anyway
    }
    return error;
  };

  let current: ComponentNode | null = node;
  while (current) {
    const handlers = nodeErrorHandlers.get(current);
    if (handlers) {
      for (let i = handlers.length - 1; i >= 0; i--) {
        try {
          handlers[i](error, finalize);
          return;
        } catch (e) {
          error = e;
        }
      }
    }
    current = current.parent;
  }
  app._handleError(finalize());
}
