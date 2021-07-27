import { Component } from "../component";
import type { OwlNode } from "../owl_node";
import { xml } from "../tags";

export class Memo extends Component {
  static template = xml`<t t-slot="default"/>`;

  constructor(props: any, env: any, node: OwlNode) {
    super(props, env, node);
    let bdom: any = null;
    let prevProps = props;
    const component = this;
    let applyPatch = false;
    // note: no error handling here. todo: check _render function and make
    // sure it still works
    node._render = function (fiber: any) {
      if (!bdom) {
        // initial render
        bdom = this.renderFn();
        const patchFn = bdom!.patch;
        bdom!.patch = (other: any) => {
          if (applyPatch) {
            patchFn.call(bdom, other);
            applyPatch = false;
          }
        };
        fiber.bdom = bdom;
        fiber.root.counter--;
      } else {
        // other renders
        const shouldUpdate = !shallowEqual(prevProps, component.props);
        if (shouldUpdate) {
          applyPatch = true;
          prevProps = component.props;
          fiber.bdom = this.renderFn();
        } else {
          fiber.bdom = bdom;
        }
        fiber.root.counter--;
      }
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
