import { Type } from "../core/component";
import { BaseStore } from "./store";

//------------------------------------------------------------------------------
// Notifications Mixin
//------------------------------------------------------------------------------
export interface INotification {
  id: number;
  title: string;
  message: string;
  type: "notification" | "warning";
  sticky: boolean;
}

export function notificationMixin<T extends Type<BaseStore>>(Base: T) {
  return class extends Base {
    addNotification(notif: Partial<INotification>): number {
      const id = this.generateID();
      const defaultVals = {
        title: "",
        message: "",
        type: "notification",
        sticky: false
      };
      const notification = Object.assign(defaultVals, notif, { id });
      this.trigger("notification_added", notification);
      if (!notification.sticky) {
        setTimeout(() => this.closeNotification(id), 2500);
      }
      return id;
    }

    closeNotification(id: number) {
      this.trigger("notification_closed", id);
    }
  };
}
