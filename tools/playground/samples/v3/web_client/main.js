import { mount } from "@odoo/owl";
import { WebClient } from "./web_client/web_client.js";
import { NotificationPlugin } from "./core/notification_plugin.js";
import { MenuPlugin } from "./web_client/menu_plugin.js";

mount(WebClient, document.body, {
  templates: TEMPLATES,
  plugins: [NotificationPlugin, MenuPlugin],
  dev: true,
});
