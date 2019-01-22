import Widget, { Env } from "../../../src/core/Widget";
import Navbar from "./Navbar";
import { Action } from "../services/actions";

const template = `
    <div class="o_web_client">
        <t t-widget="Navbar"/>
        <div class="o_content">
          <t t-widget="Content"/>
        </div>
    </div>
`;

export default class RootWidget extends Widget {
  name = "root";
  template = template;
  widgets = { Navbar };
  state = { validcounter: true };

  constructor(env: Env) {
    super(env);
    this.setMainWidget();
  }

  mounted() {
    this.env.services.router.register(this, this.onUrlChange);
  }

  setMainWidget() {
    const action = this.getAction();
    (<any>this.widgets).Content = action.Widget;
  }

  onUrlChange() {
    this.setMainWidget();
    // notice that this can only be safely done because the root widget is
    // mounted now.
    this.render();
  }

  getAction(): Action {
    const routeInfo = this.env.services.router.getRouteInfo();
    const actionID = parseInt(routeInfo.query.action_id);
    let actions: Action[] = this.env.services.actions;
    let action = actions.find(a => a.id === actionID);
    if (!action) {
      action = actions.find(a => a.default === true);
      if (!action) {
        throw new Error("No valid action!");
      }
    }
    return action;
  }
}
