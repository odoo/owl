import { Component } from "./component/component";
import type { ComponentNode } from "./component/component_node";
import { xml } from "./tags";
import { Fiber } from "./component/fibers";

export class Memo extends Component {
  static template = xml`<t t-slot="default"/>`;

  constructor(props: any, env: any, node: ComponentNode) {
    super(props, env, node);

    // prevent patching process conditionally
    let applyPatch = false;
    const patchFn = node.patch;
    node.patch = () => {
      if (applyPatch) {
        patchFn.call(node);
        applyPatch = false;
      }
    };

    // check props change, and render/apply patch if it changed
    let prevProps = props;
    const updateAndRender = node.updateAndRender;
    node.updateAndRender = function (props: any, parentFiber: Fiber) {
      const shouldUpdate = !shallowEqual(prevProps, props);
      if (shouldUpdate) {
        prevProps = props;
        updateAndRender.call(node, props, parentFiber);
        applyPatch = true;
      }
      return Promise.resolve();
    };
  }
}

/**
 * we assume that each object have the same set of keys
 */
function shallowEqual(p1: any, p2: any): boolean {
  for (let k in p1) {
    if (p1[k] !== p2[k]) {
      return false;
    }
  }
  return true;
}
