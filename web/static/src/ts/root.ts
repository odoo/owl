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

export class Root extends Widget<Env, {}> {
  template = "web_client";
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
