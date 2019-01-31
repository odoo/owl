import { Widget } from "../core/widget";
import { Env, Menu } from "../env";

const template = `
    <div class="o_navbar">
        <a aria-label="Applications" class="o_title fa fa-th" href="#" title="Applications" accesskey="h" t-on-click="toggleHomeMenu"/>
        <ul t-if="!props.inMenu">
            <li t-foreach="env.menus" t-as="menu">
                <a t-att-href="getUrl(menu)">
                    <t t-esc="menu.title"/>
                </a>
            </li>
        </ul>
    </div>
`;

export interface Props {
  toggleHomeMenu: () => void;
  inMenu: boolean;
}

export class Navbar extends Widget<Env, Props> {
  name = "navbar";
  template = template;

  getUrl(menu: Menu) {
    const action_id = String(menu.actionID);
    return this.env.router.formatURL("", { action_id });
  }

  toggleHomeMenu(ev: MouseEvent) {
    ev.preventDefault();
    this.props.toggleHomeMenu();
  }
}
