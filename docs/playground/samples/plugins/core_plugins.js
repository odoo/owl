import { Plugin, plugin, signal} from "@odoo/owl";

// a plugin is just a subclass of the Plugin class
export class NotificationPlugin extends Plugin {
    notify(message) {
        // simulate something like displaying a notification popover
        console.log(`Notify: ${message}`);
    }
}

export class ThemePlugin extends Plugin {
    // plugins can be imported in plugins
    notificationPlugin = plugin(NotificationPlugin);
    theme = signal("light");

    toggle() {
        this.theme.set(this.theme() === "light" ? "dark" : "light");
        // this call a method on another plugin
        this.notificationPlugin.notify("theme changed")
    }
}

export const corePlugins = [NotificationPlugin, ThemePlugin];