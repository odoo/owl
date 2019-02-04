import { INotification } from "../core/notifications";
import { Widget } from "./widget";

export class Notification extends Widget<INotification, {}> {
  template = "web.notification";

  close() {
    this.env.notifications.close(this.props.id);
  }
}
