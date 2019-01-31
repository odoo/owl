import { Widget } from "../core/widget";
import { Env } from "../env";

const template = `
    <div class="o_content">
        <span>MAIN ACTION</span>
        <input/>
    </div>
`;

export class Action extends Widget<Env, {}> {
  name = "action";
  template = template;
}
