import { Type } from "../core/component";
import { rpcMixin } from "./rpc_mixin";
import { Widget } from "../ui/widget";
import { View } from "../ui/view";

export type Context = { [key: string]: any };

export interface CommonActionInfo {
  id: number;
  context: Context;
  title: string;
  target: "current" | "new";
  Widget: ActionWidget;
}

export type ActionRequest = number;

export type ActionWidget = Type<Widget<{}, {}>>;

export interface ClientActionInfo extends CommonActionInfo {
  type: "client";
}

export interface ActWindowInfo extends CommonActionInfo {
  type: "act_window";
}

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

export type ActionInfo = ClientActionInfo | ActWindowInfo;

export interface Action {
  id: number;
  widget?: Widget<any, any>;
  executor(parent: Widget<any, any>): Promise<Widget<any, any> | null>;
  activate(): void;
}

//------------------------------------------------------------------------------
// Action Manager Mixin
//------------------------------------------------------------------------------

export function actionManagerMixin<T extends ReturnType<typeof rpcMixin>>(
  Base: T
) {
  return class extends Base {
    actionCache: { [key: number]: Promise<ActionDescription> } = {};
    currentAction?: Action;
    lastAction?: Action;

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
      const action: Action = {
        id: this.generateID(),
        executor,
        activate() {
          if (self.currentAction && self.currentAction.widget) {
            self.currentAction.widget.destroy();
          }
          self.currentAction = action;
          self.update({
            inHome: false
          });
          document.title = descr.name + " - Odoo";
        }
      };
      self.lastAction = action;
      this.trigger("update_action", action);
    }

    doActWindowAction(descr: ActWindowActionDescription) {
      return async function executor(this: Action, parent: Widget<any, any>) {
        const widget = new View(parent, { info: descr.views[0][1] });
        const div = document.createElement("div");
        await widget.mount(div);
        this.widget = widget;
        return widget;
      };
    }

    doClientAction(descr: ClientActionDescription) {
      let key = descr.tag;
      let Widget = this.actionRegistry.get(key);
      return async function executor(this: Action, parent: Widget<any, any>) {
        const widget = new Widget(parent, {});
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
  };
}
