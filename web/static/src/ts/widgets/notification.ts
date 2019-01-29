import { Widget } from "../core/widget";
import { Env } from "../env";
import { INotification } from "../services/notifications";

const template = `
    <div class="o_notification">
        <a t-if="props.sticky" class="fa fa-times o_close" href="#" title="Close" aria-label="Close" t-on-click="close"/>
        <div class="o_notification_title">
            <t t-raw="props.title"/>
        </div>
        <div class="o_notification_content" t-if="props.message.length">
            <t t-raw="props.message"/>
        </div>

    </div>`;

export class Notification extends Widget<Env, INotification> {
  name = "notification";
  template = template;

  close() {
    this.env.notifications.close(this.props.id);
  }
}
