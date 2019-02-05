import { Ajax } from "./core/ajax";
import { NotificationManager } from "./core/notifications";
import { QWeb } from "./core/qweb_vdom";
import { Router } from "./core/router";
import { idGenerator, memoize } from "./core/utils";
import { actionRegistry } from "./registries";
import { ActionManager } from "./services/action_manager";
import { Env } from "./widgets/widget";

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
  // services
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax();
  const actionManager = new ActionManager(actionRegistry);
  const notifications = new NotificationManager();

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
    actionRegistry,
    router,

    rpc: ajax.rpc,

    debug: false,
    isMobile: window.innerWidth <= 768
  };
});
