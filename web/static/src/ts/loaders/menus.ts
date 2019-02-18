import { findInTree } from "../core/utils";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface MenuItem {
  id: number;
  name: string;
  parentId: number | false;
  action: string | false;
  icon: string | false;

  // root menu id
  app: MenuItem;
  actionId: number;
  children: MenuItem[];
}

export interface MenuInfo {
  menus: { [key: number]: MenuItem | undefined };

  actionMap: { [id: number]: MenuItem | undefined };
  roots: number[];
}

interface BaseMenuItem {
  id: number;
  name: string;
  parent_id: number | false;
  action: string | false;
  icon: string | false;
  children: BaseMenuItem[];
}

//------------------------------------------------------------------------------
// Code
//------------------------------------------------------------------------------

/**
 * Load all menu items
 */
export function loadMenus(): MenuInfo {
  const menuItems: BaseMenuItem[] = (<any>window).odoo.menus;
  if (!menuItems) {
    throw new Error("Cannot find menus description");
  }
  const menuInfo = getMenuInfo(menuItems);
  delete (<any>window).odoo.menus; // overkill?
  return menuInfo;
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
