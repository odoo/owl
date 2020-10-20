import { QWeb } from "./qweb/index";

/**
 * This file creates and exports the OWL 'config' object, with keys:
 *  - 'mode': 'prod' or 'dev',
 *  - 'env': the environment to use in root components.
 */

interface Config {
  mode: string;
  enableTransitions: boolean;
}

export const config = {} as Config;

Object.defineProperty(config, "mode", {
  get() {
    return QWeb.dev ? "dev" : "prod";
  },
  set(mode: string) {
    QWeb.dev = mode === "dev";
    if (QWeb.dev) {
      const url = `https://github.com/odoo/owl/blob/master/doc/reference/config.md#mode`;
      console.warn(
        `Owl is running in 'dev' mode.  This is not suitable for production use. See ${url} for more information.`
      );
    } else {
      console.log(`Owl is now running in 'prod' mode.`);
    }
  },
});

Object.defineProperty(config, "enableTransitions", {
  get() {
    return QWeb.enableTransitions;
  },
  set(value: boolean) {
    QWeb.enableTransitions = value;
  },
});
