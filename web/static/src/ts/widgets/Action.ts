import { Widget } from "../core/widget";
import { Env } from "../env";
import { ActionStack } from "../services/action_manager";

export interface Props {
  stack: ActionStack;
}

export class Action extends Widget<Env, Props> {
  name = "action";
  template = `<div class="o_content"/>`;
  currentWidget: any;

  shouldUpdate(nextProps: Props) {
    if (nextProps.stack !== this.props.stack) {
      this.props = nextProps;
      this.setContentWidget();
    }
    return false;
  }

  async setContentWidget() {
    const info = this.props.stack[this.props.stack.length - 1];
    if (info && info.type === "client") {
      const Widget = info.Widget;
      let widget = new Widget(this, {});
      await widget.mount(this.el!);
      if (this.currentWidget) {
        this.currentWidget.destroy();
      }
      this.currentWidget = widget;
    }
  }
}
