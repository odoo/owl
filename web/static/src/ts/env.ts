import { QWeb } from "./core/qweb_vdom";
import { WEnv } from "./core/widget";
import { ActionManager } from "./services/action_manager";
import { Ajax } from "./services/ajax";
import { Router } from "./services/router";

export interface Menu {
  title: string;
  actionID: number;
}

export interface Env extends WEnv {
  actionManager: ActionManager;
  ajax: Ajax;
  router: Router;
  menus: Menu[];
}

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
    qweb,
    ajax,
    router,
    actionManager,
    menus
  };
}
