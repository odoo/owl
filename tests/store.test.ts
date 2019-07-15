import { Component, Env } from "../src/component";
import { Store, ConnectedComponent } from "../src/store";
import { makeTestFixture, makeTestEnv, nextMicroTick, nextTick } from "./helpers";
import { misc } from "../src";

const Observer = misc.Observer;

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

describe("connecting a component to store", () => {
  let fixture: HTMLElement;
  let env: Env;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = makeTestEnv();
  });

  afterEach(() => {
    fixture.remove();
  });

  test("connecting a component works", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <t t-foreach="props.todos" t-as="todo" >
                    <Todo msg="todo.msg" t-key="todo"/>
                </t>
            </div>
            <span t-name="Todo"><t t-esc="props.msg"/></span>
        </templates>
    `);
    class App extends ConnectedComponent<any, any, any> {
      components = { Todo };
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
    }
    class Todo extends Component<any, any, any> {}
    const state = { todos: [] };
    const mutations = {
      addTodo({ state }, msg) {
        state.todos.push({ msg });
      }
    };
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toMatchSnapshot();

    store.commit("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });

  test("deep and shallow connecting a component", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <span t-foreach="props.todos" t-as="todo" t-key="todo">
                  <t t-esc="todo.title"/>
                </span>
            </div>
        </templates>
    `);
    const state = { todos: [{ title: "Kasteel" }] };
    const mutations = {
      edit({ state }, title) {
        state.todos[0].title = title;
      }
    };
    const store = new Store({ state, mutations });

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
    }
    class DeepTodoApp extends App {
      deep = true;
    }
    class ShallowTodoApp extends App {
      deep = false;
    }

    (<any>env).store = store;
    const deepTodoApp = new DeepTodoApp(env);
    const shallowTodoApp = new ShallowTodoApp(env);

    await deepTodoApp.mount(fixture);

    const shallowFix = makeTestFixture();
    await shallowTodoApp.mount(shallowFix);

    expect(fixture.innerHTML).toMatchSnapshot();
    expect(shallowFix.innerHTML).toMatchSnapshot();

    store.commit("edit", "Bertinchamps");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
    expect(shallowFix.innerHTML).toMatchSnapshot();
  });

  test("connecting a component to a local store", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App">
          <t t-foreach="props.todos" t-as="todo">
            <Todo msg="todo.msg" t-key="todo" />
          </t>
        </div>
        <span t-name="Todo"><t t-esc="props.msg"/></span>
      </templates>
      `);
    class Todo extends Component<any, any, any> {}

    (<any>env).store = new Store({});
    const store = new Store({
      state: { todos: [] },
      mutations: {
        addTodo({ state }, msg) {
          state.todos.push({ msg });
        }
      }
    });
    class App extends ConnectedComponent<any, any, any> {
      components = { Todo };
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
      getStore() {
        return store;
      }
    }
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toMatchSnapshot();

    (<any>app.__owl__).store.commit("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });

  test("connected child components with custom hooks", async () => {
    let steps: any = [];
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
              <Child t-if="state.child" />
          </div>
          <div t-name="Child"/>
        </templates>
    `);
    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return s;
      }
      mounted() {
        steps.push("child:mounted");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
    }

    class Parent extends Component<any, any, any> {
      components = { Child };

      constructor(env: Env) {
        super(env);
        this.state = { child: true };
      }
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const parent = new Parent(env);

    await parent.mount(fixture);
    expect(steps).toEqual(["child:mounted"]);

    parent.state.child = false;
    await nextTick();
    expect(steps).toEqual(["child:mounted", "child:willUnmount"]);
  });

  test("mapStoreToProps receives ownprops as second argument", async () => {
    const state = { todos: [{ id: 1, text: "jupiler" }] };
    let nextId = 2;
    const mutations = {
      addTodo({ state }, text) {
        state.todos.push({ text, id: nextId++ });
      }
    };
    const store = new Store({ state, mutations });

    env.qweb.addTemplates(`
        <templates>
            <span t-name="TodoItem"><t t-esc="props.text"/></span>
            <div t-name="TodoList">
                <t t-foreach="props.todos" t-as="todo">
                    <TodoItem id="todo.id" t-key="todo.id"/>
                </t>
          </div>
        </templates>
    `);
    class TodoItem extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props) {
        const todo = state.todos.find(t => t.id === props.id);
        return todo;
      }
    }

    class TodoList extends ConnectedComponent<any, any, any> {
      components = { TodoItem };
      static mapStoreToProps(state) {
        return { todos: state.todos };
      }
    }

    (<any>env).store = store;
    const app = new TodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.commit("addTodo", "hoegaarden");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>hoegaarden</span></div>");
  });

  test("mapStoreToProps receives store getters as third argument", async () => {
    const state = {
      importantID: 1,
      todos: [{ id: 1, text: "jupiler" }, { id: 2, text: "bertinchamps" }]
    };
    const getters = {
      importantTodoText({ state }) {
        return state.todos.find(todo => todo.id === state.importantID).text;
      },
      text({ state }, id) {
        return state.todos.find(todo => todo.id === id).text;
      }
    };
    const store = new Store({ state, getters });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoItem">
                <span><t t-esc="props.activeTodoText"/></span>
                <span><t t-esc="props.importantTodoText"/></span>
            </div>
            <div t-name="TodoList">
                <t t-foreach="props.todos" t-as="todo">
                    <TodoItem id="todo.id" t-key="todo.id"/>
                </t>
            </div>
        </templates>
    `);

    class TodoItem extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props, getters) {
        const todo = state.todos.find(t => t.id === props.id);
        return {
          activeTodoText: getters.text(todo.id),
          importantTodoText: getters.importantTodoText()
        };
      }
    }

    class TodoList extends ConnectedComponent<any, any, any> {
      components = { TodoItem };
      static mapStoreToProps(state) {
        return { todos: state.todos };
      }
    }

    (<any>env).store = store;
    const app = new TodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><span>jupiler</span><span>jupiler</span></div><div><span>bertinchamps</span><span>jupiler</span></div></div>"
    );
  });

  test("connected component is updated when props are updated", async () => {
    env.qweb.addTemplates(`
        <templates>
            <span t-name="Beer"><t t-esc="props.name"/></span>
            <div t-name="App">
                <Beer id="state.beerId"/>
            </div>
        </templates>
    `);

    class Beer extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props) {
        return state.beers[props.id];
      }
    }

    class App extends Component<any, any, any> {
      components = { Beer };
      state = { beerId: 1 };
    }

    const state = { beers: { 1: { name: "jupiler" }, 2: { name: "kwak" } } };
    const store = new Store({ state });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    app.state.beerId = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>kwak</span></div>");
  });

  test("connected component is updated when store is changed", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
              <span t-foreach="props.beers" t-as="beer" t-key="beer.name"><t t-esc="beer.name"/></span>
          </div>
        </templates>
    `);

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state) {
        return { beers: state.beers, otherKey: 1 };
      }
    }

    const mutations = {
      addBeer({ state }, name) {
        state.beers.push({ name });
      }
    };

    const state = { beers: [{ name: "jupiler" }] };
    const store = new Store({ state, mutations });
    (<any>env).store = store;

    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.commit("addBeer", "kwak");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>kwak</span></div>");
  });

  test("connected component with undefined, null and string props", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Beer">
                <span>taster:<t t-esc="props.taster"/></span>
                <span t-if="props.selected">selected:<t t-esc="props.selected.name"/></span>
                <span t-if="props.consumed">consumed:<t t-esc="props.consumed.name"/></span>
            </div>
            <div t-name="App">
               <Beer id="state.beerId"/>
          </div>
        </templates>
    `);

    class Beer extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props) {
        return {
          selected: state.beers[props.id],
          consumed: state.beers[state.consumedID] || null,
          taster: state.taster
        };
      }
    }

    class App extends Component<any, any, any> {
      components = { Beer };
      state = { beerId: 0 };
    }

    const mutations = {
      consume({ state }, beerId) {
        state.consumedID = beerId;
      }
    };
    const state = {
      beers: {
        1: { name: "jupiler" }
      },
      consumedID: null,
      taster: "aaron"
    };
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>taster:aaron</span></div></div>");

    app.state.beerId = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span></div></div>"
    );

    store.commit("consume", 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span><span>consumed:jupiler</span></div></div>"
    );

    app.state.beerId = 0;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:jupiler</span></div></div>"
    );
  });

  test("connected component deeply reactive with undefined, null and string props", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Beer">
                <span>taster:<t t-esc="props.taster"/></span>
                <span t-if="props.selected">selected:<t t-esc="props.selected.name"/></span>
                <span t-if="props.consumed">consumed:<t t-esc="props.consumed.name"/></span>
            </div>
            <div t-name="App">
               <Beer id="state.beerId"/>
          </div>
        </templates>
    `);

    class Beer extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(storeState, props) {
        return {
          selected: storeState.beers[props.id],
          consumed: storeState.beers[storeState.consumedID] || null,
          taster: storeState.taster
        };
      }
    }

    class App extends Component<any, any, any> {
      components = { Beer };
      state = { beerId: 0 };
    }

    const mutations = {
      changeTaster({ state }, newTaster) {
        state.taster = newTaster;
      },
      consume({ state }, beerId) {
        state.consumedID = beerId;
      },
      renameBeer({ state }, { beerId, name }) {
        state.beers[beerId].name = name;
      }
    };
    const state = {
      beers: {
        1: { name: "jupiler" }
      },
      consumedID: null,
      taster: "aaron"
    };
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>taster:aaron</span></div></div>");

    app.state.beerId = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span></div></div>"
    );

    store.commit("renameBeer", { beerId: 1, name: "kwak" });
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:kwak</span></div></div>"
    );

    store.commit("consume", 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:kwak</span><span>consumed:kwak</span></div></div>"
    );

    app.state.beerId = 0;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:kwak</span></div></div>"
    );

    store.commit("renameBeer", { beerId: 1, name: "jupiler" });
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:jupiler</span></div></div>"
    );

    store.commit("changeTaster", "matthieu");
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:matthieu</span><span>consumed:jupiler</span></div></div>"
    );
  });

  test("correct update order when parent/children are connected", async () => {
    const steps: string[] = [];

    env.qweb.addTemplates(`
        <templates>
            <div t-name="Parent">
                <Child key="props.current"/>
            </div>
            <span t-name="Child"><t t-esc="props.msg"/></span>
        </templates>
    `);

    class Parent extends ConnectedComponent<any, any, any> {
      components = { Child };
      static mapStoreToProps(s) {
        steps.push("parent");
        return { current: s.current, isvisible: s.isvisible };
      }
    }

    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s, props) {
        steps.push("child");
        return { msg: s.msg[props.key] };
      }
    }

    const state = { current: "a", msg: { a: "a", b: "b" } };
    const mutations = {
      setCurrent({ state }, c) {
        state.current = c;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new Parent(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>a</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    store.commit("setCurrent", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>b</span></div>");
    expect(steps).toEqual(["parent", "child", "parent", "child"]);
  });

  test("connected parent/children: no double rendering", async () => {
    const mutations = {
      editTodo({ state }) {
        state.todos[1].title = "abc";
      }
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos
    };
    const store = new Store({
      state,
      mutations
    });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoApp" class="todoapp">
                <t t-foreach="Object.values(props.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>

            <div t-name="TodoItem" class="todo">
                <t t-esc="props.todo.title"/>
                <button class="destroy" t-on-click="editTodo">x</button>
            </div>
        </templates>
    `);

    class TodoApp extends ConnectedComponent<any, any, any> {
      components = { TodoItem };
      static mapStoreToProps(state) {
        return {
          todos: state.todos
        };
      }
    }

    let renderCount = 0;
    let fCount = 0;

    class TodoItem extends ConnectedComponent<any, any, any> {
      state = { isEditing: false };
      static mapStoreToProps(state, ownProps) {
        fCount++;
        return {
          todo: state.todos[ownProps.id]
        };
      }

      editTodo() {
        this.env.store.commit("editTodo");
      }
      __render(...args) {
        renderCount++;
        return super.__render(...args);
      }
    }

    (<any>env).store = store;
    const app = new TodoApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">kikoou<button class="destroy">x</button></div></div>'
    );

    expect(renderCount).toBe(1);
    expect(fCount).toBe(1);
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(renderCount).toBe(2);
    expect(fCount).toBe(2);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">abc<button class="destroy">x</button></div></div>'
    );
  });

  test("connected parent/children: no rendering if child is destroyed", async () => {
    const mutations = {
      removeTodo({ state }) {
        Observer.delete(state.todos, 1);
      }
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos
    };
    const store = new Store({
      state,
      mutations
    });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoApp" class="todoapp">
                <t t-foreach="Object.values(props.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>

            <div t-name="TodoItem" class="todo">
                <t t-esc="props.todo.title"/>
                <button class="destroy" t-on-click="removeTodo">x</button>
            </div>
        </templates>
    `);

    class TodoApp extends ConnectedComponent<any, any, any> {
      components = { TodoItem };
      static mapStoreToProps(state) {
        return {
          todos: state.todos
        };
      }
    }

    let renderCount = 0;
    let fCount = 0;

    class TodoItem extends ConnectedComponent<any, any, any> {
      state = { isEditing: false };

      static mapStoreToProps(state, ownProps) {
        fCount++;
        return {
          todo: state.todos[ownProps.id]
        };
      }
      removeTodo() {
        this.env.store.commit("removeTodo");
      }
      __render(...args) {
        renderCount++;
        return super.__render(...args);
      }
    }

    (<any>env).store = store;
    const app = new TodoApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">kikoou<button class="destroy">x</button></div></div>'
    );

    expect(renderCount).toBe(1);
    expect(fCount).toBe(1);
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(renderCount).toBe(1);
    expect(fCount).toBe(1);
    expect(fixture.innerHTML).toBe('<div class="todoapp"></div>');
  });

  test("connected component willpatch/patch hooks are called on store updates", async () => {
    const steps: string[] = [];

    env.qweb.addTemplates(`
        <templates>
            <div t-name="App"><t t-esc="props.msg"/></div>
        </templates>
    `);

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return { msg: s.msg };
      }
      willPatch() {
        steps.push("willpatch");
      }
      patched() {
        steps.push("patched");
      }
    }

    const state = { msg: "a" };
    const mutations = {
      setMsg({ state }, c) {
        state.msg = c;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>a</div>");

    store.commit("setMsg", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>b</div>");
    expect(steps).toEqual(["willpatch", "patched"]);
  });

  test("can set default values", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Greeter">Hello, <t t-esc="props.recipient"/></div>
            <div t-name="App"><Greeter/></div>
        </templates>
    `);

    class Greeter extends ConnectedComponent<any, any, any> {
      static defaultProps = { recipient: "John" };
    }

    class App extends Component<any, any, any> {
      components = { Greeter };
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe('<div><div>Hello, John</div></div>');
  });

  test("can set default values", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Greeter">Hello, <t t-esc="props.recipient"/></div>
            <div t-name="App"><Greeter recipient="props.initialRecipient"/></div>
        </templates>
    `);

    class Greeter extends ConnectedComponent<any, any, any> {
      static defaultProps = { recipient: "John" };
    }

    class App extends Component<any, any, any> {
      components = { Greeter };
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe('<div><div>Hello, John</div></div>');

    await app.__updateProps({ initialRecipient: "James" }, true);
    expect(fixture.innerHTML).toBe('<div><div>Hello, James</div></div>');

    await app.__updateProps({ initialRecipient: undefined }, true);
    expect(fixture.innerHTML).toBe('<div><div>Hello, John</div></div>');
  });

  test("can set default values (v2)", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Message">
                <t t-if="props.showId"><t t-esc="props.messageId"/></t>
                <t t-esc="props.message.content"/>
            </div>
            <div t-name="Thread">
                <t t-if="props.showMessages">
                    <Message t-foreach="props.thread.messages" t-as="messageId" messageId="messageId" t-key="messageId"/>
                </t>
            </div>
            <div t-name="App"><Thread threadId="props.threadId"/></div>
        </templates>
    `);

    class Message extends ConnectedComponent<any, any, any> {
      static defaultProps = { showId: true };
      static mapStoreToProps = function (state, ownProps) {
        return {
          message: state.messages[ownProps.messageId],
        };
      };
    }

    class Thread extends ConnectedComponent<any, any, any> {
      components = { Message };
      static defaultProps = { showMessages: true };
      static mapStoreToProps = function (state, ownProps) {
        const thread = state.threads[ownProps.threadId];
        return {
          thread,
        };
      };
    }

    class App extends Component<any, any, any> {
      components = { Thread };
      static defaultProps = { threadId: 1 };
    }

    const state = {
      threads: {
        1: {
          messages: [100, 101],
        },
        2: {
          messages: [200],
        },
      },
      messages: {
        100: {
          content: "Message100"
        },
        101: {
          content: "Message101"
        },
        200: {
          content: "Message200"
        }
      }
    };

    const mutations = {
      changeMessageContent({ state }, messageId, newContent) {
        state.messages[messageId].content = newContent;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe('<div><div><div>100Message100</div><div>101Message101</div></div></div>');

    await app.__updateProps({ threadId: 2 }, true);
    expect(fixture.innerHTML).toBe('<div><div><div>200Message200</div></div></div>');

    store.commit('changeMessageContent', 200, "UpdatedMessage200");
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><div><div>200UpdatedMessage200</div></div></div>');
  });

});
