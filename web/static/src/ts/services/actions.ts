import CRM from "../widgets/CRM";
import Discuss from "../widgets/Discuss";
import Widget from "../core/Widget";

export interface Action {
  id: number;
  title: string;
  Widget: typeof Widget;
  default?: boolean;
}

const actions: Action[] = [
  { id: 1, title: "Discuss", Widget: Discuss, default: true },
  { id: 2, title: "CRM", Widget: CRM }
];

export default actions;
