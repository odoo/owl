import { Component, plugin } from "@odoo/owl";
import { Navbar } from "./navbar";
import { NotificationContainer } from "../core/notification_container";
import { NotificationPlugin } from "../core/notification_plugin";

export class WebClient extends Component {
  static template = "demo.WebClient";
  static components = { Navbar, NotificationContainer };
  notificationPlugin = plugin(NotificationPlugin);

  testNotification() {
    this.notificationPlugin.showNotification("Test", "This is a test notification");
  }
}
