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

export type NotificationEvent = "notification_added" | "notification_removed";

export type Callback = (notif: INotification) => void;

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
  notifications: { [key: number]: INotification } = {};

  add(notif: Partial<INotification>): number {
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
    if (!notification.sticky) {
      setTimeout(() => this.close(id), 2500);
    }
    return id;
  }
  close(id: number) {
    let notification = this.notifications[id];
    if (notification) {
      delete this.notifications[id];
      this.trigger("notification_removed", notification);
    }
  }
}
