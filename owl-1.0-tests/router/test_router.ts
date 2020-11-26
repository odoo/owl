import { Router } from "../../src/router/router";
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
