import { Plugin, signal } from "@odoo/owl";

export class NotificationPlugin extends Plugin {
  notifications = signal.Array([]);

  showNotification(title, description) {
    const id = Date.now();
    this.notifications().push({ id, title, description });
    setTimeout(() => this.removeNotification(id), 3000);
  }

  removeNotification(id) {
    const idx = this.notifications().findIndex((n) => n.id === id);
    if (idx !== -1) {
      this.notifications().splice(idx, 1);
    }
  }
}
