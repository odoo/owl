import { ActionStack } from "../store/store";
import { Widget } from "./widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Props {
  stack: ActionStack;
}

//------------------------------------------------------------------------------
// Action Container
//------------------------------------------------------------------------------

export class ActionContainer extends Widget<Props, {}> {
  template = "web.action_container";
  currentWidget: any;

  willStart() {
    return this.setContentWidget();
  }

  mounted() {
    if (this.currentWidget && this.currentWidget.el) {
      this.el!.appendChild(this.currentWidget.el);
      this.currentWidget.__mount();
    }
  }

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
      await widget.mount(this.el || document.createElement("div"));
      if (this.currentWidget) {
        this.currentWidget.destroy();
      }
      this.currentWidget = widget;
    }
  }
}
