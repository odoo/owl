import { Widget } from "../core/widget";
import { Env } from "../env";
import { MenuInfo, ProcessedMenuItem } from "../misc/menu_helpers";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Props {
  menuInfo: MenuInfo;
}

//------------------------------------------------------------------------------
// Home Menu
//------------------------------------------------------------------------------

export class HomeMenu extends Widget<Env, Props> {
  template = "web.home_menu";

  openApp(appId: number) {
    debugger;
  }

  get apps(): ProcessedMenuItem[] {
    const info = this.props.menuInfo;
    return info.roots.map(root => info.menuMap[root]!);
  }
}
