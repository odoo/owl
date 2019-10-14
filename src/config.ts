import { QWeb } from "./qweb/index";
import { Env } from "./component/component";

/**
 * This file creates and exports the OWL 'config' object, with keys:
 *  - 'mode': 'prod' or 'dev',
 *  - 'env': the environment to use in root components.
 */

interface Config {
  env: Env;
  mode: string;
}

export const config = {} as Config;

Object.defineProperty(config, "mode", {
  get() {
    return QWeb.dev ? "dev" : "prod";
  },
  set(mode: string) {
    QWeb.dev = mode === "dev";
    if (QWeb.dev) {
      const url = `https://github.com/odoo/owl/blob/master/doc/tooling.md#development-mode`;
      console.warn(
        `Owl is running in 'dev' mode.  This is not suitable for production use. See ${url} for more information.`
      );
    } else {
      console.log(`Owl is now running in 'prod' mode.`);
    }
  },
});

let env:Env;
Object.defineProperty(config, "env", {
  get() {
    if (!env) {
      env = {} as Env;
    }
    if (!env.qweb) {
      env.qweb = new QWeb();
    }
    return env;
  },
  set(newEnv: Env) {
    env = newEnv;
  },
});
