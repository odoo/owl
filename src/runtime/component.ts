import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

interface StaticComponentProperties {
  template: string;
  components?: { [componentName: string]: ComponentConstructor };
}

export interface ComponentConstructor extends StaticComponentProperties {
  new (node: ComponentNode): Component;
}

export class Component {
  static template: string = "";

  __owl__: ComponentNode;

  constructor(node: ComponentNode) {
    this.__owl__ = node;
  }

  setup() {}
}
