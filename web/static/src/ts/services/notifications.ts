import { EventBus as Bus } from "../core/event_bus";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface INotification {
  id: number;
  title: string;
  message: string;
  type: "notification" | "warning";
  sticky: boolean;
}

export type NotificationEvent = "notifications_updated";

export type Callback = (notifs: INotification[]) => void;

export interface INotificationManager {
  add(notif: Partial<INotification>): number;
  close(id: number): void;
  on(event: NotificationEvent, owner: any, callback: Callback): void;
}

//------------------------------------------------------------------------------
// Notification Manager
//------------------------------------------------------------------------------

export class NotificationManager extends Bus implements INotificationManager {
  nextID = 1;
  notifications: INotification[] = [];

  add(notif: Partial<INotification>): number {
    const id = this.nextID++;
    const defaultVals = {
      title: "",
      message: "",
      type: "notification",
      sticky: false
    };
    const notification = Object.assign(defaultVals, notif, { id });
    this.notifications.push(notification);
    this.trigger("notifications_updated", this.notifications);
    if (!notification.sticky) {
      setTimeout(() => this.close(id), 2500);
    }
    return id;
  }
  close(id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.trigger("notifications_updated", this.notifications);
  }
}
