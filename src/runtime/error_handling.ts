import type { ComponentNode } from "./component_node";
import type { Fiber } from "./fibers";

// Custom error class that wraps error that happen in the owl lifecycle
export class OwlError extends Error {
  cause?: any;
}

// Maps fibers to thrown errors
export const fibersInError: WeakMap<Fiber, any> = new WeakMap();
export const nodeErrorHandlers: WeakMap<ComponentNode, ((error: any) => void)[]> = new WeakMap();

function _handleError(node: ComponentNode | null, error: any): boolean {
  if (!node) {
    return false;
  }
  const fiber = node.fiber;
  if (fiber) {
    fibersInError.set(fiber, error);
  }

  const errorHandlers = nodeErrorHandlers.get(node);
  if (errorHandlers) {
    let handled = false;
    // execute in the opposite order
    for (let i = errorHandlers.length - 1; i >= 0; i--) {
      try {
        errorHandlers[i](error);
        handled = true;
        break;
      } catch (e) {
        error = e;
      }
    }

    if (handled) {
      return true;
    }
  }
  return _handleError(node.parent, error);
}

type ErrorParams = { error: any } & ({ node: ComponentNode } | { fiber: Fiber });
export function handleError(params: ErrorParams) {
  let { error } = params;
  // Wrap error if it wasn't wrapped by wrapError (ie when not in dev mode)
  if (!(error instanceof OwlError)) {
    error = Object.assign(
      new OwlError(`An error occured in the owl lifecycle (see this Error's "cause" property)`),
      { cause: error }
    );
  }
  const node = "node" in params ? params.node : params.fiber.node;
  const fiber = "fiber" in params ? params.fiber : node.fiber!;

  // resets the fibers on components if possible. This is important so that
  // new renderings can be properly included in the initial one, if any.
  let current: Fiber | null = fiber;
  do {
    current.node.fiber = current;
    current = current.parent;
  } while (current);

  fibersInError.set(fiber.root!, error);

  const handled = _handleError(node, error);
  if (!handled) {
    console.warn(`[Owl] Unhandled error. Destroying the root component`);
    try {
      node.app.destroy();
    } catch (e) {
      console.error(e);
    }
  }
}
