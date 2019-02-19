import { INotification } from "../store";
import { Widget } from "./widget";

export class Notification extends Widget<INotification, {}> {
  template = "web.notification";

  close(ev: MouseEvent) {
    // we do not want the url to change
    ev.preventDefault();
    this.env.dispatch("close_notification", this.props.id);
  }
}
