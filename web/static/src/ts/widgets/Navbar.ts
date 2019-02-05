import { MenuItem } from "./root";
import { PureWidget } from "./widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Props {
  inHome: boolean;
  app: MenuItem | null;
}

//------------------------------------------------------------------------------
// Navbar
//------------------------------------------------------------------------------

export class Navbar extends PureWidget<Props, {}> {
  template = "web.navbar";

  getUrl(menu: MenuItem) {
    const action_id = String(menu.actionId);
    const menu_id = String(menu.app.id);
    return this.env.router.formatURL("", { action_id, menu_id });
  }

  toggleHome(ev: MouseEvent) {
    ev.preventDefault();
    this.trigger("toggle_home_menu");
  }

  openMenu(menu: MenuItem) {
    this.trigger("open_menu", menu);
  }
}
