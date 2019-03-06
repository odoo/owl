import { Registry } from "./core/registry";
import { ControllerWidget } from "./store/store";
import { Discuss } from "./discuss/discuss";

export const actionRegistry: Registry<ControllerWidget> = new Registry();

actionRegistry.add("mail.discuss", Discuss);
