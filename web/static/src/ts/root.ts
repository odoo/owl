import { Widget } from "./core/widget";
import { Env } from "./env";
import { INotification } from "./services/notifications";
import { Action } from "./widgets/action";
import { HomeMenu } from "./widgets/home_menu";
import { Navbar } from "./widgets/navbar";
import { Notification } from "./widgets/notification";

const template = `
    <div class="o_web_client">
      <t t-widget="Navbar" t-props="{toggleHomeMenu:toggleHomeMenu,inMenu:state.inMenu}"/>
      <t t-if="state.inMenu">
        <t t-widget="HomeMenu" t-props="{toggleHomeMenu:toggleHomeMenu}"/>
      </t>
      <t t-else="1">
        <t t-widget="Action" t-keep-alive="1"/>
      </t>
      <div class="o_notification_container">
        <t t-foreach="state.notifications" t-as="notif">
          <t t-widget="Notification" t-props="notif"/>
        </t>
      </div>
    </div>
`;

interface State {
  notifications: INotification[];
  inMenu: boolean;
}

export class Root extends Widget<Env, {}> {
  name = "root";
  template = template;
  widgets = { Navbar, Notification, HomeMenu, Action };
  content: Widget<Env, {}> | null = null;

  state: State = {
    notifications: [],
    inMenu: false
  };

  constructor(env: Env) {
    super(env);
    this.toggleHomeMenu = this.toggleHomeMenu.bind(this);
  }

  mounted() {
    // this.env.actionManager.on("action_ready", this, this.setContentWidget);
    this.env.notifications.on("notification_added", this, this.addNotif);
    this.env.notifications.on("notification_removed", this, this.removeNotif);

    // const actionWidget = this.env.actionManager.getCurrentAction();
    // if (actionWidget) {
    //   this.setContentWidget(actionWidget);
    // }
  }

  // async setContentWidget(actionWidget: ActionWidget) {
  //   const currentWidget = this.content;
  //   const newWidget = new actionWidget.Widget(this, actionWidget.props);
  //   await newWidget.mount(<HTMLElement>this.refs.content);
  //   if (currentWidget) {
  //     currentWidget.destroy();
  //   }
  //   this.content = newWidget;
  // }

  addNotif(notif: INotification) {
    const notifications = this.state.notifications.concat(notif);
    this.updateState({ notifications });
  }
  removeNotif(notif: INotification) {
    const notifs = this.state.notifications.filter(f => f.id !== notif.id);
    this.updateState({ notifications: notifs });
  }

  toggleHomeMenu() {
    this.updateState({ inMenu: !this.state.inMenu });
  }
}
