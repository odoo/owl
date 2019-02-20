import { Type } from "./core/component";
import { EventBus } from "./core/event_bus";
import { Registry } from "./core/registry";
import { RPC } from "./services/ajax";
import { IRouter, Query } from "./services/router";
import { Widget } from "./widgets/widget";

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

export interface State {
  stack: ActionStack;
  inHome: boolean;
  currentApp: MenuItem | null;
}

export interface Services {
  rpc: RPC;
  router: IRouter;
}

export type Context = { [key: string]: any };

export interface CommonActionInfo {
  id: number;
  context: Context;
  title: string;
  target: "current" | "new";
}

export type ActionRequest = string | number;

export type ActionWidget = Type<Widget<{}, {}>>;

export interface ClientActionInfo extends CommonActionInfo {
  type: "client";
  name: string;
  Widget: ActionWidget;
}

export interface ActWindowInfo extends CommonActionInfo {
  type: "act_window";
  view: string;
}

export interface ActionDescription {
  id: number;
  type: "ir.actions.act_window" | "ir.actions.client";
  target: "current";
}

export type ActionInfo = ClientActionInfo | ActWindowInfo;
export type ActionStack = ActionInfo[];

export interface RPCModelQuery {
  model: string;
  method: string;
  args?: any[];
  kwargs?: { [key: string]: any };
  context?: { [key: string]: any };
}

export interface RPCControllerQuery {
  route: string;
  params: { [key: string]: any };
}

export type RPCQuery = RPCModelQuery | RPCControllerQuery;

export type RPC = (rpc: RPCQuery) => Promise<any>;

export interface INotification {
  id: number;
  title: string;
  message: string;
  type: "notification" | "warning";
  sticky: boolean;
}

interface RequestParameters {
  route: string;
  params: { [key: string]: any };
}

//------------------------------------------------------------------------------
// Store
//------------------------------------------------------------------------------

export class Store extends EventBus {
  state: State;
  menuInfo: MenuInfo;
  services: Services;
  actionRegistry: Registry<ActionWidget>;

  constructor(
    services: Services,
    menuInfo: MenuInfo,
    actionRegistry: Registry<ActionWidget>
  ) {
    super();
    this.services = services;
    this.menuInfo = menuInfo;
    this.actionRegistry = actionRegistry;
    this.state = {
      stack: [],
      inHome: false,
      currentApp: null
    };
    const query = this.services.router.getQuery();
    let { app, actionId } = this.getAppAndAction(query);
    this.state.currentApp = app;
    if (!actionId) {
      this.state.inHome = true;
    }

    this.services.router.on("query_changed", this, this.updateAction);
    this.updateAction(this.services.router.getQuery());
  }

  private updateAction(query: Query) {
    let { app, actionId } = this.getAppAndAction(query);
    this.updateAppState(app, actionId);
  }

  dispatch(action: string, params?: any) {
    switch (action) {
      case "open_menu":
        this.updateAppState(params.app, params.actionId);
        break;
      case "toggle_home_menu":
        this.updateState({ inHome: !this.state.inHome });
        break;
      case "add_notification":
        this.addNotification(params);
        break;
      case "close_notification":
        this.closeNotification(params);
        break;
    }
  }

  updateState(nextState: Partial<State>) {
    Object.assign(this.state, nextState);
    this.trigger("state_updated", this.state);
  }

  nextID = 1;

  addNotification(notif: Partial<INotification>): number {
    const id = this.nextID++;
    const defaultVals = {
      title: "",
      message: "",
      type: "notification",
      sticky: false
    };
    const notification = Object.assign(defaultVals, notif, { id });
    this.trigger("notification_added", notification);
    if (!notification.sticky) {
      setTimeout(() => this.closeNotification(id), 2500);
    }
    return id;
  }
  closeNotification(id: number) {
    this.trigger("notification_closed", id);
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
      this.services.router.navigate(query);
      this.doAction(actionId);
    } else {
      this.updateState({ inHome: true, currentApp: newApp });
    }
  }

  private getAppAndAction(
    query: Query
  ): { app: MenuItem | null; actionId: number | null } {
    const menuInfo = this.menuInfo;
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

  doAction(request: ActionRequest) {
    if (typeof request === "number") {
      this.loadAction(request);
      // this is an action ID
      let name = request === 131 ? "discuss" : "crm";
      let title =
        request === 131 ? "Discuss" : request === 250 ? "Notes" : "CRM";
      let Widget = this.actionRegistry.get(name);
      this.updateState({
        inHome: false,
        stack: [
          {
            id: 1,
            context: {},
            target: "current",
            type: "client",
            name,
            title,
            Widget: Widget
          }
        ]
      });
    }
  }

  private loadAction(id: number) {
    this.rpc({
      route: "web/action/load",
      params: {
        action_id: id
      }
    });
  }

  counter: number = 0;

  async rpc(rpc: RPCQuery): Promise<any> {
    const request = this.prepareRequest(rpc);
    if (this.counter === 0) {
      this.trigger("rpc_status", "loading");
    }
    this.counter++;
    const result = await this.services.rpc(request.route, request.params);
    this.counter--;
    if (this.counter === 0) {
      this.trigger("rpc_status", "notloading");
    }
    return result;
  }

  private prepareRequest(query: RPCQuery): RequestParameters {
    let route: string;
    let params = "params" in query ? query.params : {};
    if ("route" in query) {
      route = query.route;
    } else if ("model" in query && "method" in query) {
      route = `/web/dataset/call_kw/${query.model}/${query.method}`;
      params.args = query.args || [];
      params.model = query.model;
      params.method = query.method;
      params.kwargs = Object.assign(params.kwargs || {}, query.kwargs);
      params.kwargs.context =
        query.context || params.context || params.kwargs.context;
    } else {
      throw new Error("Invalid Query");
    }

    // doing this remove empty keys, and undefined stuff
    const sanitizedParams = JSON.parse(JSON.stringify(params));
    return { route, params: sanitizedParams };
  }
}
