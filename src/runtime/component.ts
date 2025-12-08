import type { ComponentNode } from "./component_node";

// -----------------------------------------------------------------------------
//  Component Class
// -----------------------------------------------------------------------------

export type Props = { [key: string]: any };

interface StaticComponentProperties {
  template: string;
  defaultProps?: any;
  components?: { [componentName: string]: ComponentConstructor };
}

export interface ComponentConstructor<P extends Props = any, E = any>
  extends StaticComponentProperties {
  new (env: E, node: ComponentNode): Component<P, E>;
}

export class Component<Props = any, Env = any> {
  static template: string = "";
  static defaultProps?: any;

  __props: Props = {} as any; // TODO: remove. it's just to keep types for now
  env: Env;
  __owl__: ComponentNode;

  constructor(env: Env, node: ComponentNode) {
    this.env = env;
    this.__owl__ = node;
  }

  setup() {}

  render(deep: boolean = false) {
    this.__owl__.render(deep === true);
  }
}
