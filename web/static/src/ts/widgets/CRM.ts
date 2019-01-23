import Widget from "../core/widget";
import { Env } from "../env";

const template = `
    <div class="o_crm">
        <span>CRM!!!!</span>
    </div>
`;

export default class Discuss extends Widget<Env> {
  name = "crm";
  template = template;
}
