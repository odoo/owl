import { Component, portalSymbol } from "../component/component";
import { VNode, patch } from "../vdom/index";
import { xml } from "../tags";
import { OwlEvent } from "../core/owl_event";
import { useSubEnv } from "../hooks";

/**
 * Portal
 *
 * The Portal component allows to render a part of a component outside it's DOM.
 * It is for example useful for dialogs: for css reasons, dialogs are in general
 * placed in a specific spot of the DOM (e.g. directly in the body). With the
 * Portal, a component can conditionally specify in its tempate that it contains
 * a dialog, and where this dialog should be inserted in the DOM.
 *
 * The Portal component ensures that the communication between the content of
 * the Portal and its parent properly works: business events reaching the Portal
 * are re-triggered on an empty <portal> node located in the parent's DOM.
 */

interface Props {
  target: string;
}

export class Portal extends Component<Props> {
  static template = xml`<portal><t t-slot="default"/></portal>`;
  static props = {
    target: {
      type: String
    }
  };

  // boolean to indicate whether or not we must listen to 'dom-appended' event
  // to hook on the moment when the target is inserted into the DOM (because it
  // is not when the portal is rendered)
  doTargetLookUp: boolean = true;
  // set of encountered events that need to be redirected
  _handledEvents: Set<string> = new Set();
  // function that will be the event's tunnel (needs to be an arrow function to
  // avoid having to rebind `this`)
  _handlerTunnel: (f: OwlEvent<any>) => void = (ev: OwlEvent<any>) => {
    ev.stopPropagation();
    this.__trigger(ev.originalComponent, ev.type, ev.detail);
  };
  // Storing the parent's env
  parentEnv: any = null;
  // represents the element that is moved somewhere else
  portal: VNode | null = null;
  // the target where we will move `portal`
  target: Element | null = null;

  constructor(parent, props) {
    super(parent, props);
    this.parentEnv = parent ? parent.env : {};
    // put a callback in the env that is propagated to children s.t. portal can
    // register an handler to those events just before children will trigger them
    useSubEnv({
      [portalSymbol]: ev => {
        if (!this._handledEvents.has(ev.type)) {
          this.portal!.elm!.addEventListener(ev.type, this._handlerTunnel);
          this._handledEvents.add(ev.type);
        }
      }
    });
  }
  /**
   * Override to revert back to a classic Component's structure
   *
   * @override
   */
  __callWillUnmount() {
    super.__callWillUnmount();
    this.el!.appendChild(this.portal!.elm!);
    this.doTargetLookUp = true;
  }
  /**
   * At each DOM change, we must ensure that the portal contains exactly one
   * child
   */
  __checkVNodeStructure(vnode: VNode) {
    const children = vnode.children!;
    let countRealNodes = 0;
    for (let child of children) {
      if ((child as VNode).sel) {
        countRealNodes++;
      }
    }
    if (countRealNodes !== 1) {
      throw new Error(`Portal must have exactly one non-text child (has ${countRealNodes})`);
    }
  }
  /**
   * Ensure the target is still there at whichever time we render
   */
  __checkTargetPresence() {
    if (!this.target || !document.contains(this.target)) {
      throw new Error(`Could not find any match for "${this.props.target}"`);
    }
  }
  /**
   * Move the portal's element to the target
   */
  __deployPortal() {
    this.__checkTargetPresence();
    this.target!.appendChild(this.portal!.elm!);
  }
  /**
   * Override to remove from the DOM the element we have teleported
   *
   * @override
   */
  __destroy(parent) {
    if (this.portal && this.portal.elm) {
      const displacedElm = this.portal.elm!;
      const parent = displacedElm.parentNode;
      if (parent) {
        parent.removeChild(displacedElm);
      }
    }
    super.__destroy(parent);
  }
  /**
   * Override to patch the element that has been teleported
   *
   * @override
   */
  __patch(target, vnode) {
    if (this.doTargetLookUp) {
      const target = document.querySelector(this.props.target);
      if (!target) {
        this.env.qweb.on("dom-appended", this, () => {
          this.doTargetLookUp = false;
          this.env.qweb.off("dom-appended", this);
          this.target = document.querySelector(this.props.target);
          this.__deployPortal();
        });
      } else {
        this.doTargetLookUp = false;
        this.target = target;
      }
    }
    this.__checkVNodeStructure(vnode);
    const shouldDeploy =
      (!this.portal || this.el!.contains(this.portal.elm!)) && !this.doTargetLookUp;

    if (!this.doTargetLookUp && !shouldDeploy) {
      // Only on pure patching, provided the
      // this.target's parent has not been unmounted
      this.__checkTargetPresence();
    }

    const portalPatch = this.portal ? this.portal : document.createElement(vnode.children[0].sel);
    this.portal = patch(portalPatch, vnode.children![0] as VNode);
    vnode.children = [];

    super.__patch(target, vnode);

    if (shouldDeploy) {
      this.__deployPortal();
    }
  }
  /**
   * Override to set the env
   */
  __trigger(component: Component, eventType: string, payload?: any) {
    const env = this.env;
    this.env = this.parentEnv;
    super.__trigger(component, eventType, payload);
    this.env = env;
  }
}
