import { Registry } from "../../src/ts/core/registry";
import { makeTestEnv } from "../helpers";

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("does not reload action if already done", async () => {
  const routes: string[] = [];
  const testEnv = makeTestEnv({
    mockRPC(route, params) {
      routes.push(route);
      return this.rpc(route, params);
    }
  });

  expect(routes).toEqual([]);

  testEnv.store.doAction(131);

  expect(routes).toEqual(["web/action/load"]);

  testEnv.store.doAction(131);

  expect(routes).toEqual(["web/action/load"]);
});

test("display a warning if client action is not in registry", async () => {
  const testEnv = makeTestEnv({ actionRegistry: new Registry() });

  await testEnv.store.doAction(131);

  const notifs = testEnv.store.state.notifications;
  expect(notifs.length).toBe(1);
  expect(notifs[0].type).toBe("warning");
});

test("display a warning if view is not in registry", async () => {
  const testEnv = makeTestEnv({ viewRegistry: new Registry() });

  await testEnv.store.doAction(250);

  const notifs = testEnv.store.state.notifications;
  expect(notifs.length).toBe(1);
  expect(notifs[0].type).toBe("warning");
});
