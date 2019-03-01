import { EventBus } from "../core/event_bus";
import { Registry } from "../core/registry";
import { RPC } from "../services/ajax";
import { IRouter, Query } from "../services/router";
import {
  actionManagerMixin,
  ActionStack,
  ActionWidget
} from "./action_manager_mixin";
import { notificationMixin } from "./notification_mixin";
import { rpcMixin } from "./rpc_mixin";
import { MenuItem } from "./store";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export { ActionStack, ActionWidget } from "./action_manager_mixin";
export { INotification } from "./notification_mixin";
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

export interface MenuInfo {
  menus: { [key: number]: MenuItem | undefined };

  actionMap: { [id: number]: MenuItem | undefined };
  roots: number[];
}

export interface State {
  stack: ActionStack;
  inHome: boolean;
  currentApp: MenuItem | null;
}

export interface Services {
  rpc: RPC;
  router: IRouter;
}

//------------------------------------------------------------------------------
// Store
//------------------------------------------------------------------------------
export class BaseStore extends EventBus {
  state: State = {
    stack: [],
    inHome: false,
    currentApp: null
  };
  menuInfo: MenuInfo;
  services: Services;
  actionRegistry: Registry<ActionWidget>;
  currentQuery: Query;

  constructor(
    services: Services,
    menuInfo: MenuInfo,
    actionRegistry: Registry<ActionWidget>
  ) {
    super();
    this.services = services;
    this.menuInfo = menuInfo;
    this.actionRegistry = actionRegistry;
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
      this.services.router.navigate({ home: true });
    } else {
      this.updateQuery(this.currentQuery);
    }
  }

  updateQuery(query: Query) {
    this.currentQuery = query;
    this.services.router.navigate(query);
  }
}

export class Store extends actionManagerMixin(
  rpcMixin(notificationMixin(BaseStore))
) {
  constructor(
    services: Services,
    menuInfo: MenuInfo,
    actionRegistry: Registry<ActionWidget>
  ) {
    super(services, menuInfo, actionRegistry);
    const query = this.services.router.getQuery();
    let { app, actionId } = this.getAppAndAction(query);
    this.state.currentApp = app;
    if (!actionId) {
      this.state.inHome = true;
      this.services.router.navigate({ home: true });
    }

    this.services.router.on("query_changed", this, this.updateAction);
    this.updateAction(this.services.router.getQuery());
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
