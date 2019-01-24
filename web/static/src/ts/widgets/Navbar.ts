import { Widget } from "../core/widget";
import { Action } from "../services/actions";
import { Env } from "../env";

const template = `
    <div class="o_navbar">
        <span class="title">Odoo</span>
        <ul>
            <li t-foreach="env.actions" t-as="action">
                <a t-on-click="activateAction(action)" t-att-href="getUrl(action)">
                    <t t-esc="action.title"/>
                </a>
            </li>
        </ul>
    </div>
`;

export class Navbar extends Widget<Env> {
  name = "navbar";
  template = template;

  getUrl(action: Action) {
    const action_id = String(action.id);
    return this.env.router.formatURL("web", { action_id });
  }

  activateAction(action: Action, event: MouseEvent) {
    event.preventDefault();
    this.env.actionManager.doAction(action);
  }
}
