import { makeTestStore, nextMicroTick } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

function mockFetch(route: string, params: any): Promise<any> {
  return Promise.resolve(`${route}`);
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("rpc", () => {
  test("properly translate query in route", async () => {
    const store = makeTestStore({ rpc: mockFetch });
    const result = await store.rpc({ model: "test", method: "hey" });
    expect(result).toBe("/web/dataset/call_kw/test/hey");
  });

  test("trigger proper events", async () => {
    const store = makeTestStore({ rpc: mockFetch });
    const events: string[] = [];
    store.on("rpc_status", null, s => {
      events.push(s);
    });
    expect(events).toEqual([]);
    store.rpc({ model: "test", method: "hey" });
    expect(events).toEqual(["loading"]);
    await nextMicroTick();
    expect(events).toEqual(["loading", "notloading"]);
  });
});

describe("notifications", () => {
  test("can subscribe and add notification", () => {
    let n = 0;
    const store = makeTestStore();
    store.on("notification_added", null, () => n++);
    store.on("notification_closed", null, () => n--);
    expect(n).toBe(0);
    const id = store.addNotification({
      title: "test",
      message: "message"
    });
    expect(n).toBe(1);
    expect(id).toBeDefined();
  });

  test("can close a notification", () => {
    let n = 0;
    const store = makeTestStore();
    store.on("notification_added", null, () => n++);
    store.on("notification_closed", null, () => n--);

    const id = store.addNotification({
      title: "test",
      message: "message"
    });
    expect(n).toBe(1);

    store.closeNotification(id);
    expect(n).toBe(0);
  });

  test("notifications closes themselves after a while", () => {
    jest.useFakeTimers();
    let n = 0;
    const store = makeTestStore();
    store.on("notification_added", null, () => n++);
    store.on("notification_closed", null, () => n--);

    store.addNotification({ title: "test", message: "message" });

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(n).toBe(1);
    jest.runAllTimers();
    expect(n).toBe(0);
  });

  test("sticky notifications do not close themselves after a while", () => {
    jest.useFakeTimers();
    let n = 0;
    const store = makeTestStore();
    store.on("notification_added", null, () => n++);
    store.on("notification_closed", null, () => n--);

    store.addNotification({
      title: "test",
      message: "message",
      sticky: true
    });

    expect(setTimeout).toHaveBeenCalledTimes(0);
    expect(n).toBe(1);
    jest.runAllTimers();
    expect(n).toBe(1);
  });
});

describe("state transitions", () => {
  test("toggle menu", async () => {
    const store = makeTestStore();
    expect(store.state.inHome).toBe(true);
    store.toggleHomeMenu();

    // should still be in home menu since no app is currently active
    expect(store.state.inHome).toBe(true);
    expect(store.services.router.getQuery()).toEqual({ home: true });

    const promise = store.activateMenuItem(96);
    expect(store.services.router.getQuery()).toEqual({ home: true });

    await promise;
    expect(store.state.inHome).toBe(false);
    expect(store.services.router.getQuery()).toEqual({
      action_id: "131",
      menu_id: "96"
    });

    store.toggleHomeMenu();
    expect(store.state.inHome).toBe(true);
    expect(store.services.router.getQuery()).toEqual({ home: true });
    store.toggleHomeMenu();
    expect(store.state.inHome).toBe(false);
    expect(store.services.router.getQuery()).toEqual({
      action_id: "131",
      menu_id: "96"
    });
  });
});
