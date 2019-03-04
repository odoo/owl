import { Widget } from "../widget";

export class View extends Widget<{}, { info: any }> {
  inlineTemplate = `<div>some view: <span t-esc="props.info"/></div>`;
}
