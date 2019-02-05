import { MenuInfo, MenuItem } from "../widgets/root";
import { Widget } from "./widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Props {
  menuInfo: MenuInfo;
}

//------------------------------------------------------------------------------
// Home Menu
//------------------------------------------------------------------------------

export class HomeMenu extends Widget<Props, {}> {
  template = "web.home_menu";

  get apps(): MenuItem[] {
    const info = this.props.menuInfo;
    return info.roots.map(root => info.menus[root]!);
  }

  openMenu(app: MenuItem, event: MouseEvent) {
    event.preventDefault();
    this.trigger("open_menu", app);
  }
}
