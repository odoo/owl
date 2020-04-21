import { EventBus } from "../../src/core/event_bus";

describe("event bus behaviour", () => {
  test("can subscribe and be notified", () => {
    const bus = new EventBus();
    let notified = false;
    bus.on("event", {}, () => (notified = true));
    expect(notified).toBe(false);
    bus.trigger("event");
    expect(notified).toBe(true);
  });

  test("callbacks are called with proper 'this'", () => {
    expect.assertions(1);
    const bus = new EventBus();
    const owner = {};
    bus.on("event", owner, function (this: any) {
      expect(this).toBe(owner);
    });
    bus.trigger("event");
  });

  test("throw error if callback is undefined", () => {
    expect.assertions(1);
    const bus = new EventBus();
    expect(() => bus.on("event", {}, <any>undefined)).toThrow(`Missing callback`);
  });

  test("can unsubscribe", () => {
    const bus = new EventBus();
    let notified = false;
    let owner = {};
    bus.on("event", owner, () => (notified = true));
    bus.off("event", owner);
    bus.trigger("event");
    expect(notified).toBe(false);
  });

  test("arguments are properly propagated", () => {
    expect.assertions(1);
    const bus = new EventBus();
    bus.on("event", {}, (arg: any) => expect(arg).toBe("hello world"));
    bus.trigger("event", "hello world");
  });
});
