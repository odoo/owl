import { Component } from "../component/component";
import { xml } from "../tags";
import { EnvWithRouter } from "./router";

export class RouteComponent extends Component<{}, EnvWithRouter> {
  static template = xml`
    <t>
        <t
            t-if="routeComponent"
            t-component="routeComponent"
            t-key="env.router.currentRouteName"
            t-props="env.router.currentParams" />
    </t>
  `;

  get routeComponent(): any {
    return this.env.router.currentRoute && this.env.router.currentRoute.component;
  }
}
