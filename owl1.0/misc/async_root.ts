import { Component } from "../component/component";
import { xml } from "../tags";

/**
 * AsyncRoot
 *
 * Owl is by default asynchronous, and the user interface will wait for all its
 * subcomponents to be rendered before updating the DOM. This is most of the
 * time what we want, but in some cases, it makes sense to "detach" a component
 * from this coordination.  This is the goal of the AsyncRoot component.
 */

export class AsyncRoot extends Component {
  static template = xml`<t t-slot="default"/>`;

  async __updateProps(nextProps, parentFiber) {
    this.render(parentFiber.force);
  }
}
