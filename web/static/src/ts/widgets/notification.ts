import { INotification } from "../core/notifications";
import { Widget } from "./widget";

export class Notification extends Widget<INotification, {}> {
  template = "web.notification";

  close(ev: MouseEvent) {
    // we do not want the url to change
    ev.preventDefault();
    this.env.notifications.close(this.props.id);
  }
}
