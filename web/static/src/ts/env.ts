import { WEnv } from "./core/component";
import { QWeb } from "./core/qweb_vdom";
import { Registry } from "./core/registry";
import { idGenerator, memoize } from "./core/utils";
import { TemplateLoader } from "./loaders/templates";
import { actionRegistry } from "./registries";
import { RPC } from "./services/ajax";
import {
  ActionManager,
  ActionWidget,
  IActionManager
} from "./store/action_manager";
import { Ajax, IAjax } from "./store/ajax";
import {
  INotificationManager,
  NotificationManager
} from "./store/notifications";
import { IRouter, Router } from "./store/router";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Env extends WEnv {
  // services
  actionManager: IActionManager;
  ajax: IAjax;
  notifications: INotificationManager;
  router: IRouter;

  // registries
  actionRegistry: Registry<ActionWidget>;

  // helpers
  rpc: IAjax["rpc"];

  // configuration
  debug: boolean;
  isMobile: boolean;
}

interface Loaders {
  loadTemplates: TemplateLoader;
}

interface Services {
  rpc: RPC;
}

type EnvBuilder = (loaders: Loaders, services: Services) => Promise<Env>;
//------------------------------------------------------------------------------
// Environment
//------------------------------------------------------------------------------

/**
 * init returns the main environment for the application.
 *
 * Note that it does not make much sense (except for tests) to have more than
 * one environment. For example, with two environment, the router code in one
 * environment will probably interfere with the code from the other environment.
 *
 * For this reason, the result of init is memoized: every call to
 * this function will actually return the same environment.
 */
export const makeEnv: EnvBuilder = memoize(_makeEnv);

async function _makeEnv(loaders: Loaders, services: Services): Promise<Env> {
  // services
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax(services.rpc);
  const actionManager = new ActionManager(actionRegistry, ajax);
  const notifications = new NotificationManager();

  // templates
  const templates = await loaders.loadTemplates();
  qweb.addTemplate("default", "<div/>");
  qweb.loadTemplates(templates);

  const env: Env = {
    // Base widget requirements
    qweb,
    getID: idGenerator(),

    actionManager,
    ajax,
    notifications,
    actionRegistry,
    router,

    rpc: ajax.rpc,

    debug: false,
    isMobile: window.innerWidth <= 768
  };
  return env;
}
