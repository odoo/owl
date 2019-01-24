import Bus from "../src/ts/core/bus";

describe("event bus behaviour", () => {
  test("can subscribe and be notified", () => {
    const bus = new Bus();
    let notified = false;
    bus.on("event", {}, () => (notified = true));
    expect(notified).toBe(false);
    bus.trigger("event");
    expect(notified).toBe(true);
  });

  test("can unsubscribe", () => {
    const bus = new Bus();
    let notified = false;
    let owner = {};
    bus.on("event", owner, () => (notified = true));
    bus.off("event", owner);
    bus.trigger("event");
    expect(notified).toBe(false);
  });

  test("arguments are properly propagated", () => {
    expect.assertions(1);
    const bus = new Bus();
    bus.on("event", {}, (arg: any) => expect(arg).toBe("hello world"));
    bus.trigger("event", "hello world");
  });
});
