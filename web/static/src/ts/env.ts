import { QWeb } from "./core/qweb_vdom";
import { idGenerator } from "./core/utils";
import { WEnv } from "./core/widget";
import { ActionManager, IActionManager } from "./services/action_manager";
import { Ajax, IAjax } from "./services/ajax";
import { IRouter, Router } from "./services/router";

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
  router: IRouter;
  menus: Menu[];

  // helpers
  rpc: IAjax["rpc"];

  // configuration
  debug: boolean;
}

//------------------------------------------------------------------------------
// Code
//------------------------------------------------------------------------------

export function makeEnvironment(): Env {
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax();
  const actionManager = new ActionManager(router);
  const menus = [
    { title: "Discuss", actionID: 1 },
    { title: "CRM", actionID: 2 }
  ];

  return {
    // Base widget requirements
    qweb,
    getID: idGenerator(),

    ajax,
    router,
    actionManager,
    menus,

    rpc: ajax.rpc,
    debug: false
  };
}
