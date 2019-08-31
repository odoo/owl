import { RouterEnv } from "./Router";

export function makeDirective(env: RouterEnv) {
  return {
    name: "routecomponent",
    priority: 13,
    atNodeEncounter({ node }): boolean {
      let first = true;
      const router = env.router;
      for (let name of router.routeIds) {
        const route = router.routes[name];
        if (route.component) {
          // make new t t-component element
          const comp = node.ownerDocument.createElement("t");
          comp.setAttribute("t-component", "__component__" + route.name);
          comp.setAttribute(
            first ? "t-if" : "t-elif",
            `env.router.currentRouteName === '${route.name}'`
          );
          first = false;
          for (let param of route.params) {
            comp.setAttribute(param, `env.router.currentParams.${param}`);
          }
          node.appendChild(comp);
        }
      }
      node.removeAttribute("t-routecomponent");
      return false;
    }
  };
}
