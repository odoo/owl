import { Widget } from "./core/widget";
import { Navbar } from "./widgets/navbar";
import { ActionWidget } from "./services/action_manager";
import { INotification } from "./services/notifications";
import { Notification } from "./widgets/notification";
import { Env } from "./env";

const template = `
    <div class="o_web_client">
        <t t-widget="Navbar"/>
        <div class="o_content" t-ref="content"/>
        <div class="o_notification_container">
          <t t-foreach="state.notifications" t-as="notif">
            <t t-widget="Notification" t-props="notif"/>
          </t>
        </div>
    </div>
`;

export class Root extends Widget<Env, {}> {
  name = "root";
  template = template;
  widgets = { Navbar, Notification };
  content: Widget<Env, {}> | null = null;

  state: { notifications: INotification[] } = { notifications: [] };

  mounted() {
    this.env.actionManager.on("action_ready", this, this.setContentWidget);
    this.env.notifications.on("notification_added", this, this.addNotif);
    this.env.notifications.on("notification_removed", this, this.removeNotif);

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

  addNotif(notif: INotification) {
    const notifications = this.state.notifications.concat(notif);
    this.updateState({ notifications });
  }
  removeNotif(notif: INotification) {
    const notifs = this.state.notifications.filter(f => f.id !== notif.id);
    this.updateState({ notifications: notifs });
  }
}
