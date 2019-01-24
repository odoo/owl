import { CRM } from "../widgets/crm";
import { Discuss } from "../widgets/discuss";
import { Widget } from "../core/widget";
import { Env } from "../env";

interface Type<T> extends Function {
  new (...args: any[]): T;
}

export interface Action {
  id: number;
  title: string;
  Widget: Type<Widget<Env>>;
  default?: boolean;
}

export const actions: Action[] = [
  { id: 1, title: "Discuss", Widget: Discuss, default: true },
  { id: 2, title: "CRM", Widget: CRM }
];

// class ActionManager {

//   doAction(action: Action) {

//   }
// }
