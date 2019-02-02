import {
  NotificationManager,
  INotification
} from "../../src/ts/core/notifications";

test("can subscribe and add notification", () => {
  let notifs: INotification[] = [];
  const notifications = new NotificationManager();
  notifications.on("notifications_updated", {}, n => (notifs = n));
  expect(notifs.length).toBe(0);
  const id = notifications.add({ title: "test", message: "message" });
  expect(notifs.length).toBe(1);
  expect(id).toBeDefined();
});

test("can close a notification", () => {
  let notifs: INotification[] = [];
  const notifications = new NotificationManager();
  notifications.on("notifications_updated", {}, n => (notifs = n));

  const id = notifications.add({ title: "test", message: "message" });
  expect(notifs.length).toBe(1);

  notifications.close(id);
  expect(notifs.length).toBe(0);
});

test("notifications closes themselves after a while", () => {
  jest.useFakeTimers();
  let notifs: INotification[] = [];
  const notifications = new NotificationManager();
  notifications.on("notifications_updated", {}, n => (notifs = n));

  notifications.add({ title: "test", message: "message" });

  expect(setTimeout).toHaveBeenCalledTimes(1);
  expect(notifs.length).toBe(1);
  jest.runAllTimers();
  expect(notifs.length).toBe(0);
});

test("sticky notifications do not close themselves after a while", () => {
  jest.useFakeTimers();
  let notifs: INotification[] = [];
  const notifications = new NotificationManager();
  notifications.on("notifications_updated", {}, n => (notifs = n));

  notifications.add({ title: "test", message: "message", sticky: true });

  expect(setTimeout).toHaveBeenCalledTimes(0);
  expect(notifs.length).toBe(1);
  jest.runAllTimers();
  expect(notifs.length).toBe(1);
});
