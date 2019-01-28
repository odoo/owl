import { Callback, EventBus } from "../core/event_bus";
import { Widget } from "../core/widget";
import { Env } from "../env";
import { Registry } from "../registry";
import { Type } from "../types";
import { CRM } from "../widgets/crm";
import { Discuss } from "../widgets/discuss";
import { IRouter, Query } from "./router";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface ClientAction {
  type: "client";
  name: string;
}

export interface ActWindowAction {
  type: "act_window";
  views: string[];
}

export type ActionEvent = "action_ready";

export interface IActionManager {
  doAction(actionID: number): void;
  on(event: ActionEvent, owner: any, callback: Callback): void;
  getCurrentAction(): ActionWidget | null;
}

export type Action = ClientAction | ActWindowAction;

export interface ActionWidget {
  id: number;
  Widget: Type<Widget<Env, {}>>;
  props: any;
}

const actions: any[] = [
  { id: 1, title: "Discuss", Widget: Discuss, default: true },
  { id: 2, title: "CRM", Widget: CRM }
];

//------------------------------------------------------------------------------
// Action Manager
//------------------------------------------------------------------------------

export class ActionManager extends EventBus implements IActionManager {
  router: IRouter;
  registry: Registry;
  currentAction: ActionWidget | null = null;

  constructor(router: IRouter, registry: Registry) {
    super();
    this.router = router;
    this.registry = registry;
    const query = this.router.getQuery();
    this.update(query);
    this.router.on("query_changed", this, this.update);
    if (!this.currentAction) {
      const action = actions.find(a => a.default);
      if (action) {
        this.doAction(action.id);
      }
    }
  }

  update(query: Query) {
    const initialAction = this.currentAction;
    if ("action_id" in query) {
      const actionID = parseInt(query.action_id);
      this.doAction(actionID);
    }
    if (this.currentAction && initialAction !== this.currentAction) {
    }
  }

  doAction(actionID: number) {
    const action = actions.find(a => a.id === actionID);
    if (action) {
      this.currentAction = {
        id: action.id,
        Widget: action.Widget,
        props: {}
      };
    }
    this.trigger("action_ready", this.currentAction);
    this.router.navigate({ action_id: String(actionID) });
  }

  registerAction(action: Action) {}

  getCurrentAction(): ActionWidget | null {
    return this.currentAction;
  }
}
