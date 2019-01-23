import QWeb from "./core/qweb_vdom";
import Router from "./services/router";
import actions from "./services/actions";
import { Env } from "./types";

const env: Env = {
  qweb: new QWeb(),
  router: new Router(),
  services: { actions }
};

export default env;
