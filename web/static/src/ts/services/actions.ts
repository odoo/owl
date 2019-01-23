import CRM from "../widgets/crm";
import Discuss from "../widgets/discuss";
import Widget from "../core/widget";
import { Env, Type } from "../types";



export interface Action {
  id: number;
  title: string;
  Widget: Type<Widget<Env>>;
  default?: boolean;
}

const actions: Action[] = [
  { id: 1, title: "Discuss", Widget: Discuss, default: true },
  { id: 2, title: "CRM", Widget: CRM }
];

export default actions;

