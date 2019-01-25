import { Widget } from "../core/widget";
import { Env, Menu } from "../env";

const template = `
    <div class="o_navbar">
        <span class="title">Odoo</span>
        <ul>
            <li t-foreach="env.menus" t-as="menu">
                <a t-att-href="getUrl(menu)">
                    <t t-esc="menu.title"/>
                </a>
            </li>
        </ul>
    </div>
`;

export class Navbar extends Widget<Env> {
  name = "navbar";
  template = template;

  mounted() {
    console.log("navbar mounted", this.el);
  }
  getUrl(menu: Menu) {
    const action_id = String(menu.actionID);
    return this.env.router.formatURL("", { action_id });
  }
}
