import type { ComponentNode } from "./component_node";
import type { Fiber } from "./fibers";

// Maps fibers to thrown errors
export const fibersInError: WeakMap<Fiber, any> = new WeakMap();
export const nodeErrorHandlers: WeakMap<ComponentNode, ((error: any) => void)[]> = new WeakMap();

function _handleError(node: ComponentNode | null, error: any, isFirstRound = false): boolean {
  if (!node) {
    return false;
  }
  const fiber = node.fiber;
  if (fiber) {
    fibersInError.set(fiber, error);
  }

  const errorHandlers = nodeErrorHandlers.get(node);
  if (errorHandlers) {
    if (isFirstRound && fiber) {
      fiber.root.counter--;
    }

    let stopped = false;
    // execute in the opposite order
    for (let i = errorHandlers.length - 1; i >= 0; i--) {
      try {
        errorHandlers[i](error);
        stopped = true;
        break;
      } catch (e) {
        error = e;
      }
    }

    if (stopped) {
      return true;
    }
  }
  return _handleError(node.parent, error);
}

type ErrorParams = { error: any } & ({ node: ComponentNode } | { fiber: Fiber });
export function handleError(params: ErrorParams) {
  const error = params.error;
  const node = "node" in params ? params.node : params.fiber.node;
  const fiber = "fiber" in params ? params.fiber : node.fiber!;

  // resets the fibers on components if possible. This is important so that
  // new renderings can be properly included in the initial one, if any.
  let current: Fiber | null = fiber;
  do {
    current.node.fiber = current;
    current = current.parent;
  } while (current);

  fibersInError.set(fiber.root, error);

  const handled = _handleError(node, error, true);
  if (!handled) {
    try {
      node.app.destroy();
    } catch (e) {}
  }
  return handled;
}
