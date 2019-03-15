import { Type } from "../../../../../../src/component";
import { rpcMixin } from "./rpc_mixin";
import { Widget } from "../widget";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

// Miscellaneous
export type ActionRequest = number;

export type ControllerWidget = Type<Widget<{}, {}>>;

// Action Description
interface BaseActionDescription {
  id: number;
  target: "current";
  name: string;
}
export interface ClientActionDescription extends BaseActionDescription {
  type: "ir.actions.client";
  tag: string;
}

export interface ActWindowActionDescription extends BaseActionDescription {
  type: "ir.actions.act_window";
  views: [false | number, string][];
  domain: false | string;
  res_id: number;
  res_model: string;
  context: Object | string;
}

export type ActionDescription =
  | ClientActionDescription
  | ActWindowActionDescription;

// Controller
export interface Controller {
  id: number;
  actionId: number;
  widget?: Widget<any, any>;
  create(parent: Widget<any, any>): Promise<Widget<any, any> | null>;
  title: string;
}

//------------------------------------------------------------------------------
// Action Manager Mixin
//------------------------------------------------------------------------------

export function actionManagerMixin<T extends ReturnType<typeof rpcMixin>>(
  Base: T
) {
  return class extends Base {
    actionCache: { [key: number]: Promise<ActionDescription> } = {};
    currentController?: Controller;
    lastController?: Controller;

    async doAction(request: ActionRequest) {
      const self = this;
      const descr = await this.loadAction(request);
      let executor;
      switch (descr.type) {
        case "ir.actions.client":
          executor = this.doClientAction(descr);
          break;
        case "ir.actions.act_window":
          executor = this.doActWindowAction(descr);
          break;
        default:
          throw new Error("unhandled action");
      }
      const action: Controller = {
        id: this.generateID(),
        actionId: descr.id,
        create: executor,
        title: descr.name
      };
      self.lastController = action;
      this.trigger("update_action", action);
    }

    doActWindowAction(descr: ActWindowActionDescription) {
      const tag = descr.views[0][1];
      let View = this.env.viewRegistry.get(tag);
      if (!View) {
        this.addNotification({
          title: "Invalid View type",
          type: "warning",
          message: `Cannot find view of type '${tag}' in the view registry`
        });
        View = Widget;
      }
      return async function executor(
        this: Controller,
        parent: Widget<any, any>
      ) {
        const widget = new View!(parent, {
          info: descr.views[0][1],
          title: descr.name
        });
        const div = document.createElement("div");
        await widget.mount(div);
        this.widget = widget;
        return widget;
      };
    }

    doClientAction(descr: ClientActionDescription): Controller["create"] {
      let key = descr.tag;
      let ActionWidget = this.env.actionRegistry.get(key);
      if (!ActionWidget) {
        this.addNotification({
          title: "Invalid Client Action",
          type: "warning",
          message: `Cannot find widget '${key}' in the action registry`
        });
        ActionWidget = Widget;
      }
      return async function executor(
        this: Controller,
        parent: Widget<any, any>
      ) {
        const widget = new ActionWidget!(parent, {});
        const div = document.createElement("div");
        await widget.mount(div);
        this.widget = widget;
        return widget;
      };
    }

    loadAction(id: number): Promise<ActionDescription> {
      if (id in this.actionCache) {
        return this.actionCache[id];
      }
      return (this.actionCache[id] = this.rpc({
        route: "web/action/load",
        params: {
          action_id: id
        }
      }));
    }

    activateController(controller: Controller) {
      if (this.currentController && this.currentController.widget) {
        this.currentController.widget.destroy();
      }
      this.currentController = controller;
      this.update({
        inHome: false
      });
      document.title = controller.title + " - Odoo";
    }
  };
}
