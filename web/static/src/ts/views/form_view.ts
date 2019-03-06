import { Widget } from "../widget";

export class FormView extends Widget<{}, { info: any }> {
  inlineTemplate = `<div>form view: <span t-esc="props.info"/></div>`;
}
