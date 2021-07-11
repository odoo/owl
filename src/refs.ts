// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

import type { Component } from "./core/component";
import { getCurrent } from "./core/owl_node";

/**
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
interface Ref<C extends Component = Component> {
  el: HTMLElement | null;
  comp: C | null;
}

export function useRef<C extends Component = Component>(name: string): Ref<C> {
  const node = getCurrent()!;
  return {
    get el(): HTMLElement | null {
      const val = node.refs[name];
      return val!;
      // if (val instanceof HTMLElement) {
      //   return val;
      // } else if (val instanceof Component) {
      //   return val.el;
      // }
      // return null;
    },
    get comp(): C | null {
      return null;
      // const val = node.refs && node.refs[name];
      // return val instanceof Component ? (val as C) : null;
    },
  };
}
