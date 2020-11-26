import { Component } from "./component/component";
import { scheduler } from "./component/scheduler";
import { EventBus } from "./core/event_bus";
import { Observer } from "./core/observer";

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

function partitionBy<T>(arr: T[], fn: (t: T) => boolean) {
  let lastGroup: T[] | false = false;
  let lastValue;
  return arr.reduce((acc: T[][], cur) => {
    let curVal = fn(cur);
    if (lastGroup) {
      if (curVal === lastValue) {
        lastGroup.push(cur);
      } else {
        lastGroup = false;
      }
    }
    if (!lastGroup) {
      lastGroup = [cur];
      acc.push(lastGroup);
    }
    lastValue = curVal;
    return acc;
  }, []);
}

export class Context extends EventBus {
  state: any;
  observer: Observer;
  rev: number = 1;
  // mapping from component id to last observed context id
  mapping: { [componentId: number]: number } = {};

  constructor(state: Object = {}) {
    super();
    this.observer = new Observer();
    this.observer.notifyCB = () => {
      // notify components in the next microtask tick to ensure that subscribers
      // are notified only once for all changes that occur in the same micro tick
      let rev = this.rev;
      return Promise.resolve().then(() => {
        if (rev === this.rev) {
          this.__notifyComponents();
        }
      });
    };
    this.state = this.observer.observe(state);
    this.subscriptions.update = [];
  }

  /**
   * Instead of using trigger to emit an update event, we actually implement
   * our own function to do that.  The reason is that we need to be smarter than
   * a simple trigger function: we need to wait for parent components to be
   * done before doing children components.  More precisely, if an update
   * as an effect of destroying a children, we do not want to call any code
   * from the child, and certainly not render it.
   *
   * This method implements a simple grouping algorithm by depth. If we have
   * connected components of depths [2, 4,4,4,4, 3,8,8], the Context will notify
   * them in the following groups: [2], [4,4,4,4], [3], [8,8]. Each group will
   * be updated sequentially, but each components in a given group will be done in
   * parallel.
   *
   * This is a very simple algorithm, but it avoids checking if a given
   * component is a child of another.
   */
  async __notifyComponents() {
    const rev = ++this.rev;
    const subscriptions = this.subscriptions.update;
    const groups = partitionBy(subscriptions, (s) => (s.owner ? s.owner.__owl__.depth : -1));
    for (let group of groups) {
      const proms = group.map((sub) => sub.callback.call(sub.owner, rev));
      // at this point, each component in the current group has registered a
      // top level fiber in the scheduler. It could happen that rendering these
      // components is done (if they have no children).  This is why we manually
      // flush the scheduler.  This will force the scheduler to check
      // immediately if they are done, which will cause their rendering
      // promise to resolve earlier, which means that there is a chance of
      // processing the next group in the same frame.
      scheduler.flush();
      await Promise.all(proms);
    }
  }
}

/**
 * The`useContext` hook is the normal way for a component to register themselve
 * to context state changes. The `useContext` method returns the context state
 */
export function useContext(ctx: Context): any {
  const component: Component = Component.current!;
  return useContextWithCB(ctx, component, component.render.bind(component));
}

export function useContextWithCB(ctx: Context, component: Component, method): any {
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
  __owl__.observer.notifyCB = function () {
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
  __owl__.renderFn = function (comp, params) {
    mapping[id] = ctx.rev;
    return renderFn(comp, params);
  };
  ctx.on("update", component, async (contextRev) => {
    if (mapping[id] < contextRev) {
      mapping[id] = contextRev;
      await method();
    }
  });
  const __destroy = component.__destroy;
  component.__destroy = (parent) => {
    ctx.off("update", component);
    delete mapping[id];
    __destroy.call(component, parent);
  };
  return ctx.state;
}
