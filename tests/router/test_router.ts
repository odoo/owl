import { Router, Route, RouterEnv } from "../../src/router/router";
import { makeTestEnv } from "../helpers";
import { QWeb } from "../../src/qweb/index";

export class TestRouter extends Router {
  destroy() {
    window.removeEventListener("popstate", (this as any)._listener);

    // remove component defined inroutes
    for (let key in QWeb.components) {
      if (key.startsWith("__component__")) {
        delete QWeb.components[key];
      }
    }
  }
}

export function getRouteParams(route: Partial<Route>, path: string) {
  const env = <RouterEnv>makeTestEnv();
  const router = new TestRouter(env, [route])
  const {routeIds: [routeId], routes} = router;
  return router["getRouteParams"](routes[routeId], path);
}
