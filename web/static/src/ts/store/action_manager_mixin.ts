import { Type } from "../core/component";
import { rpcMixin } from "./rpc_mixin";
import { Widget } from "../widgets/widget";

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

//------------------------------------------------------------------------------
// Action Manager Mixin
//------------------------------------------------------------------------------

export function actionManagerMixin<T extends ReturnType<typeof rpcMixin>>(
  Base: T
) {
  return class extends Base {
    actionCache: { [key: number]: Promise<ActionDescription> } = {};

    async doAction(request: ActionRequest) {
      if (typeof request === "number") {
        await this.loadAction(request);
        // this is an action ID
        let name = request === 131 ? "discuss" : "crm";
        let title =
          request === 131 ? "Discuss" : request === 250 ? "Notes" : "CRM";
        let Widget = this.actionRegistry.get(name);
        this.update({
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
