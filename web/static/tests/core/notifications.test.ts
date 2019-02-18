import { NotificationManager } from "../../src/ts/store/notifications";

test("can subscribe and add notification", () => {
  let n = 0;
  const notifications = new NotificationManager();
  notifications.on("notification_added", null, () => n++);
  notifications.on("notification_closed", null, () => n--);
  expect(n).toBe(0);
  const id = notifications.add({ title: "test", message: "message" });
  expect(n).toBe(1);
  expect(id).toBeDefined();
});

test("can close a notification", () => {
  let n = 0;
  const notifications = new NotificationManager();
  notifications.on("notification_added", null, () => n++);
  notifications.on("notification_closed", null, () => n--);

  const id = notifications.add({ title: "test", message: "message" });
  expect(n).toBe(1);

  notifications.close(id);
  expect(n).toBe(0);
});

test("notifications closes themselves after a while", () => {
  jest.useFakeTimers();
  let n = 0;
  const notifications = new NotificationManager();
  notifications.on("notification_added", null, () => n++);
  notifications.on("notification_closed", null, () => n--);

  notifications.add({ title: "test", message: "message" });

  expect(setTimeout).toHaveBeenCalledTimes(1);
  expect(n).toBe(1);
  jest.runAllTimers();
  expect(n).toBe(0);
});

test("sticky notifications do not close themselves after a while", () => {
  jest.useFakeTimers();
  let n = 0;
  const notifications = new NotificationManager();
  notifications.on("notification_added", null, () => n++);
  notifications.on("notification_closed", null, () => n--);

  notifications.add({ title: "test", message: "message", sticky: true });

  expect(setTimeout).toHaveBeenCalledTimes(0);
  expect(n).toBe(1);
  jest.runAllTimers();
  expect(n).toBe(1);
});
