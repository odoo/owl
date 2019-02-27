import { Registry } from "./core/registry";
import { ActionWidget } from "./store/store";
import { CRM } from "./widgets/crm";
import { Discuss } from "./widgets/discuss";

export const actionRegistry: Registry<ActionWidget> = new Registry();

actionRegistry.add("discuss", Discuss).add("crm", CRM);
