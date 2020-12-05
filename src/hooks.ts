import { Component, useComponent, useComponentData } from "./core";
import { observe } from "./reactivity";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function useState<T>(state: T): T {
  const component = useComponent();
  return observe(state, () => component.render());
}

export function onWillStart(cb: any) {
  const component = useComponent();
  const currentData = component.__owl__;
  const prev = currentData!.willStartCB;
  currentData!.willStartCB = () => {
    return Promise.all([prev.call(component), cb.call(component)]);
  };
}

export function onMounted(cb: any) {
  const component = useComponent();
  const currentData = component.__owl__;
  const prev = currentData!.mountedCB;
  currentData!.mountedCB = () => {
    prev();
    cb.call(component);
  };
}

// -----------------------------------------------------------------------------
// useRef
// -----------------------------------------------------------------------------

/**
 * The purpose of this hook is to allow components to get a reference to a sub
 * html node or component.
 */
interface Ref<C extends Component = Component> {
  el: HTMLElement | null;
  comp: C | null;
}

export function useRef<C extends Component = Component>(name: string): Ref<C> {
  const __owl__ = useComponentData();
  return {
    get el(): HTMLElement | null {
      const val = __owl__.bdom && __owl__.bdom.refs && __owl__.bdom.refs[name];
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
      // const val = __owl__.refs && __owl__.refs[name];
      // return val instanceof Component ? (val as C) : null;
    },
  };
}
