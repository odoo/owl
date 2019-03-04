import { makeTestStore, mockFetch } from "../helpers";

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("does not reload action if already done", async () => {
  const routes: string[] = [];
  const store = makeTestStore({
    rpc: async (route, params) => {
      routes.push(route);
      return mockFetch(route, params);
    }
  });
  expect(routes).toEqual([]);

  store.doAction(131);

  expect(routes).toEqual(["web/action/load"]);

  store.doAction(131);

  expect(routes).toEqual(["web/action/load"]);
});
