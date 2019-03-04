import { makeTestData, makeTestEnv, nextMicroTick } from "../helpers";

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("rpc", () => {
  test("properly translate query in route", async () => {
    expect.assertions(1);

    const store = makeTestEnv({
      mockRPC(route, params) {
        expect(route).toBe("/web/dataset/call_kw/test/hey");
        return this.rpc(route, params);
      }
    }).store;

    await store.rpc({ model: "test", method: "hey" });
  });

  test("trigger proper events", async () => {
    const store = makeTestEnv().store;
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
    const store = makeTestEnv().store;
    expect(store.state.notifications.length).toBe(0);
    const id = store.addNotification({
      title: "test",
      message: "message"
    });
    expect(store.state.notifications.length).toBe(1);
    expect(id).toBeDefined();
  });

  test("can close a notification", () => {
    const store = makeTestEnv().store;

    const id = store.addNotification({
      title: "test",
      message: "message"
    });
    expect(store.state.notifications.length).toBe(1);

    store.closeNotification(id);
    expect(store.state.notifications.length).toBe(0);
  });

  test("notifications closes themselves after a while", () => {
    jest.useFakeTimers();
    const store = makeTestEnv().store;

    store.addNotification({ title: "test", message: "message" });

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(store.state.notifications.length).toBe(1);
    jest.runAllTimers();
    expect(store.state.notifications.length).toBe(0);
  });

  test("sticky notifications do not close themselves after a while", () => {
    jest.useFakeTimers();
    const store = makeTestEnv().store;

    store.addNotification({
      title: "test",
      message: "message",
      sticky: true
    });

    expect(setTimeout).toHaveBeenCalledTimes(0);
    expect(store.state.notifications.length).toBe(1);
    jest.runAllTimers();
    expect(store.state.notifications.length).toBe(1);
  });
});

describe("state transitions", () => {
  test("toggle menu", async () => {
    const data = await makeTestData();
    const store = makeTestEnv(data).store;
    expect(store.state.inHome).toBe(true);
    store.toggleHomeMenu();

    // should still be in home menu since no app is currently active
    expect(store.state.inHome).toBe(true);
    expect(store.services.router.getQuery()).toEqual({ home: true });

    const promise = store.activateMenuItem(96);
    expect(store.services.router.getQuery()).toEqual({ home: true });

    await promise;
    store.lastAction!.activate();
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

  test("document title", async () => {
    document.title = "Odoo";
    const data = await makeTestData();
    const store = makeTestEnv(data).store;
    expect(store.state.inHome).toBe(true);
    expect(document.title).toBe("Odoo");
    const promise = store.activateMenuItem(96);
    expect(document.title).toBe("Odoo");
    await promise;
    store.lastAction!.activate();

    expect(document.title).toBe("Discuss - Odoo");

    store.toggleHomeMenu();

    expect(document.title).toBe("Discuss - Odoo");
  });
});
