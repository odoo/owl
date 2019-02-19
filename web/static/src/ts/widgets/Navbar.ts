import { MenuItem } from "../store";
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
    return this.env.services.router.formatURL("", { action_id, menu_id });
  }

  toggleHome(ev: MouseEvent) {
    ev.preventDefault();
    this.env.dispatch("toggle_home_menu");
  }

  openMenu(menu: MenuItem) {
    this.env.dispatch("open_menu", menu);
  }
}
