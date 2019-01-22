import { Env } from "./core/Widget";
import QWeb from "./core/qweb_vdom";
import Router from "./services/router";
import actions from "./services/actions";

const qweb = new QWeb();
const router = new Router();

const env: Env = {
  qweb: qweb,
  services: { router, actions }
};

export default env;
