import type { PluginManager } from "@odoo/owl-core";
import type { ComponentNode } from "../component_node";
import type { Fiber } from "./fibers";

// Maps fibers to thrown errors
export const fibersInError: WeakMap<Fiber, any> = new WeakMap();
export const nodeErrorHandlers: WeakMap<
  ComponentNode | PluginManager,
  ((error: any, finalize: Function) => void)[]
> = new WeakMap();

// Invokes a single scope's error handlers, latest registered first. Returns
// whether one of them caught, along with the final (possibly rethrown) error.
function invokeScopeHandlers(
  scope: ComponentNode | PluginManager,
  error: any,
  finalize: Function
): { handled: boolean; error: any } {
  const handlers = nodeErrorHandlers.get(scope);
  if (handlers) {
    for (let i = handlers.length - 1; i >= 0; i--) {
      try {
        handlers[i](error, finalize);
        return { handled: true, error };
      } catch (e) {
        error = e;
      }
    }
  }
  return { handled: false, error };
}

// Walks up from `node` (inclusive), invoking the latest error handler at each
// level. Plugin managers sit between the node they are provided at and its
// parent: after a node's own handlers, the managers introduced at that node
// (from `node.pluginManager` up to, but excluding, the parent's manager) get
// a chance, so plugin `onError` handlers guard the subtree the plugins are
// visible in — the whole app for app-level plugins. Returns whether a handler
// caught and the final (possibly rethrown) error. When `markFibers` is true,
// each visited fiber is recorded in `fibersInError` so re-renders can detect
// and clear in-error state — this is what `handleError` wants, but sub-root
// forwarders (Suspense, Portal) want to leave the outer tree's fibers alone.
function invokeErrorHandlers(
  node: ComponentNode | null,
  error: any,
  finalize: Function,
  markFibers: boolean
): { handled: boolean; error: any } {
  while (node) {
    if (markFibers && node.fiber) {
      fibersInError.set(node.fiber, error);
    }
    let result = invokeScopeHandlers(node, error, finalize);
    if (result.handled) {
      return result;
    }
    error = result.error;
    const stop = node.parent ? node.parent.pluginManager : null;
    let manager: PluginManager | null = node.pluginManager;
    for (; manager && manager !== stop; manager = manager.parent) {
      result = invokeScopeHandlers(manager, error, finalize);
      if (result.handled) {
        return result;
      }
      error = result.error;
    }
    node = node.parent;
  }
  return { handled: false, error };
}

// Builds a sub-root error handler that re-routes errors to `boundary`'s
// parent chain. Used by Suspense/Portal so a descendant failure reaches the
// consumer's `onError` without the main `handleError` entry point (which
// would mark the outer tree's fibers as in-error and stall its mount).
export function forwardErrorToParent(boundary: ComponentNode) {
  return (error: any, finalize: Function): void => {
    if (boundary.app.destroyed) {
      throw error;
    }
    const { handled } = invokeErrorHandlers(boundary, error, finalize, false);
    if (!handled) {
      boundary.app._handleError(finalize());
    }
  };
}

type ErrorParams = { error: any } & ({ node: ComponentNode } | { fiber: Fiber });
export function handleError(params: ErrorParams) {
  let { error } = params;
  let node: ComponentNode | null = "node" in params ? params.node : params.fiber.node;
  const fiber = "fiber" in params ? params.fiber : node!.fiber;
  const app = node!.app;

  // Once the app has been destroyed (e.g. by a prior unhandled error), stop
  // re-running error handling as the stack unwinds through ancestor renders.
  if (app.destroyed) {
    throw error;
  }

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
    return error;
  };

  const result = invokeErrorHandlers(node, error, finalize, true);
  if (!result.handled) {
    error = result.error;
    app._handleError(finalize());
  }
}
