import { Widget } from "../core/widget";
import { Navbar } from "./navbar";
import { ActionWidget } from "../services/action_manager";
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
}
