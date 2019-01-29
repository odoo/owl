import { EventBus as Bus } from "../core/event_bus";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "notification" | "warning";
  sticky: boolean;
}

export type NotificationEvent = "notification_added" | "notification_closed";

export type Callback = (notif: Notification) => void;

export interface INotificationManager {
  add(notif: Partial<Notification>): number;
  close(id: number): void;
  on(event: NotificationEvent, owner: any, callback: Callback): void;
}

//------------------------------------------------------------------------------
// Notification Manager
//------------------------------------------------------------------------------
export class NotificationManager extends Bus implements INotificationManager {
  nextID = 0;
  notifications: { [key: number]: Notification } = {};

  add(notif: Partial<Notification>): number {
    const id = this.nextID++;
    const defaultVals = {
      title: "",
      message: "",
      type: "notification",
      sticky: false
    };
    const notification = Object.assign(defaultVals, notif, { id });
    this.notifications[id] = notification;
    this.trigger("notification_added", notification);
    return id;
  }
  close(id: number) {
    let notification = this.notifications[id];
    if (notification) {
      delete this.notifications[id];
      this.trigger("notification_closed", notification);
    }
  }
}
