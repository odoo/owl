import { Menu } from "../env";
import { MenuItem } from "../misc/menu_helpers";
import { Widget } from "./widget";

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

export class Navbar extends Widget<Props, {}> {
  template = "web.navbar";

  getUrl(menu: Menu) {
    const action_id = String(menu.actionID);
    return this.env.router.formatURL("", { action_id });
  }

  toggleHome(ev: MouseEvent) {
    ev.preventDefault();
    this.trigger("toggle_home_menu");
  }
}
