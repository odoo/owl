import { Registry } from "./core/registry";
import { ControllerWidget } from "./store/store";
import { Discuss } from "./discuss/discuss";
import { ListView } from "./views/list_view";
import { KanbanView } from "./views/kanban_view";
import { FormView } from "./views/form_view";

//------------------------------------------------------------------------------
// Views
//------------------------------------------------------------------------------

export const viewRegistry: Registry<ControllerWidget> = new Registry();

viewRegistry
  .add("list", ListView)
  .add("kanban", KanbanView)
  .add("form", FormView);

//------------------------------------------------------------------------------
// Client Actions
//------------------------------------------------------------------------------

export const actionRegistry: Registry<ControllerWidget> = new Registry();

actionRegistry.add("mail.discuss", Discuss);
