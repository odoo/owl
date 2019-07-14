import { Env } from "../../src/component/component";
import { Store } from "../../src/store/store";
import { nextMicroTick, nextTick } from "../helpers";


describe("basic use", () => {
  test("commit a mutation", () => {
    const state = { n: 1 };
    const mutations = {
      inc({ state }, delta) {
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
      inc({ state }, delta) {
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

  test("dispatch an action + commit a mutation with positional arguments", () => {
    const state = { n1: 1, n2: 1, n3: 1 };
    const mutations = {
      batchInc({ state }, delta1, delta2, delta3) {
        state.n1 += delta1;
        state.n2 += delta2;
        state.n3 += delta3;
      }
    };
    const actions = {
      batchInc({ commit }, delta1, delta2, delta3) {
        commit("batchInc", delta1, delta2, delta3);
      }
    };
    const store = new Store({ state, mutations, actions });

    expect(store.state.n1).toBe(1);
    expect(store.state.n2).toBe(1);
    expect(store.state.n3).toBe(1);
    store.dispatch("batchInc", 14, 30, 88);
    expect(store.state.n1).toBe(15);
    expect(store.state.n2).toBe(31);
    expect(store.state.n3).toBe(89);
  });

  test("modifying state outside of mutations trigger error", () => {
    const state = { n: 1 };
    const actions = {
      inc({ state }) {
        state.n++;
      }
    };
    const store = new Store({ state, mutations: {}, actions });

    expect(() => store.dispatch("inc")).toThrow();
    expect(() => (store.state.n = 15)).toThrow();
  });

  test("can dispatch an action in an action", () => {
    const state = { n: 1 };
    const mutations = {
      inc({ state }, delta) {
        state.n += delta;
      }
    };
    const actions = {
      inc({ commit }, delta) {
        commit("inc", delta);
      },
      inc100({ dispatch }) {
        dispatch("inc", 100);
      }
    };
    const store = new Store({ state, mutations, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("inc100");
    expect(store.state.n).toBe(101);
  });

  test("can commit a mutation in a mutation", () => {
    const state = { n: 1 };
    const mutations = {
      inc({ state }) {
        state.n++;
      },
      inc10({ commit }) {
        for (let i = 0; i < 10; i++) {
          commit("inc");
        }
      }
    };
    const store = new Store({ state, mutations });

    expect(store.state.n).toBe(1);
    store.commit("inc10");
    expect(store.state.n).toBe(11);
  });

  test("return data from committing a mutation", () => {
    const state = { n: 1 };
    const mutations = {
      inc({ state }) {
        return ++state.n;
      }
    };
    const store = new Store({ state, mutations });

    expect(store.state.n).toBe(1);
    const res = store.commit("inc");
    expect(store.state.n).toBe(2);
    expect(res).toBe(2);
  });

  test("dispatch allow synchronizing between actions", async () => {
    const state = { n: 1 };
    const mutations = {
      inc({ state }, delta) {
        state.n += delta;
      },
      setN({ state }, n) {
        state.n = n;
      }
    };
    const actions = {
      async dosomething({ commit, dispatch }) {
        await dispatch("setTo10");
        commit("inc", 3);
      },
      async setTo10({ commit }) {
        await Promise.resolve();
        commit("setN", 10);
      }
    };
    const store = new Store({ state, mutations, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("dosomething");
    expect(store.state.n).toBe(1);
    await nextTick();
    expect(store.state.n).toBe(13);
  });

  test("env is given to actions", () => {
    expect.assertions(1);
    const someEnv = <Env>{};
    const actions = {
      someaction({ env }) {
        expect(env).toBe(someEnv);
      }
    };
    const store = new Store({ state: {}, actions, env: someEnv });

    store.dispatch("someaction");
  });

  test("can have getters from store", async () => {
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1
        }
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron"
        }
      }
    };
    const getters = {
      beerTasterName({ state }, beerID) {
        return state.tasters[state.beers[beerID].tasterID].name;
      },
      bestBeerName({ state }) {
        return state.beers[1].name;
      }
    };
    const store = new Store({ state, mutations: {}, actions: {}, getters });
    expect(store.getters).toBeDefined();
    expect((<any>store.getters).bestBeerName()).toBe("bertinchamps");
    expect((<any>store.getters).beerTasterName(1)).toBe("aaron");
  });

  test("getters are memoized", async () => {
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1
        }
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron"
        }
      }
    };
    let n = 0;
    const getters = {
      beerTasterName({ state }, beerID) {
        n++;
        return state.tasters[state.beers[beerID].tasterID].name;
      },
      bestBeerName({ state }) {
        n++;
        return state.beers[1].name;
      }
    };
    const store = new Store({ state, mutations: {}, actions: {}, getters });
    expect((<any>store.getters).bestBeerName()).toBe("bertinchamps");
    expect((<any>store.getters).beerTasterName(1)).toBe("aaron");
    expect(n).toBe(2);
    expect((<any>store.getters).bestBeerName()).toBe("bertinchamps");
    expect((<any>store.getters).beerTasterName(1)).toBe("aaron");
    expect(n).toBe(2);
  });

  test("getters taking Array as argument aren't memoized", async () => {
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1
        }
      }
    };
    let n = 0;
    const getters = {
      getBeerNames({ state }, beerIDs) {
        n++;
        return beerIDs.map(beerID => {
          return state.beers[beerID].name;
        });
      }
    };
    const store = new Store({ state, mutations: {}, actions: {}, getters });
    expect((<any>store.getters).getBeerNames([1])).toEqual(["bertinchamps"]);
    expect(n).toBe(1);
    expect((<any>store.getters).getBeerNames([1])).toEqual(["bertinchamps"]);
    expect(n).toBe(2);
  });

  test("getters cache is nuked on store changes", async () => {
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1
        }
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron"
        },
        2: {
          id: 2,
          name: "gery"
        }
      }
    };
    const mutations = {
      changeTaster({ state }, { beerID, tasterID }) {
        state.beers[beerID].tasterID = tasterID;
      }
    };
    let n = 0;
    const getters = {
      beerTasterName({ state }, beerID) {
        n++;
        return state.tasters[state.beers[beerID].tasterID].name;
      }
    };
    const store = new Store({
      state,
      mutations: mutations,
      actions: {},
      getters
    });
    expect((<any>store.getters).beerTasterName(1)).toBe("aaron");
    expect(n).toBe(1);
    expect((<any>store.getters).beerTasterName(1)).toBe("aaron");
    expect(n).toBe(1);

    store.commit("changeTaster", { beerID: 1, tasterID: 2 });
    await nextTick();

    expect((<any>store.getters).beerTasterName(1)).toBe("gery");
    expect(n).toBe(2);
  });

  test("getters cache is disabled during a mutation", async () => {
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps"
        }
      }
    };
    const mutations = {
      renameBeer({ state, getters }, beerID) {
        expect(getters.beerName(beerID)).toBe("bertinchamps");
        state.beers[1].name = "chouffe";
        expect(getters.beerName(beerID)).toBe("chouffe");
      }
    };
    let n = 0;
    const getters = {
      beerName({ state }, beerID) {
        n++;
        return state.beers[beerID].name;
      }
    };
    const store = new Store({
      state,
      mutations: mutations,
      actions: {},
      getters
    });

    store.commit("renameBeer", 1);
    expect((<any>store.getters).beerName(1)).toBe("chouffe");
    await nextTick();

    expect(n).toBe(3);
  });

  test("getters given to actions", async () => {
    expect.assertions(3);
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1
        }
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron"
        }
      }
    };
    const getters = {
      beerTasterName({ state }, beerID) {
        return state.tasters[state.beers[beerID].tasterID].name;
      },
      bestBeerName({ state }) {
        return state.beers[1].name;
      }
    };
    const actions = {
      action({ getters }) {
        expect(getters).toBeDefined();
        expect(getters.bestBeerName()).toBe("bertinchamps");
        expect(getters.beerTasterName(1)).toBe("aaron");
      }
    };
    const store = new Store({ state, mutations: {}, actions, getters });
    store.dispatch("action");
  });

  test("getters given to mutations", async () => {
    expect.assertions(3);
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1
        }
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron"
        }
      }
    };
    const getters = {
      beerTasterName({ state }, beerID) {
        return state.tasters[state.beers[beerID].tasterID].name;
      },
      bestBeerName({ state }) {
        return state.beers[1].name;
      }
    };
    const mutations = {
      mutation({ getters }) {
        expect(getters).toBeDefined();
        expect(getters.bestBeerName()).toBe("bertinchamps");
        expect(getters.beerTasterName(1)).toBe("aaron");
      }
    };
    const store = new Store({ state, mutations, actions: {}, getters });
    store.commit("mutation");
  });

  test("can use getters inside a getter", () => {
    const getters = {
      a({ getters }) {
        return `${getters.b()}${getters.c(1)}`;
      },
      b() {
        return "b";
      },
      c({}, i) {
        return `c${i}`;
      }
    };
    const store = new Store({ getters });

    expect(store.getters.a()).toBe("bc1");
  });
});

