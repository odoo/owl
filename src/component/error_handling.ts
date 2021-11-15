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

    let propagate = true;
    for (const h of errorHandlers) {
      try {
        h(error);
        propagate = false;
      } catch (e) {
        error = e;
      }
    }

    if (propagate) {
      return _handleError(node.parent, error);
    }
    return true;
  } else {
    return _handleError(node.parent, error);
  }
}

type ErrorParams = { error: any } & ({ node: ComponentNode } | { fiber: Fiber });
export function handleError(params: ErrorParams) {
  const error = params.error;
  const node = "node" in params ? params.node : params.fiber.node;
  const fiber = "fiber" in params ? params.fiber : node.fiber!;

  fibersInError.set(fiber.root, error);

  const handled = _handleError(node, error, true);
  if (!handled) {
    try {
      node.app.destroy();
    } catch (e) {}
  }
  return handled;
}
