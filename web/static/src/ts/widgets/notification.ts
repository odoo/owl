import { INotification } from "../store/store";
import { Widget } from "./widget";

export class Notification extends Widget<INotification, {}> {
  template = "web.notification";

  close(ev: MouseEvent) {
    // we do not want the url to change
    ev.preventDefault();
    this.env.closeNotification(this.props.id);
  }
}
