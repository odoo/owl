import { Widget } from "../core/widget";
import { Env, Menu } from "../env";
import { MenuItem } from "../misc/menu_helpers";

export interface Props {
  inHome: boolean;
  app: MenuItem | null;
}

export class Navbar extends Widget<Env, Props> {
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