describe("advanced state properties", () => {
  test("state in the store is reference equal after mutation", async () => {
    const state = {};
    const mutations = {
      donothing() {}
    };
    const store = new Store({ state, mutations });
    expect(store.state).toBe(state);
    store.commit("donothing");
    expect(store.state).toBe(state);
  });

  test("can use array properties in mutations", () => {
    expect.assertions(3);
    const state = { a: [1, 2, 3] };
    const mutations = {
      m({ state }) {
        expect(state.a.length).toBe(3);
        const l = state.a.push(53);
        expect(l).toBe(4);
      }
    };
    const store = new Store({ state, mutations });
    store.commit("m");
    expect(store.state.a).toEqual([1, 2, 3, 53]);
  });

  test("can use object assign in store", async () => {
    const mutations = {
      dosomething({ state }) {
        Object.assign(state.westmalle, { a: 3, b: 4 });
      }
    };
    const store = new Store({
      state: { westmalle: { a: 1, b: 2 } },
      mutations
    });
    store.commit("dosomething");
    expect(store.state.westmalle).toEqual({ a: 3, b: 4 });
  });

  test("aku reactive store state 1", async () => {
    const mutations = {
      inc({ state }) {
        state.counter++;
      }
    };
    const state = { counter: 0 };
    const store = new Store({ state, mutations });
    expect(store.state.counter).toBe(0);
    store.commit("inc", {});
    expect(store.state.counter).toBe(1);
  });
});

describe("updates triggered by the store", () => {
  test("multiple commits trigger one update", async () => {
    let updateCounter = 0;
    const state = { n: 1 };
    const mutations = {
      inc({ state }, delta) {
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

  test("empty commits do not trigger updates", async () => {
    let updateCounter = 0;
    const state = { n: 1 };
    const mutations = {
      inc({ state }, delta) {
        state.n += delta;
      },
      noop() {},
      noop2({ state }) {
        const val = state.n;
        state.n = val;
      }
    };
    const store = new Store({ state, mutations });
    store.on("update", null, () => updateCounter++);

    store.commit("noop");
    await nextMicroTick();
    expect(updateCounter).toBe(0);

    store.commit("inc", 50);
    await nextMicroTick();
    expect(updateCounter).toBe(1);

    store.commit("noop2");
    await nextMicroTick();
    expect(updateCounter).toBe(1);
  });
});

