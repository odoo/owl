import { EventBus } from "../core/event_bus";
import { Registry } from "../core/registry";
import { Type, Widget } from "../core/widget";
import { Env } from "../env";

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
  doAction(request: ActionRequest): void;
  on(event: ActionEvent, owner: any, callback: Callback): void;
  getStack(): ActionStack;
}

//------------------------------------------------------------------------------
// Action Manager
//------------------------------------------------------------------------------

export class ActionManager extends EventBus implements IActionManager {
  registry: Registry<Type<Widget<Env, any>>>;
  stack: ActionStack;

  constructor(registry: Registry<Type<Widget<Env, any>>>) {
    super();
    this.registry = registry;
    this.stack = [];
  }

  doAction(request: ActionRequest) {
    if (typeof request === "number") {
      // this is an action ID
      let name = request === 1 ? "discuss" : "crm";
      let title = request === 1 ? "Discuss" : "CRM";
      let Widget = this.registry.get(name);
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
}
