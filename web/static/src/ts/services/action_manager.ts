import { Bus } from "../core/bus";
import { Widget } from "../core/widget";
import { Env } from "../env";
import { Router, Query } from "./router";
import { Discuss } from "../widgets/discuss";
import { CRM } from "../widgets/crm";

interface Type<T> extends Function {
  new (...args: any[]): T;
}

interface ClientAction {
  type: "client";
  name: string;
}

interface ActWindowAction {
  type: "act_window";
  views: string[];
}

export type Action = ClientAction | ActWindowAction;

export interface ActionWidget {
  id: number;
  Widget: Type<Widget<Env>>;
  props: any;
}

const actions: any[] = [
  { id: 1, title: "Discuss", Widget: Discuss, default: true },
  { id: 2, title: "CRM", Widget: CRM }
];

export class ActionManager extends Bus {
  router: Router;
  currentAction: ActionWidget | null = null;

  constructor(router: Router) {
    super();
    this.router = router;
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
