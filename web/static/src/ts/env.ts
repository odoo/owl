import { QWeb } from "./core/qweb_vdom";
import { idGenerator, memoize } from "./core/utils";
import { WEnv } from "./core/widget";
import { ActionManager, IActionManager } from "./services/action_manager";
import { Ajax, IAjax } from "./services/ajax";
import {
  INotificationManager,
  NotificationManager
} from "./services/notifications";
import { registry, Registry } from "./services/registry";
import { IRouter, Router } from "./services/router";
import { CRM } from "./widgets/crm";
import { Discuss } from "./widgets/discuss";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Menu {
  title: string;
  actionID: number;
}

export interface Env extends WEnv {
  // services
  actionManager: IActionManager;
  ajax: IAjax;
  notifications: INotificationManager;
  registry: Registry;
  router: IRouter;

  // data
  menus: Menu[];

  // helpers
  rpc: IAjax["rpc"];

  // configuration
  debug: boolean;
  isMobile: boolean;
}

//------------------------------------------------------------------------------
// Code
//------------------------------------------------------------------------------

/**
 * makeEnvironment returns the main environment for the application.
 *
 * Note that it does not make much sense (except for tests) to have more than
 * one environment. For example, with two environment, the router code in one
 * environment will probably interfere with the code from the other environment.
 *
 * For this reason, the result of makeEnvironment is memoized: every call to
 * this function will actually return the same environment.
 */
export const makeEnvironment = memoize(async function(): Promise<Env> {
  // main application registry
  registry.add("action", "discuss", Discuss);
  registry.add("action", "crm", CRM);

  // services
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax();
  const actionManager = new ActionManager(router, registry);
  const notifications = new NotificationManager();

  // demo data
  const menus = [
    { title: "Discuss", actionID: 1 },
    { title: "CRM", actionID: 2 }
  ];

  // templates
  const result = await fetch("templates.xml");
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  const templates = await result.text();
  qweb.addTemplate("default", "<div/>");
  qweb.loadTemplates(templates);

  return {
    // Base widget requirements
    qweb,
    getID: idGenerator(),

    actionManager,
    ajax,
    notifications,
    registry,
    router,

    menus,

    rpc: ajax.rpc,

    debug: false,
    isMobile: window.innerWidth <= 768
  };
});
