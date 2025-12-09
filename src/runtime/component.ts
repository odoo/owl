import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

interface StaticComponentProperties {
  template: string;
  defaultProps?: any;
  components?: { [componentName: string]: ComponentConstructor };
}

export interface ComponentConstructor extends StaticComponentProperties {
  new (node: ComponentNode): Component;
}

export class Component {
  static template: string = "";
  static defaultProps?: any;

  __owl__: ComponentNode;

  constructor(node: ComponentNode) {
    this.__owl__ = node;
  }

  setup() {}

  render(deep: boolean = false) {
    this.__owl__.render(deep === true);
  }
}
