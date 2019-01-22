import Widget from "../core/Widget";
import { Action } from "../services/actions";

const template = `
    <div class="o_navbar">
        <span class="title">Odoo</span>
        <ul>
            <li t-foreach="env.services.actions" t-as="action">
                <a t-att-href="getUrl(action)"><t t-esc="action.title"/></a>
            </li>
        </ul>
    </div>
`;

export default class Navbar extends Widget {
  name = "navbar";
  template = template;

  getUrl(action: Action) {
    const action_id = action.id;
    return this.env.services.router.formatURL("web", { action_id });
  }
}
