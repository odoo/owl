import { Widget } from "../core/widget";
import { Env, Menu } from "../env";

export interface Props {
  toggleHome: () => void;
  inMenu: boolean;
}

export class Navbar extends Widget<Env, Props> {
  template = "navbar";

  getUrl(menu: Menu) {
    const action_id = String(menu.actionID);
    return this.env.router.formatURL("", { action_id });
  }

  toggleHome(ev: MouseEvent) {
    ev.preventDefault();
    this.props.toggleHome();
  }
}
