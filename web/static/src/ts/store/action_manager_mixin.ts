import { Type } from "../core/component";
import { rpcMixin } from "./rpc_mixin";
import { Widget } from "../widgets/widget";
import { View } from "../widgets/view";

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
export type ActionStack = ActionInfo[];

//------------------------------------------------------------------------------
// Action Manager Mixin
//------------------------------------------------------------------------------

export function actionManagerMixin<T extends ReturnType<typeof rpcMixin>>(
  Base: T
) {
  return class extends Base {
    actionCache: { [key: number]: Promise<ActionDescription> } = {};

    async doAction(request: ActionRequest) {
      const descr = await this.loadAction(request);
      switch (descr.type) {
        case "ir.actions.client":
          return this.doClientAction(descr);
        case "ir.actions.act_window":
          return this.doActWindowAction(descr);
        default:
          throw new Error("unhandled action");
      }
    }

    doActWindowAction(descr: ActWindowActionDescription) {
      let title = descr.name;
      this.update({
        inHome: false,
        stack: [
          {
            id: 1,
            context: {},
            target: "current",
            type: "act_window",
            title,
            Widget: View
          }
        ]
      });
      document.title = descr.name + " - Odoo";
    }

    doClientAction(descr: ClientActionDescription) {
      let key = descr.tag;
      let title = descr.name;
      let Widget = this.actionRegistry.get(key);
      this.update({
        inHome: false,
        stack: [
          {
            id: 1,
            context: {},
            target: "current",
            type: "client",
            title,
            Widget: Widget
          }
        ]
      });
      document.title = descr.name + " - Odoo";
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
