import { INotification } from "../core/notifications";
import { Widget } from "../core/widget";
import { Env } from "../env";
import { MenuInfo } from "../misc/menu_helpers";
import { ActionStack } from "../services/action_manager";
import { ActionContainer } from "./action_container";
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

interface Props {
  menuInfo: MenuInfo;
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------

export class Root extends Widget<Env, Props> {
  template = "web.web_client";
  widgets = { Navbar, Notification, HomeMenu, ActionContainer };

  state: State = {
    notifications: [],
    stack: [],
    inHome: false
  };

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
