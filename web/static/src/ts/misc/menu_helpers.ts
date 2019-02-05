import { findInTree } from "../core/utils";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface BaseMenuItem {
  id: number;
  name: string;
  parent_id: number | false;
  action: string | false;
  icon: string | false;
  children: BaseMenuItem[];
}

export interface MenuItem extends BaseMenuItem {
  // root menu id
  menuId: number;
  actionId: number;
  children: MenuItem[];
}

export interface MenuInfo {
  menuMap: { [key: number]: MenuItem | undefined };
  roots: number[];
}

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Generate a valid MenuInfo object from a list of BaseMenuItems. This function
 * is supposed to be called once at startup.
 */
export function processMenuItems(items: BaseMenuItem[]): MenuInfo {
  const menuMap: MenuInfo["menuMap"] = {};
  const roots: number[] = [];

  // build MenuItems
  for (let root of items) {
    roots.push(root.id);
    addToMap(root, root.id);
  }

  function addToMap(m: BaseMenuItem, menuId: number): MenuItem {
    let item: MenuItem = Object.assign({ menuId, actionId: -1 }, <MenuItem>m);
    menuMap[item.id] = item;
    item.children = m.children.map(c => addToMap(c, menuId));
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
    }
  }

  return { menuMap, roots };
}

export function getAppAndAction(
  info: MenuInfo,
  query: { menu_id?: string; action_id?: string }
): { app: MenuItem | null; actionId: number | null } {
  let app = findApp(info, query.menu_id, query.action_id);
  let actionId = findAction(info, query.menu_id, query.action_id);

  return { app, actionId };
}

function findApp(
  info: MenuInfo,
  menu_id?: string,
  action_id?: string
): MenuItem | null {
  if (menu_id) {
    const menuID = parseInt(menu_id, 10);
    if (info.roots.indexOf(menuID) > -1) {
      const menu = info.menuMap[menuID];
      if (menu) {
        return menu;
      }
    }
  }
  if (action_id) {
    for (let itemID in info.menuMap) {
      let menu = info.menuMap[itemID];
      const actionId = menu && menu.actionId;
      if (actionId && String(actionId) === action_id) {
        if (menu) {
          let topMenu = info.menuMap[menu.menuId];
          if (topMenu) {
            return topMenu;
          }
        }
      }
    }
  }
  return null;
}

function findAction(
  info: MenuInfo,
  menu_id?: string,
  action_id?: string
): number | null {
  if (action_id) {
    return parseInt(action_id, 10);
  }
  if (menu_id) {
    const menuID = parseInt(menu_id, 10);
    const menu = info.menuMap[menuID]!;
    return menu.actionId;
  }
  return null;
}
