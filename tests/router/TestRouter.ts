import { Router } from "../../src/router/Router";
import { QWeb } from "../../src/qweb/index";

export class TestRouter extends Router {
  destroy() {
    window.removeEventListener("popstate", this.checkAndUpdateRoute);
    delete QWeb.DIRECTIVE_NAMES.routecomponent;
    QWeb.DIRECTIVES = QWeb.DIRECTIVES.filter(d => d.name !== "routecomponent");

    // remove component defined inroutes
    for (let key in QWeb.components) {
      if (key.startsWith("__component__")) {
        delete QWeb.components[key];
      }
    }
  }
}
