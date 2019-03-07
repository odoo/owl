import { Widget } from "../widget";

export class ListView extends Widget<{ info: any }, {}> {
  inlineTemplate = `<div>list view: <span t-esc="props.info"/></div>`;
}
