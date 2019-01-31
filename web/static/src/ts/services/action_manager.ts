import { EventBus } from "../core/event_bus";
import { Widget } from "../core/widget";
import { Env } from "../env";
import { Registry } from "../registry";
import { Type } from "../types";
import { IRouter, Query } from "./router";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export type ActionRequest = string | number;

export type Context = { [key: string]: any };

export interface CommonActionInfo {
  id: number;
  context: Context;
  title: string;
  target: "current" | "new";
}

export interface ClientActionInfo extends CommonActionInfo {
  type: "client";
  name: string;
  Widget: Type<Widget<Env, {}>>;
}

export interface ActWindowInfo extends CommonActionInfo {
  type: "act_window";
  view: string;
}

export type ActionInfo = ClientActionInfo | ActWindowInfo;
export type ActionStack = ActionInfo[];

export type ActionEvent = "action_stack_updated";

type Callback = (stack: ActionStack) => void;

export interface IActionManager {
  activate(): void;
  doAction(request: ActionRequest): void;
  on(event: ActionEvent, owner: any, callback: Callback): void;
  getStack(): ActionStack;
}

//------------------------------------------------------------------------------
// Action Manager
//------------------------------------------------------------------------------

export class ActionManager extends EventBus implements IActionManager {
  router: IRouter;
  registry: Registry;
  stack: ActionStack;

  constructor(router: IRouter, registry: Registry) {
    super();
    this.router = router;
    this.registry = registry;
    this.stack = [];
  }

  activate() {
    this.router.on("query_changed", this, this.update);
    this.update(this.router.getQuery());
  }
  doAction(request: ActionRequest) {
    if (typeof request === "number") {
      // this is an action ID
      let name = request === 1 ? "discuss" : "crm";
      let title = request === 1 ? "Discuss" : "CRM";
      let Widget = this.registry.getAction(name);
      this.stack = [
        {
          id: 1,
          context: {},
          target: "current",
          type: "client",
          name,
          title,
          Widget: Widget
        }
      ];
      this.trigger("action_stack_updated", this.stack);
    }
  }

  getStack(): ActionStack {
    return [];
  }

  update(query: Query) {
    if ("action_id" in query) {
      const actionID = parseInt(query.action_id);
      this.doAction(actionID);
    }
  }
}
