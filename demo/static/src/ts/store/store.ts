import { EventBus } from "../core/event_bus";
import { idGenerator } from "../core/utils";
import { Env } from "../env";
import { Query } from "../services/router";
import { actionManagerMixin } from "./action_manager_mixin";
import { rpcMixin } from "./rpc_mixin";
import { MenuItem } from "./store";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export { ControllerWidget } from "./action_manager_mixin";
export { RPC } from "./rpc_mixin";

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

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "notification" | "warning";
  sticky: boolean;
}

export interface MenuInfo {
  menus: { [key: number]: MenuItem | undefined };

  actionMap: { [id: number]: MenuItem | undefined };
  roots: number[];
}

export interface State {
  inHome: boolean;
  currentApp: MenuItem | null;
  notifications: Notification[];
}

//------------------------------------------------------------------------------
// Store
//------------------------------------------------------------------------------
export class BaseStore extends EventBus {
  state: State = {
    inHome: false,
    currentApp: null,
    notifications: []
  };
  menuInfo: MenuInfo;
  env: Env;
  currentQuery: Query;
  generateID = idGenerator();

  constructor(env: Env, menuInfo: MenuInfo) {
    super();
    this.env = env;
    this.menuInfo = menuInfo;
    this.currentQuery = {};
  }

  update(nextState: Partial<State>) {
    Object.assign(this.state, nextState);
    this.trigger("state_updated", this.state);
  }

  toggleHomeMenu() {
    if (this.state.inHome && !this.state.currentApp) {
      return;
    }
    this.update({ inHome: !this.state.inHome });
    if (this.state.inHome) {
      this.env.services.router.navigate({ home: true });
    } else {
      this.updateQuery(this.currentQuery);
    }
  }

  updateQuery(query: Query) {
    this.currentQuery = query;
    this.env.services.router.navigate(query);
  }

  addNotification(notif: Partial<Notification>): number {
    const id = this.generateID();
    const defaultVals = {
      title: "",
      message: "",
      type: "notification",
      sticky: false
    };
    const notification = Object.assign(defaultVals, notif, { id });
    const notifs = this.state.notifications.concat(notification);
    this.update({ notifications: notifs });
    if (!notification.sticky) {
      setTimeout(() => this.closeNotification(id), 2500);
    }
    return id;
  }

  closeNotification(id: number) {
    const notifs = this.state.notifications.filter(n => n.id !== id);
    this.update({ notifications: notifs });
  }
}

export class Store extends actionManagerMixin(rpcMixin(BaseStore)) {
  constructor(env: Env, menuInfo: MenuInfo) {
    super(env, menuInfo);
    const query = this.env.services.router.getQuery();
    let { app, actionId } = this.getAppAndAction(query);
    this.state.currentApp = app;
    if (!actionId) {
      this.state.inHome = true;
      this.env.services.router.navigate({ home: true });
    }
    this.env.services.router.on("query_changed", this, this.updateAction);
    this.updateAction(this.env.services.router.getQuery());
  }

  private updateAction(query: Query) {
    let { app, actionId } = this.getAppAndAction(query);
    this.updateAppState(app, actionId);
  }

  activateMenuItem(menuId: number) {
    const menu = this.menuInfo.menus[menuId];
    if (!menu) {
      throw new Error("Invalid menu id");
    }
    return this.updateAppState(menu.app, menu.actionId);
  }

  private async updateAppState(app: MenuItem | null, actionId: number | null) {
    const newApp = app || this.state.currentApp;
    if (actionId) {
      const query: Query = { action_id: String(actionId) };
      const menuId = newApp ? newApp.app.id : false;
      if (menuId) {
        query.menu_id = String(menuId);
      }
      if (app) {
        this.update({ currentApp: app });
      }
      await this.doAction(actionId);
      this.updateQuery(query);
    } else {
      this.update({ inHome: true, currentApp: newApp });
    }
  }

  getAppAndAction(
    query: Query
  ): { app: MenuItem | null; actionId: number | null } {
    const menuInfo = this.menuInfo;
    let app: MenuItem | null = null;
    let actionId: number | null = null;
    if (typeof query.action_id === "string") {
      actionId = parseInt(query.action_id, 10);
      if (menuInfo.actionMap[actionId]) {
        const menu = menuInfo.actionMap[actionId]!;
        app = menu.app;
      }
    }
    if (typeof query.menu_id === "string") {
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
