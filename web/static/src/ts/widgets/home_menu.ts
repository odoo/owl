import { Widget } from "../core/widget";
import { Env } from "../env";
import { MenuInfo, MenuItem } from "../misc/menu_helpers";

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

  get apps(): MenuItem[] {
    const info = this.props.menuInfo;
    return info.roots.map(root => info.menuMap[root]!);
  }

  openApp(app: MenuItem, event: MouseEvent) {
    event.preventDefault();
    this.trigger("app_opened", app);
  }
}
