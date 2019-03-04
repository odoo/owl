import { makeTestData, makeTestEnv } from "../helpers";
import { Registry } from "../../src/ts/core/registry";

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("does not reload action if already done", async () => {
  const routes: string[] = [];
  const data = await makeTestData();
  const testEnv = makeTestEnv({
    ...data,
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
  const data = await makeTestData();
  data.actionRegistry = new Registry();
  const testEnv = makeTestEnv(data);

  await testEnv.store.doAction(131);

  const notifs = testEnv.store.state.notifications;
  expect(notifs.length).toBe(1);
  expect(notifs[0].type).toBe("warning");
});
