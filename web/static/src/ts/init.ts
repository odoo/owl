import { Ajax } from "./store/ajax";
import { NotificationManager } from "./core/notifications";
import { QWeb } from "./core/qweb_vdom";
import { Router } from "./core/router";
import { findInTree, idGenerator, memoize } from "./core/utils";
import { actionRegistry } from "./registries";
import { ActionManager } from "./store/action_manager";
import { MenuInfo, MenuItem } from "./widgets/root";
import { Env } from "./widgets/widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface InitializedData {
  env: Env;
  menuInfo: MenuInfo;
}

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
export const init = memoize(async function(): Promise<InitializedData> {
  // services
  const qweb = new QWeb();
  const router = new Router();
  const ajax = new Ajax(ajaxFetch);
  const actionManager = new ActionManager(actionRegistry, ajax);
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

function ajaxFetch(route: string, params: any): Promise<any> {
  console.log("RPC", route, params);
  const delay = Math.random() * 150;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Load xml templates as a string.
 */
async function loadTemplates(): Promise<string> {
  const result = await fetch("templates.xml");
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  return result.text();
}

/**
 * Load all menu items
 */
function loadMenus(): MenuInfo {
  const menuItems: BaseMenuItem[] = (<any>window).odoo.menus;
  if (!menuItems) {
    throw new Error("Cannot find menus description");
  }
  const menuInfo = getMenuInfo(menuItems);
  delete (<any>window).odoo.menus; // overkill?
  return menuInfo;
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
  const menus: { [key: number]: MenuItem | undefined } = {};
  const actionMap: { [id: number]: MenuItem | undefined } = {};
  const roots: number[] = [];

  // build MenuItems
  for (let root of items) {
    roots.push(root.id);
    addToMap(root);
  }

  function addToMap(m: BaseMenuItem, app?: MenuItem): MenuItem {
    const item: Partial<MenuItem> = {
      id: m.id,
      name: m.name,
      parentId: m.parent_id,
      action: m.action,
      icon: m.icon,
      actionId: -1 // will be filled later on with correct id
    };
    item.app = app || (item as MenuItem);
    item.children = m.children.map(c => addToMap(c, item.app as MenuItem));
    menus[item.id!] = item as MenuItem;
    return item as MenuItem;
  }

  // add proper actionId to every menuitems
  for (let menuId in menus) {
    const menu = menus[menuId]!;
    let menuWithAction = menu && findInTree(menu, m => Boolean(m.action));
    if (menuWithAction) {
      menu.actionId = parseInt(
        (<string>menuWithAction.action).split(",")[1],
        10
      );
      if (menuWithAction === menu) {
        actionMap[menu.actionId] = menu;
      }
    }
  }

  return { menus, roots, actionMap };
}
