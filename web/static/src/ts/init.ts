import { Ajax } from "./core/ajax";
import { NotificationManager } from "./core/notifications";
import { QWeb } from "./core/qweb_vdom";
import { Router } from "./core/router";
import { findInTree, idGenerator, memoize } from "./core/utils";
import { actionRegistry } from "./registries";
import { ActionManager } from "./services/action_manager";
import { MenuInfo, MenuItem } from "./widgets/root";
import { Env } from "./widgets/widget";

interface InitializedData {
  env: Env;
  menuInfo: MenuInfo;
}

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
export const init = memoize(async function(): Promise<InitializedData> {
  // services
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax();
  const actionManager = new ActionManager(actionRegistry);
  const notifications = new NotificationManager();

  // templates
  const templates = await loadTemplates();
  qweb.addTemplate("default", "<div/>");
  qweb.loadTemplates(templates);

  const menuInfo = loadMenus();

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
  return { env, menuInfo };
});

//------------------------------------------------------------------------------
// Adapters
//------------------------------------------------------------------------------

function loadMenus(): MenuInfo {
  const menuItems: BaseMenuItem[] = (<any>window).odoo.menus;
  const menuInfo = getMenuInfo(menuItems);
  delete (<any>window).odoo.menus; // overkill?
  return menuInfo;
}

async function loadTemplates(): Promise<string> {
  const result = await fetch("templates.xml");
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  return result.text();
}

interface BaseMenuItem {
  id: number;
  name: string;
  parent_id: number | false;
  action: string | false;
  icon: string | false;
  children: BaseMenuItem[];
}

/**
 * Generate a valid MenuInfo object from a list of BaseMenuItems. This function
 * is supposed to be called once at startup.
 */
export function getMenuInfo(items: BaseMenuItem[]): MenuInfo {
  const menuMap: { [key: number]: MenuItem | undefined } = {};
  const actionMap: { [id: number]: number | undefined } = {};
  const roots: number[] = [];

  // build MenuItems
  for (let root of items) {
    roots.push(root.id);
    addToMap(root, root.id);
  }

  function addToMap(m: BaseMenuItem, appId: number): MenuItem {
    const item: MenuItem = {
      id: m.id,
      name: m.name,
      parentId: m.parent_id,
      action: m.action,
      icon: m.icon,
      appId: appId,
      actionId: -1, // will be filled later on with correct id
      children: m.children.map(c => addToMap(c, appId))
    };
    menuMap[item.id] = item;
    return item;
  }

  // add proper actionId to every menuitems
  for (let menuId in menuMap) {
    const menu = menuMap[menuId]!;
    let menuWithAction = menu && findInTree(menu, m => Boolean(m.action));
    if (menuWithAction) {
      menu.actionId = parseInt(
        (<string>menuWithAction.action).split(",")[1],
        10
      );
      if (menuWithAction === menu) {
        actionMap[menu.actionId] = menu.id;
      }
    }
  }

  return { menuMap, roots, actionMap };
}
