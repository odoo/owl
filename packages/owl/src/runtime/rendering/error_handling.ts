import { OwlError } from "../../common/owl_error";
import type { ComponentNode } from "../component_node";
import type { Fiber } from "./fibers";

// Maps fibers to thrown errors
export const fibersInError: WeakMap<Fiber, any> = new WeakMap();
export const nodeErrorHandlers: WeakMap<
  ComponentNode,
  ((error: any, finalize: Function) => void)[]
> = new WeakMap();

type ErrorParams = { error: any } & ({ node: ComponentNode } | { fiber: Fiber });
export function handleError(params: ErrorParams) {
  let { error } = params;
  let node: ComponentNode | null = "node" in params ? params.node : params.fiber.node;
  const fiber = "fiber" in params ? params.fiber : node!.fiber;
  const app = node!.app;

  if (fiber) {
    // resets the fibers on components if possible. This is important so that
    // new renderings can be properly included in the initial one, if any.
    let current: Fiber | null = fiber;
    do {
      current.node.fiber = current;
      fibersInError.set(current, error);
      current = current.parent;
    } while (current);

    fibersInError.set(fiber.root!, error);
  }

  const finalize = () => {
    try {
      app.destroy();
    } catch (e) {
      // mute all errors here because we are in a corrupted state anyway
    }
    return Object.assign(new OwlError(`[Owl] Unhandled error. Destroying the root component`), {
      cause: error,
    });
  };

  // Walk up the component tree looking for error handlers
  while (node) {
    const nodeFiber = node.fiber;
    if (nodeFiber) {
      fibersInError.set(nodeFiber, error);
    }

    const errorHandlers = nodeErrorHandlers.get(node);
    if (errorHandlers) {
      // execute in the opposite order
      for (let i = errorHandlers.length - 1; i >= 0; i--) {
        try {
          errorHandlers[i]!(error, finalize);
          return; // handled
        } catch (e) {
          error = e;
        }
      }
    }
    node = node.parent;
  }

  // No handler found — create the OwlError, then let the app handle it.
  // app._handleError is called after error creation, so it doesn't appear
  // in the error's .stack property.
  const owlError = finalize();
  app._handleError(owlError);
}
