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

export interface INotificationManager {
  add(notif: Partial<INotification>): number;
  close(id: number): void;
  on(
    event: "notification_added",
    owner: any,
    callback: (notif: INotification) => void
  ): void;
  on(
    event: "notification_closed",
    owner: any,
    callback: (id: number) => void
  ): void;
}

//------------------------------------------------------------------------------
// Notification Manager
//------------------------------------------------------------------------------

export class NotificationManager extends Bus implements INotificationManager {
  nextID = 1;

  add(notif: Partial<INotification>): number {
    const id = this.nextID++;
    const defaultVals = {
      title: "",
      message: "",
      type: "notification",
      sticky: false
    };
    const notification = Object.assign(defaultVals, notif, { id });
    this.trigger("notification_added", notification);
    if (!notification.sticky) {
      setTimeout(() => this.close(id), 2500);
    }
    return id;
  }
  close(id: number) {
    this.trigger("notification_closed", id);
  }
}
