import { Ajax } from "../../src/ts/services/ajax";
import { nextMicroTick } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

function mockFetch(route: string, params: any): Promise<any> {
  return Promise.resolve(`${route}`);
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("parameters conversion", () => {
  test("properly translate query in route", async () => {
    const ajax = new Ajax(mockFetch);
    const result = await ajax.rpc({ model: "test", method: "hey" });
    expect(result).toBe("/web/dataset/call_kw/test/hey");
  });
});

describe("event and status", () => {
  test("trigger proper events", async () => {
    const ajax = new Ajax(mockFetch);
    const events: string[] = [];
    ajax.on("rpc_status", null, s => {
      events.push(s);
    });
    expect(events).toEqual([]);
    ajax.rpc({ model: "test", method: "hey" });
    expect(events).toEqual(["loading"]);
    await nextMicroTick();
    expect(events).toEqual(["loading", "notloading"]);
  });
});
