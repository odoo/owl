// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

import { getCurrent } from "./component/component_node";

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
