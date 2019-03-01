import { makeTestStore } from "../helpers";

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("does not reload action if already done", async () => {
  const routes: string[] = [];
  const store = makeTestStore({ rpc: async route => routes.push(route) });
  expect(routes).toEqual([]);

  store.doAction(32);

  expect(routes).toEqual(["web/action/load"]);

  store.doAction(32);

  expect(routes).toEqual(["web/action/load"]);
});
