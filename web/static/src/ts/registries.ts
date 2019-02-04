import { Registry } from "./core/registry";
import { ActionWidget } from "./services/action_manager";

export const actionRegistry: Registry<ActionWidget> = new Registry();
