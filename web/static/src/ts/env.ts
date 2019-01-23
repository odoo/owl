import QWeb from "./core/qweb_vdom";
import { WEnv } from "./core/widget";
import actions, { Action } from "./services/actions";
import ActionManager from "./services/action_manager";
import Ajax from "./services/ajax";
import Router from "./services/router";

export interface Env extends WEnv {
  actionManager: ActionManager;
  actions: Action[];
  ajax: Ajax;
  router: Router;
}

export function makeEnvironment(): Env {
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax();
  const actionManager = new ActionManager();

  return {
    qweb,
    ajax,
    router,
    actionManager,
    actions
  };
}
