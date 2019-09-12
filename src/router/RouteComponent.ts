import { Component } from "../component/component";
import { xml } from "../tags";

export class RouteComponent extends Component<any, {}, {}> {
  static template = xml`
    <t t-foreach="routes" t-as="route">
        <t t-if="env.router.currentRouteName === route.name">
            <t t-component="{{route.component}}" t-props="env.router.currentParams"/>
        </t>
    </t>
  `;

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
