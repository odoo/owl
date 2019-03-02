import { Registry } from "./core/registry";
import { ActionWidget } from "./store/store";
import { Discuss } from "./widgets/discuss";

export const actionRegistry: Registry<ActionWidget> = new Registry();

actionRegistry.add("mail.discuss", Discuss);
