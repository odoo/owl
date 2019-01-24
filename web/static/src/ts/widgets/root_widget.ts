import { Widget } from "../core/widget";
import { Navbar } from "./navbar";
import { ActionWidget } from "../services/action_manager";
// import { Action } from "../services/actions";
import { Env } from "../env";

const template = `
    <div class="o_web_client">
        <t t-widget="Navbar"/>
        <div class="o_content" t-ref="content">
        </div>
    </div>
`;

export class RootWidget extends Widget<Env> {
  name = "root";
  template = template;
  widgets = { Navbar };
  content: Widget<Env> | null = null;

  mounted() {
    this.env.actionManager.on("action_ready", this, this.setContentWidget);
    const actionWidget = this.env.actionManager.getCurrentAction();
    if (actionWidget) {
      this.setContentWidget(actionWidget);
    }
  }

  async setContentWidget(actionWidget: ActionWidget) {
    const currentWidget = this.content;
    const newWidget = new actionWidget.Widget(this, actionWidget.props);
    await newWidget.mount(<HTMLElement>this.refs.content);
    if (currentWidget) {
      currentWidget.destroy();
    }
    this.content = newWidget;
  }

  // onUrlChange() {
  //   this.setMainWidget();
  //   // notice that this can only be safely done because the root widget is
  //   // mounted now.
  //   this.render();
  // }

  // getAction(): Action {
  //   const routeInfo = this.env.router.getRoute();
  //   const actionID = parseInt(routeInfo.query.action_id);
  //   let actions: Action[] = this.env.actions;
  //   let action = actions.find(a => a.id === actionID);
  //   if (!action) {
  //     action = actions.find(a => a.default === true);
  //     if (!action) {
  //       throw new Error("No valid action!");
  //     }
  //   }
  //   return action;
  // }
}
