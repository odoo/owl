import type { ComponentNode } from "./component_node";
import type { Fiber } from "./fibers";

export const fibersInError: WeakMap<Fiber, Error> = new WeakMap();
export const nodeErrorHandlers: WeakMap<ComponentNode, ((error: Error) => void)[]> = new WeakMap();

function _handleError(node: ComponentNode | null, error: Error, isFirstRound = false): boolean {
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
        error = e as Error;
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

export function handleError(entity: ComponentNode | Fiber, error: Error) {
  let node: ComponentNode;
  let fiber: Fiber;
  // soft type check on Fiber
  if ("node" in entity) {
    fiber = entity;
    node = entity.node;
  } else {
    node = entity;
    fiber = entity.fiber!;
  }
  fibersInError.set(fiber.root, error);

  const handled = _handleError(node, error, true);
  if (!handled) {
    try {
      node.app.destroy();
    } catch (e) {}
  }
  return handled;
}
