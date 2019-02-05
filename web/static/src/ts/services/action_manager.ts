import { Type } from "../core/component";
import { EventBus } from "../core/event_bus";
import { Registry } from "../core/registry";
import { Widget } from "../widgets/widget";

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
  registry: Registry<ActionWidget>;
  stack: ActionStack;

  constructor(registry: Registry<ActionWidget>) {
    super();
    this.registry = registry;
    this.stack = [];
  }

  doAction(request: ActionRequest) {
    console.log("doaction", request);
    if (typeof request === "number") {
      // this is an action ID
      let name = request === 131 ? "discuss" : "crm";
      let title =
        request === 131 ? "Discuss" : request === 250 ? "Notes" : "CRM";
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
