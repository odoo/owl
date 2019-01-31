import { Widget } from "../core/widget";
import { Env } from "../env";

const template = `
    <div class="o_home_menu">
        <span>HOME MENU</span>
    </div>
`;

export class HomeMenu extends Widget<Env, {}> {
  name = "home";
  template = template;
}
