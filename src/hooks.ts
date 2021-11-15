import type { Env } from "./app/app";
import { getCurrent } from "./component/component_node";

// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

/**
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
export function useRef<T extends HTMLElement = HTMLElement>(name: string): { el: T | null } {
  const node = getCurrent()!;
  return {
    get el(): T | null {
      return node.refs[name] || null;
    },
  };
}

// -----------------------------------------------------------------------------
// useEnv and useSubEnv
// -----------------------------------------------------------------------------

/**
 * This hook is useful as a building block for some customized hooks, that may
 * need a reference to the env of the component calling them.
 */
export function useEnv<E extends Env>(): E {
  return getCurrent()!.component.env as any;
}

/**
 * This hook is a simple way to let components use a sub environment.  Note that
 * like for all hooks, it is important that this is only called in the
 * constructor method.
 */
export function useSubEnv(envExtension: Env) {
  const node = getCurrent()!;
  node.childEnv = Object.freeze(Object.assign({}, node.childEnv, envExtension));
}
