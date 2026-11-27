import {
  computed,
  getCurrentComputation,
  OwlError,
  ReactiveValue,
  setComputation,
  signal,
  Signal,
} from "@odoo/owl-core";
import type { ComponentHelpers } from "@odoo/owl-compiler";
import { BDom, multi, text, toggler } from "@odoo/owl-blockdom";
import { Component } from "../component";
import { ComponentNode } from "../component_node";
import { handleError } from "./error_handling";
import { Fiber, makeChildFiber } from "./fibers";

/**
 * This file contains the utility functions that compiled templates use to
 * render components and their slots. An App gives them to its template set.
 */

const ObjectCreate = Object.create;

function callSlot(
  ctx: any,
  parent: any,
  key: string,
  name: string,
  dynamic: boolean,
  extra: any,
  defaultContent?: (ctx: any, node: any, key: string) => BDom
): BDom {
  key = key + "__slot_" + name;
  const slots = ctx.__owl__.props.slots || {};
  const { __render, __ctx, __scope } = slots[name] || {};
  const slotScope = ObjectCreate(__ctx || {});
  if (__scope) {
    slotScope[__scope] = extra;
  }
  const slotBDom = __render ? __render(slotScope, parent, key) : null;
  if (defaultContent) {
    let child1: BDom | undefined = undefined;
    let child2: BDom | undefined = undefined;
    if (slotBDom) {
      child1 = dynamic ? toggler(name, slotBDom) : slotBDom;
    } else {
      child2 = defaultContent(ctx, parent, key);
    }
    return multi([child1, child2]);
  }
  return slotBDom || text("");
}

type CachedSignal<T> = Signal<T> & { readonly: ReactiveValue<T> };

const signalCaches = new WeakMap<ComponentNode, Map<string, CachedSignal<any>>>();

function toSignal(node: ComponentNode, cacheKey: string, value: any): ReactiveValue<any> {
  let cache = signalCaches.get(node);
  if (!cache) {
    cache = new Map();
    signalCaches.set(node, cache);
  }
  const existing = cache.get(cacheKey);
  if (existing) {
    existing.set(value);
    return existing.readonly;
  }
  const s = signal(value) as CachedSignal<any>;
  s.readonly = computed(s);
  cache.set(cacheKey, s);
  return s.readonly;
}

function createComponent<P extends Record<string, any>>(
  name: string | null,
  isStatic: boolean,
  hasSlotsProp: boolean,
  hasDynamicPropList: boolean,
  propList: string[]
) {
  const isDynamic = !isStatic;
  let arePropsDifferent: (p1: P, p2: P) => boolean;
  const hasNoProp = propList.length === 0;
  if (hasSlotsProp) {
    arePropsDifferent = (_1, _2) => true;
  } else if (hasDynamicPropList) {
    arePropsDifferent = function (props1: P, props2: P) {
      for (let k in props1) {
        if (props1[k] !== props2[k]) {
          return true;
        }
      }
      return Object.keys(props1).length !== Object.keys(props2).length;
    };
  } else if (hasNoProp) {
    arePropsDifferent = (_1: any, _2: any) => false;
  } else {
    arePropsDifferent = function (props1: P, props2: P) {
      for (let p of propList) {
        if (props1[p] !== props2[p]) {
          return true;
        }
      }
      return false;
    };
  }

  const initiateRender = ComponentNode.prototype.initiateRender;

  return (props: P, key: string, ctx: ComponentNode, parent: any, C: any) => {
    let children = ctx.children;
    let node: any = children[key];
    if (isDynamic && node && node.component.constructor !== C) {
      node = undefined;
    }
    const parentFiber = ctx.fiber!;
    if (node) {
      if (arePropsDifferent(node.props, props) || parentFiber.deep || node.forceNextRender) {
        node.forceNextRender = false;
        const hooks = node.willUpdateProps;
        const fiber = makeChildFiber(node, parentFiber);
        node.fiber = fiber;
        const parentRoot = parentFiber.root!;
        if (node.willPatch.length) parentRoot.willPatch.push(fiber);
        if (node.patched.length) parentRoot.patched.push(fiber);
        let promises: Promise<any>[] | undefined;
        if (hooks.length) {
          // Defaults must reach the hooks but must NOT be stored on node.props:
          // otherwise the next arePropsDifferent call sees ghost diffs on default
          // keys and re-renders on every parent render. Consumers (`props.static`/`props`)
          // already resolve defaults lazily from raw node.props.
          let nextProps = props;
          const defaultProps = node.defaultProps;
          if (defaultProps) {
            nextProps = Object.assign({}, props) as P;
            for (const k in defaultProps) {
              if ((nextProps as any)[k] === undefined) {
                (nextProps as any)[k] = defaultProps[k];
              }
            }
          }
          const component = node.component;
          const prev = getCurrentComputation();
          setComputation(undefined);
          for (const f of hooks) {
            const r = f.call(component, nextProps);
            if (r && typeof r.then === "function") {
              (promises ||= []).push(r);
            }
          }
          setComputation(prev);
        }
        if (promises) {
          const p = promises.length === 1 ? promises[0] : Promise.all(promises);
          p.then(
            () => {
              if (fiber !== node.fiber) return;
              node.props = props;
              for (const f of node.propsUpdated) f();
              fiber.render();
            },
            (error) => {
              handleError({ node, error });
            }
          );
        } else {
          node.props = props;
          for (const f of node.propsUpdated) f();
          fiber.render();
        }
      }
    } else {
      // new component
      if (isStatic) {
        const components = parent.constructor.components;
        if (!components) {
          throw new OwlError(
            `Cannot find the definition of component "${name}", missing static components key in parent`
          );
        }
        C = components[name as any];
        if (!C) {
          throw new OwlError(`Cannot find the definition of component "${name}"`);
        } else if (!(C.prototype instanceof Component)) {
          throw new OwlError(
            `"${name}" is not a Component. It must inherit from the Component class`
          );
        }
      }
      node = new ComponentNode(C, props, ctx.app, ctx.pluginManager, ctx, key);
      children[key] = node;
      const fiber = new Fiber(node, parentFiber);
      if (node.willStart.length) {
        initiateRender.call(node, fiber);
      } else {
        node.fiber = fiber;
        if (node.mounted.length) {
          fiber.root!.mounted.push(fiber);
        }
        fiber.render();
      }
    }
    parentFiber.childrenMap[key] = node;
    return node;
  };
}

// Implements the part of the contract that compiled templates rely on for
// components.
export const componentHelpers = {
  callSlot,
  createComponent,
  toSignal,
} satisfies ComponentHelpers;
