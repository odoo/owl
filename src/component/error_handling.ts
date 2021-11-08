import type { ComponentNode } from "./component_node";
import type { Fiber } from "./fibers";

export const fibersInError: WeakMap<Fiber, Error> = new WeakMap();
export const nodeErrorHandlers: WeakMap<ComponentNode, ((error: Error) => void)[]> = new WeakMap();

function _handleError(node: ComponentNode | null, error: Error): boolean {
  if (!node) {
    return false;
  }
  const fiber = node.fiber;
  if (fiber) {
    fibersInError.set(fiber, error);
  }

  const errorHandlers = nodeErrorHandlers.get(node);
  if (errorHandlers) {
    if (fiber && !fiber.children.length) {
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

export function handleError(node: ComponentNode, error: Error) {
  const fiber = node.fiber!;
  fibersInError.set(fiber.root, error);

  if (!_handleError(node, error)) {
    try {
      node.app.destroy();
    } catch (e) {}
  }
}
