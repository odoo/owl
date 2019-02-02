import { Widget } from "../core/widget";
import { Env } from "../env";
import { ActionStack } from "../services/action_manager";
import { INotification } from "../core/notifications";
import { Action } from "./action";
import { HomeMenu } from "./home_menu";
import { Navbar } from "./navbar";
import { Notification } from "./notification";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface State {
  notifications: INotification[];
  stack: ActionStack;
  inHome: boolean;
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
    inHome: false
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
    this.updateState({ inHome: !this.state.inHome });
  }
}
