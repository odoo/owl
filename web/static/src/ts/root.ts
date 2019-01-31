import { Widget } from "./core/widget";
import { Env } from "./env";
import { ActionStack } from "./services/action_manager";
import { INotification } from "./services/notifications";
import { Action } from "./widgets/action";
import { HomeMenu } from "./widgets/home_menu";
import { Navbar } from "./widgets/navbar";
import { Notification } from "./widgets/notification";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface State {
  notifications: INotification[];
  stack: ActionStack;
  inMenu: boolean;
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------

const template = `
  <div class="o_web_client">
    <t t-widget="Navbar" t-props="{toggleHome:toggleHome,inMenu:state.inMenu}"/>
    <t t-if="state.inMenu">
      <t t-widget="HomeMenu" t-keep-alive="1"/>
    </t>
    <t t-else="1">
      <t t-widget="Action" t-props="{stack:state.stack}" t-keep-alive="1"/>
    </t>
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
  widgets = { Navbar, Notification, HomeMenu, Action };

  state: State = {
    notifications: [],
    stack: [],
    inMenu: false
  };

  constructor(env: Env) {
    super(env);
    this.toggleHome = this.toggleHome.bind(this);
  }

  mounted() {
    this.env.notifications.on("notifications_updated", this, notifs =>
      this.updateState({ notifications: notifs })
    );
    this.env.actionManager.on("action_stack_updated", this, stack =>
      this.updateState({ stack })
    );
    this.env.actionManager.activate();
  }

  toggleHome() {
    this.updateState({ inMenu: !this.state.inMenu });
  }
}
