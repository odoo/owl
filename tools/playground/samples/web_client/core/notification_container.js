import { Component, plugin, xml } from "@odoo/owl";
import { NotificationPlugin } from "./notification_plugin";

export class NotificationContainer extends Component {
  static template = xml`
        <t t-if="this.notificationPlugin.notifications().length">
            <div class="notification-container">
                <t t-foreach="this.notificationPlugin.notifications()" t-as="notif" t-key="notif.id">
                    <div class="notification">
                        <div class="notification-title" t-out="notif.title"/>
                        <div class="notification-description" t-out="notif.description"/>
                    </div>
                </t>
            </div>
        </t>
    `;
  notificationPlugin = plugin(NotificationPlugin);
}
