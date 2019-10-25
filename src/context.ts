import { Component, scheduler } from "./component/component";
import { EventBus } from "./core/event_bus";
import { Observer } from "./core/observer";
import { onWillUnmount } from "./hooks";
/**
 * The `Context` object provides a way to share data between an arbitrary number
 * of component. Usually, data is passed from a parent to its children component,
 * but when we have to deal with some mostly global information, this can be
 * annoying, since each component will need to pass the information to each
 * children, even though some or most of them will not use the information.
 *
 * With a `Context` object, each component can subscribe (with the `useContext`
 * hook) to its state, and will be updated whenever the context state is updated.
 */
export class Context extends EventBus {
  state: any;
  observer: Observer;
  rev: number = 1;
  // mapping from component id to last observed context id
  mapping: { [componentId: number]: number } = {};

  constructor(state: Object = {}) {
    super();
    this.observer = new Observer();
    this.observer.notifyCB = this.__notifyComponents.bind(this);
    this.state = this.observer.observe(state);
  }

  /**
   * Instead of using trigger to emit an update event, we actually implement
   * our own function to do that.  The reason is that we need to be smarter than
   * a simple trigger function: we need to wait for parent components to be
   * done before doing children components.  The reason is that if an update
   * as an effect of destroying a children, we do not want to call the
   * mapStoreToProps function of the child, nor rendering it.
   *
   * This method is not optimal if we have a bunch of asynchronous components:
   * we wait sequentially for each component to be completed before updating the
   * next.  However, the only things that matters is that children are updated
   * after their parents.  So, this could be optimized by being smarter, and
   * updating all widgets concurrently, except for parents/children.
   *
   * A potential cheap way to improve this situation is to keep track of the
   * depth of a component in the component tree. A root component has a depth of
   * 1, then its children of 2 and so on... Then, we can update all components
   * with the same depth in parallel.
   */
  async __notifyComponents() {
    const rev = ++this.rev;
    const subs = this.subscriptions.update || [];
    for (let i = 0, iLen = subs.length; i < iLen; i++) {
      const sub = subs[i];
      const shouldCallback = sub.owner ? sub.owner.__owl__.isMounted : true;
      if (shouldCallback) {
        const render = sub.callback.call(sub.owner, rev);
        scheduler.flush();
        await render;
      }
    }
  }
}

/**
 * The`useContext` hook is the normal way for a component to register themselve
 * to context state changes. The `useContext` method returns the context state
 */
export function useContext(ctx: Context): any {
  const component: Component<any, any> = Component.current!;
  return useContextWithCB(ctx, component, component.render.bind(component));
}

export function useContextWithCB(ctx: Context, component: Component<any, any>, method): any {
  const __owl__ = component.__owl__;
  const id = __owl__.id;
  const mapping = ctx.mapping;
  if (id in mapping) {
    return ctx.state;
  }
  if (!__owl__.observer) {
    __owl__.observer = new Observer();
    __owl__.observer.notifyCB = component.render.bind(component);
  }
  const currentCB = __owl__.observer.notifyCB;
  __owl__.observer.notifyCB = function() {
    if (ctx.rev > mapping[id]) {
      // in this case, the context has been updated since we were rendering
      // last, and we do not need to render here with the observer. A
      // rendering is coming anyway, with the correct props.
      return;
    }
    currentCB();
  };

  mapping[id] = 0;
  const renderFn = __owl__.renderFn;
  __owl__.renderFn = function(comp, params) {
    mapping[id] = ctx.rev;
    return renderFn(comp, params);
  };
  ctx.on("update", component, async contextRev => {
    if (mapping[id] < contextRev) {
      mapping[id] = contextRev;
      await method();
    }
  });
  onWillUnmount(() => {
    ctx.off("update", component);
    delete mapping[id];
  });
  return ctx.state;
}
