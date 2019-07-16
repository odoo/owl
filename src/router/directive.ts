import { RouterEnv } from "./plugin";

export function makeDirective(env: RouterEnv) {
  return {
    name: "routecomponent",
    priority: 13,
    atNodeEncounter({ node }): boolean {
      let first = true;
      const info = env.router.info;
      for (let name of info.routeIds) {
        const route = info.routes[name];
        if (route.component) {
          // make new t t-component element
          const comp = node.ownerDocument.createElement("t");
          comp.setAttribute("t-component", "__component__" + route.name);
          comp.setAttribute(first ? "t-if" : "t-elif", `env.router.routeName === '${route.name}'`);
          first = false;
          for (let param of route.params) {
            comp.setAttribute(param, `env.router.routeParams.${param}`);
          }
          node.appendChild(comp);
        }
      }
      node.removeAttribute("t-routecomponent");
      return false;
    }
  };
}
