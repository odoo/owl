import { INotification } from "../core/notifications";
import { Query } from "../core/router";
import { debounce } from "../core/utils";
import { ActionStack } from "../services/action_manager";
import { ActionContainer } from "./action_container";
import { HomeMenu } from "./home_menu";
import { Navbar } from "./navbar";
import { Notification } from "./notification";
import { Env, Widget } from "./widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface MenuItem {
  id: number;
  name: string;
  parentId: number | false;
  action: string | false;
  icon: string | false;

  // root menu id
  app: MenuItem;
  actionId: number;
  children: MenuItem[];
}

export interface MenuInfo {
  menus: { [key: number]: MenuItem | undefined };

  actionMap: { [id: number]: MenuItem | undefined };
  roots: number[];
}

interface Props {
  menuInfo: MenuInfo;
}

interface State {
  notifications: INotification[];
  stack: ActionStack;
  inHome: boolean;
  currentApp: MenuItem | null;
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
    let { app, actionId } = this.getAppAndAction(query);
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

    // adding reactiveness to mobile/non mobile
    window.addEventListener("resize", <any>debounce(() => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile !== this.env.isMobile) {
        this.env.isMobile = isMobile;
        this.render();
      }
    }, 50));
  }

  private updateAction(query: Query) {
    let { app, actionId } = this.getAppAndAction(query);
    this.updateAppState(app, actionId);
  }

  private updateAppState(app: MenuItem | null, actionId: number | null) {
    const newApp = app || this.state.currentApp;
    if (actionId) {
      const query: Query = { action_id: String(actionId) };
      const menuId = newApp ? newApp.app.id : false;
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
    this.updateAppState(menu.app, menu.actionId);
  }

  private getAppAndAction(
    query: Query
  ): { app: MenuItem | null; actionId: number | null } {
    const menuInfo = this.props.menuInfo;
    let app: MenuItem | null = null;
    let actionId: number | null = null;
    if ("action_id" in query) {
      actionId = parseInt(query.action_id, 10);
      if (menuInfo.actionMap[actionId]) {
        const menu = menuInfo.actionMap[actionId]!;
        app = menu.app;
      }
    }
    if ("menu_id" in query) {
      const menuId = parseInt(query.menu_id, 10);
      const menu = menuInfo.menus[menuId];
      if (menu) {
        app = menu.app;
        if (!actionId) {
          actionId = menu.actionId;
        }
      }
    }
    return { app, actionId };
  }
}
