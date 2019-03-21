import { Store } from "../src/store";
import { nextMicroTick } from "./helpers";

describe("basic use", () => {
  test("commit a mutation", () => {
    const state = { n: 1 };
    const mutations = {
      inc(state, delta) {
        state.n += delta;
      }
    };
    const store = new Store({ state, mutations });

    expect(store.state.n).toBe(1);
    store.commit("inc", 14);
    expect(store.state.n).toBe(15);
  });

  test("dispatch an action", () => {
    const state = { n: 1 };
    const mutations = {
      inc(state, delta) {
        state.n += delta;
      }
    };
    const actions = {
      inc({ commit }, delta) {
        commit("inc", delta);
      }
    };
    const store = new Store({ state, mutations, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("inc", 14);
    expect(store.state.n).toBe(15);
  });

  test("multiple commits trigger one update", async () => {
    let updateCounter = 0;
    const state = { n: 1 };
    const mutations = {
      inc(state, delta) {
        state.n += delta;
      }
    };
    const store = new Store({ state, mutations });
    store.on("update", null, () => updateCounter++);

    store.commit("inc", 14);
    expect(updateCounter).toBe(0);
    store.commit("inc", 50);
    expect(updateCounter).toBe(0);
    await nextMicroTick();
    expect(updateCounter).toBe(1);
  });
});
