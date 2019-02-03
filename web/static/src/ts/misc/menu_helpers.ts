//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface BaseMenuItem {
  id: number;
  name: string;
  parent_id: number | false;
  action: string | false;
  icon: string | false;
}

export interface MenuItem extends BaseMenuItem {
  children: MenuItem[];
}

export interface ProcessedMenuItem extends BaseMenuItem {
  children: number[];
}

export interface MenuInfo {
  menuMap: { [key: number]: ProcessedMenuItem | undefined };
  roots: number[];
}

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

export function processMenuItems(items: MenuItem[]): MenuInfo {
  const menuMap: MenuInfo["menuMap"] = {};
  const roots: number[] = [];

  for (let root of items) {
    roots.push(root.id);
    addToMap(root);
  }

  function addToMap(m: MenuItem) {
    let processedItem: ProcessedMenuItem = Object.assign({}, m, {
      children: m.children.map(c => c.id)
    });
    menuMap[processedItem.id] = processedItem;
    m.children.forEach(addToMap);
  }

  return { menuMap, roots };
}

// todo

// menu -> formatURL(menuID, menus),
// findApp(menuID, menus),
// findMenu
