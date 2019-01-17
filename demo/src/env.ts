import { Env } from "../../src/core/widget";
import QWeb from "../../src/core/qweb_vdom";

const qweb = new QWeb();

const env: Env = {
  qweb: qweb,
  services: {}
};

export default env;
