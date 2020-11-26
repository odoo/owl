import { Env } from "../src/component/component";
import { Store, Getter } from "../src/store";
import { nextTick, nextMicroTick } from "./helpers";

describe("basic use", () => {
  test("dispatch an action", () => {
    const state = { n: 1 };
    const actions = {
      inc({ state }, delta) {
        state.n += delta;
      },
    };
    const store = new Store({ state, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("inc", 14);
    expect(store.state.n).toBe(15);
  });

  test("dispatch an action with positional arguments", () => {
    const state = { n1: 1, n2: 1, n3: 1 };

    const actions = {
      batchInc({ state }, delta1, delta2, delta3) {
        state.n1 += delta1;
        state.n2 += delta2;
        state.n3 += delta3;
      },
    };
    const store = new Store({ state, actions });

    expect(store.state.n1).toBe(1);
    expect(store.state.n2).toBe(1);
    expect(store.state.n3).toBe(1);
    store.dispatch("batchInc", 14, 30, 88);
    expect(store.state.n1).toBe(15);
    expect(store.state.n2).toBe(31);
    expect(store.state.n3).toBe(89);
  });

  test("can dispatch an action in an action", () => {
    const state = { n: 1 };

    const actions = {
      inc({ state }, delta) {
        state.n += delta;
      },
      inc100({ dispatch }) {
        dispatch("inc", 100);
      },
    };
    const store = new Store({ state, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("inc100");
    expect(store.state.n).toBe(101);
  });

  test("return data from dispatching an action", () => {
    const state = { n: 1 };
    const actions = {
      inc({ state }) {
        return ++state.n;
      },
    };
    const store = new Store({ state, actions });

    expect(store.state.n).toBe(1);
    const res = store.dispatch("inc");
    expect(store.state.n).toBe(2);
    expect(res).toBe(2);
  });

  test("dispatch allow synchronizing between actions", async () => {
    const state = { n: 1 };
    const actions = {
      inc({ state }, delta) {
        state.n += delta;
      },
      setN({ state }, n) {
        state.n = n;
      },
      async dosomething({ dispatch }) {
        await dispatch("setTo10");
        dispatch("inc", 3);
      },
      async setTo10({ dispatch }) {
        await Promise.resolve();
        dispatch("setN", 10);
      },
    };
    const store = new Store({ state, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("dosomething");
    expect(store.state.n).toBe(1);
    await nextTick();
    expect(store.state.n).toBe(13);
  });

  test("return data from dispatching an action", async () => {
    const state = { n: 1 };
    const actions = {
      inc({ state }, delta) {
        state.n += delta;
      },
      setN({ state }, n) {
        state.n = n;
      },
      async dosomething({ dispatch }) {
        const val = await dispatch("setTo10");
        dispatch("inc", val);
      },
      async setTo10({ dispatch }) {
        await Promise.resolve();
        dispatch("setN", 10);
        return 5;
      },
    };
    const store = new Store({ state, actions });

    expect(store.state.n).toBe(1);
    store.dispatch("dosomething");
    expect(store.state.n).toBe(1);
    await nextTick();
    expect(store.state.n).toBe(15);
  });

  test("env is given to actions", () => {
    expect.assertions(1);
    const someEnv = <Env>{};
    const actions = {
      someaction({ env }) {
        expect(env).toBe(someEnv);
      },
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
          tasterID: 1,
        },
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron",
        },
      },
    };
    const getters: { [key: string]: Getter } = {
      beerTasterName({ state }, beerID) {
        return state.tasters[state.beers[beerID].tasterID].name;
      },
      bestBeerName({ state }) {
        return state.beers[1].name;
      },
    };
    const store = new Store({ state, actions: {}, getters });
    expect(store.getters).toBeDefined();
    expect((<any>store.getters).bestBeerName()).toBe("bertinchamps");
    expect((<any>store.getters).beerTasterName(1)).toBe("aaron");
  });

  test("getters given to actions", async () => {
    expect.assertions(3);
    const state = {
      beers: {
        1: {
          id: 1,
          name: "bertinchamps",
          tasterID: 1,
        },
      },
      tasters: {
        1: {
          id: 1,
          name: "aaron",
        },
      },
    };
    const getters = {
      beerTasterName({ state }, beerID) {
        return state.tasters[state.beers[beerID].tasterID].name;
      },
      bestBeerName({ state }) {
        return state.beers[1].name;
      },
    };
    const actions = {
      action({ getters }) {
        expect(getters).toBeDefined();
        expect(getters.bestBeerName()).toBe("bertinchamps");
        expect(getters.beerTasterName(1)).toBe("aaron");
      },
    };
    const store = new Store({ state, actions, getters });
    store.dispatch("action");
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
      },
    };
    const store = new Store({ getters, state: {}, actions: {} });

    expect(store.getters.a()).toBe("bc1");
  });
});

describe("advanced state properties", () => {
  test("state in the store is reference equal after mutation", async () => {
    const actions = {
      donothing() {},
    };
    const store = new Store({ state: {}, actions });
    const state = store.state;
    store.dispatch("donothing");
    expect(store.state).toBe(state);
  });

  test("can use array properties in mutations", () => {
    expect.assertions(3);
    const state = { a: [1, 2, 3] };
    const actions = {
      m({ state }) {
        expect(state.a.length).toBe(3);
        const l = state.a.push(53);
        expect(l).toBe(4);
      },
    };
    const store = new Store({ state, actions });
    store.dispatch("m");
    expect(store.state.a).toEqual([1, 2, 3, 53]);
  });

  test("can use object assign in store", async () => {
    const actions = {
      dosomething({ state }) {
        Object.assign(state.westmalle, { a: 3, b: 4 });
      },
    };
    const store = new Store({
      state: { westmalle: { a: 1, b: 2 } },
      actions,
    });
    store.dispatch("dosomething");
    expect(store.state.westmalle).toEqual({ a: 3, b: 4 });
  });

  test("aku reactive store state 1", async () => {
    const actions = {
      inc({ state }) {
        state.counter++;
      },
    };
    const state = { counter: 0 };
    const store = new Store({ state, actions });
    expect(store.state.counter).toBe(0);
    store.dispatch("inc", {});
    expect(store.state.counter).toBe(1);
  });
});

describe("updates triggered by the store", () => {
  test("multiple commits trigger one update", async () => {
    let updateCounter = 0;
    const state = { n: 1 };
    const actions = {
      inc({ state }, delta) {
        state.n += delta;
      },
    };
    const store = new Store({ state, actions });
    store.on("update", null, () => updateCounter++);

    store.dispatch("inc", 14);
    expect(updateCounter).toBe(0);
    store.dispatch("inc", 50);
    expect(updateCounter).toBe(0);
    await nextMicroTick();
    expect(updateCounter).toBe(1);
  });

  test("empty commits do not trigger updates", async () => {
    let updateCounter = 0;
    const state = { n: 1 };
    const actions = {
      inc({ state }, delta) {
        state.n += delta;
      },
      noop() {},
      noop2({ state }) {
        const val = state.n;
        state.n = val;
      },
    };
    const store = new Store({ state, actions });
    store.on("update", null, () => updateCounter++);

    store.dispatch("noop");
    await nextMicroTick();
    expect(updateCounter).toBe(0);

    store.dispatch("inc", 50);
    await nextMicroTick();
    expect(updateCounter).toBe(1);

    store.dispatch("noop2");
    await nextMicroTick();
    expect(updateCounter).toBe(1);
  });
});
