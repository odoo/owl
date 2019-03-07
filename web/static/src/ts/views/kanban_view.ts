import { Widget } from "../widget";

export class KanbanView extends Widget<{ info: any }, {}> {
  inlineTemplate = `<div>kanban view: <span t-esc="props.info"/></div>`;
}
