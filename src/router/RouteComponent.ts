import { Component } from "../component/component";

export const ROUTE_COMPONENT_TEMPLATE_NAME = "__owl__-router-component";
export const ROUTE_COMPONENT_TEMPLATE = `
    <t t-foreach="routes" t-as="route">
        <t t-if="env.router.currentRouteName === route.name">
            <t t-component="{{route.component}}" t-props="env.router.currentParams"/>
        </t>
    </t>`;

export class RouteComponent extends Component<any, {}, {}> {
  template = ROUTE_COMPONENT_TEMPLATE_NAME;
  routes: any[] = [];
  constructor(parent, props) {
    super(parent, props);
    const router = this.env.router;
    for (let name of router.routeIds) {
      const route = router.routes[name];
      if (route.component) {
        this.routes.push({
          name: route.name,
          component: "__component__" + route.name
        });
      }
    }
  }
}
