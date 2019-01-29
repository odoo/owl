import {
  NotificationManager,
  INotification,
  INotificationManager
} from "../../src/ts/services/notifications";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

function makeNotification(notif: Partial<INotification> = {}): INotification {
  const defaultNotif = {
    id: 1,
    title: "title",
    message: "message",
    type: "notification",
    sticky: false
  };
  return Object.assign(defaultNotif, notif);
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can subscribe and add notification", () => {
  let notified = false;
  const notifications = new NotificationManager();
  notifications.on("notification_added", {}, () => (notified = true));
  expect(notified).toBe(false);
  const id = notifications.add(makeNotification());
  expect(notified).toBe(true);
  expect(id).toBeDefined();
});

test("can close a notification", () => {
  const notifications: INotificationManager = new NotificationManager();
  let notified = false;
  notifications.on("notification_removed", {}, () => (notified = true));

  const id = notifications.add(makeNotification());
  expect(notified).toBe(false);

  notifications.close(id);
  expect(notified).toBe(true);
});

test("notifications closes themselves after a while", () => {
  jest.useFakeTimers();
  const notifications: INotificationManager = new NotificationManager();
  let removed = false;
  notifications.on("notification_removed", {}, () => (removed = true));

  notifications.add(makeNotification());

  expect(setTimeout).toHaveBeenCalledTimes(1);
  expect(removed).toBe(false);
  jest.runAllTimers();
  expect(removed).toBe(true);
});

test("sticky notifications do not close themselves after a while", () => {
  jest.useFakeTimers();
  const notifications: INotificationManager = new NotificationManager();
  let removed = false;
  notifications.on("notification_removed", {}, () => (removed = true));

  notifications.add(makeNotification({ sticky: true }));

  expect(setTimeout).toHaveBeenCalledTimes(0);
  expect(removed).toBe(false);
  jest.runAllTimers();
  expect(removed).toBe(false);
});
