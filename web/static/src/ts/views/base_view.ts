import { Widget } from "../widget";
import { ControlPanel } from "../ui/control_panel";

export class BaseView extends Widget<{ info: any }, {}> {
  template = "web.base_view";
  widgets = { ControlPanel };
}
