import { INotification } from "../core/notifications";
import { Widget } from "./widget";
import { Env } from "../env";
import { MenuInfo, MenuItem, getAppAndAction } from "../misc/menu_helpers";
import { ActionStack } from "../services/action_manager";
import { ActionContainer } from "./action_container";
import { HomeMenu } from "./home_menu";
import { Navbar } from "./navbar";
import { Notification } from "./notification";
import { Query } from "../core/router";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

interface State {
  notifications: INotification[];
  stack: ActionStack;
  inHome: boolean;
  currentApp: MenuItem | null;
}

interface Props {
  menuInfo: MenuInfo;
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------

export class Root extends Widget<Props, State> {
  template = "web.web_client";
  widgets = { Navbar, Notification, HomeMenu, ActionContainer };

  state: State = {
    notifications: [],
    stack: [],
    inHome: false,
    currentApp: null
  };

  constructor(env: Env, props: Props) {
    super(env, props);
    const query = this.env.router.getQuery();
    let { app, actionId } = getAppAndAction(props.menuInfo, query);
    this.state.currentApp = app;
    if (!actionId) {
      this.state.inHome = true;
    }
  }
  mounted() {
    // notifications
    this.env.notifications.on("notifications_updated", this, notifs =>
      this.updateState({ notifications: notifs })
    );

    // actions
    this.env.actionManager.on("action_stack_updated", this, stack =>
      this.updateState({ stack, inHome: false })
    );
    this.env.router.on("query_changed", this, this.updateAction);
    this.updateAction(this.env.router.getQuery());
  }

  private updateAction(query: Query) {
    let { app, actionId } = getAppAndAction(this.props.menuInfo, query);
    this.updateAppState(app, actionId);
  }

  private updateAppState(app: MenuItem | null, actionId: number | null) {
    const newApp = app || this.state.currentApp;
    if (actionId) {
      const query: Query = { action_id: String(actionId) };
      const menuId = newApp ? newApp.menuId : false;
      if (menuId) {
        query.menu_id = String(menuId);
      }
      if (app) {
        this.updateState({ currentApp: app });
      }
      this.env.router.navigate(query);
      this.env.actionManager.doAction(actionId);
    } else {
      this.updateState({ inHome: true, currentApp: newApp });
    }
  }

  toggleHome() {
    this.updateState({ inHome: !this.state.inHome });
  }

  openMenu(menu: MenuItem) {
    const app = this.props.menuInfo.menuMap[menu.menuId]!;
    this.updateAppState(app, menu.actionId);
  }
}
