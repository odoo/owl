import { Component, Env } from "../src/component";
import { connect, Store } from "../src/store";
import {
  makeTestFixture,
  makeTestWEnv,
  nextMicroTick,
  nextTick
} from "./helpers";

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

  test("set function is given to mutations", async () => {
    let updateCounter = 0;
    const state = { bertinchamps: "brune" };
    const mutations = {
      addInfo({ state, set }) {
        set(state, "chouffe", "blonde");
      }
    };
    const store = new Store({ state, mutations, actions: {} });
    store.on("update", null, () => updateCounter++);

    expect(updateCounter).toBe(0);
    store.commit("addInfo");
    await nextMicroTick();
    expect(updateCounter).toBe(1);
    expect(store.state).toEqual({ bertinchamps: "brune", chouffe: "blonde" });
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
          name: 'aaron',
        }
      },
    };
    const getters = {
      beerTasterName(state) {
        return beerID => {
          return state.tasters[state.beers[beerID].tasterID].name;
        }
      },
      bestBeerName(state) {
        return state.beers[1].name;
      }
    };
    const store = new Store({ state, mutations: {}, actions: {}, getters });
    expect(store.getters).toBeDefined();
    expect((<any>store.getters).bestBeerName).toBe("bertinchamps");
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
          name: 'aaron',
        }
      },
    };
    const getters = {
      beerTasterName(state) {
        return beerID => {
          return state.tasters[state.beers[beerID].tasterID].name;
        }
      },
      bestBeerName(state) {
        return state.beers[1].name;
      }
    };
    const actions = {
      action({ getters }) {
        expect(getters).toBeDefined();
        expect(getters.bestBeerName).toBe("bertinchamps");
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
          tasterID: 1,
        },
      },
      tasters: {
        1: {
          id: 1,
          name: 'aaron',
        }
      },
    };
    const getters = {
      beerTasterName(state) {
        return beerID => {
          return state.tasters[state.beers[beerID].tasterID].name;
        }
      },
      bestBeerName(state) {
        return state.beers[1].name;
      }
    };
    const mutations = {
      mutation({ getters }) {
        expect(getters).toBeDefined();
        expect(getters.bestBeerName).toBe("bertinchamps");
        expect(getters.beerTasterName(1)).toBe("aaron");
      }
    };
    const store = new Store({ state, mutations, actions: {}, getters });
    store.commit("mutation");
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
    env = makeTestWEnv();
  });

  afterEach(() => {
    fixture.remove();
  });

  class App extends Component<any, any, any> {
    inlineTemplate = `
            <div>
                <t t-foreach="props.todos" t-as="todo" t-key="todo">
                    <t t-widget="Todo" t-props="todo"/>
                </t>
            </div>`;
    widgets = { Todo };
  }
  class Todo extends Component<any, any, any> {
    inlineTemplate = `<span><t t-esc="props.msg"/></span>`;
  }

  test("connecting a component works", async () => {
    const state = { todos: [] };
    const mutations = {
      addTodo({ state }, msg) {
        state.todos.push({ msg });
      }
    };
    function mapStateToProps(s) {
      return { todos: s.todos };
    }
    const TodoApp = connect(mapStateToProps)(App);
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new TodoApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toMatchSnapshot();

    store.commit("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });

  test("deep and shallow connecting a component", async () => {
    const state = { todos: [{ title: "Kasteel" }] };
    const mutations = {
      edit({ state }, title) {
        state.todos[0].title = title;
      }
    };
    function mapStateToProps(s) {
      return { todos: s.todos };
    }
    const store = new Store({ state, mutations });

    class App extends Component<any, any, any> {
      inlineTemplate = `
            <div>
                <span t-foreach="props.todos" t-as="todo" t-key="todo">
                  <t t-esc="todo.title"/>
                </span>
            </div>`;
    }

    const DeepTodoApp = connect(
      mapStateToProps,
      { deep: true }
    )(App);
    const ShallowTodoApp = connect(
      mapStateToProps,
      { deep: false }
    )(App);
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

  test("connected child components with custom hooks", async () => {
    let steps: any = [];
    class Child extends Component<any, any, any> {
      inlineTemplate = `<div/>`;
      mounted() {
        steps.push("child:mounted");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
    }

    const ConnectedChild = connect(s => s)(Child);

    class Parent extends Component<any, any, any> {
      inlineTemplate = `
          <div>
              <t t-if="state.child" t-widget="ConnectedChild"/>
          </div>`;
      widgets = { ConnectedChild };

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

  test("connect receives ownprops as second argument", async () => {
    const state = { todos: [{ id: 1, text: "jupiler" }] };
    let nextId = 2;
    const mutations = {
      addTodo({ state }, text) {
        state.todos.push({ text, id: nextId++ });
      }
    };
    const store = new Store({ state, mutations });

    class TodoItem extends Component<any, any, any> {
      inlineTemplate = `<span><t t-esc="props.text"/></span>`;
    }
    const ConnectedTodo = connect((state, props) => {
      const todo = state.todos.find(t => t.id === props.id);
      return todo;
    })(TodoItem);

    class TodoList extends Component<any, any, any> {
      inlineTemplate = `<div>
            <t t-foreach="props.todos" t-as="todo">
              <t t-widget="ConnectedTodo" t-props="todo"/>
            </t>
          </div>`;
      widgets = { ConnectedTodo };
    }

    function mapStateToProps(state) {
      return { todos: state.todos };
    }
    const ConnectedTodoList = connect(mapStateToProps)(TodoList);

    (<any>env).store = store;
    const app = new ConnectedTodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.commit("addTodo", "hoegaarden");
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><span>jupiler</span><span>hoegaarden</span></div>"
    );
  });

  test("connect receives store getters as third argument", async () => {
    const state = {
      importantID: 1,
      todos: [
        { id: 1, text: "jupiler" },
        { id: 2, text: "bertinchamps" },
      ],
    };
    const getters = {
      importantTodoText(state) {
        return state.todos.find(todo => todo.id === state.importantID).text;
      },
      text(state) {
        return id => state.todos.find(todo => todo.id === id).text;
      },
    };
    const store = new Store({ state, getters });

    class TodoItem extends Component<any, any, any> {
      inlineTemplate = `<div>
        <span><t t-esc="props.activeTodoText"/></span>
        <span><t t-esc="props.importantTodoText"/></span>
      </div>`;
    }
    const ConnectedTodo = connect((state, props, getters) => {
      const todo = state.todos.find(t => t.id === props.id);
      return {
        activeTodoText: getters.text(todo.id),
        importantTodoText: getters.importantTodoText,
      };
    })(TodoItem);

    class TodoList extends Component<any, any, any> {
      inlineTemplate = `<div>
            <t t-foreach="props.todos" t-as="todo">
              <t t-widget="ConnectedTodo" t-props="todo"/>
            </t>
          </div>`;
      widgets = { ConnectedTodo };
    }

    function mapStateToProps(state) {
      return { todos: state.todos };
    }
    const ConnectedTodoList = connect(mapStateToProps)(TodoList);

    (<any>env).store = store;
    const app = new ConnectedTodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>jupiler</span><span>jupiler</span></div><div><span>bertinchamps</span><span>jupiler</span></div></div>");
  });

  test("connected component is updated when props are updated", async () => {
    class Beer extends Component<any, any, any> {
      inlineTemplate = `<span><t t-esc="props.name"/></span>`;
    }
    const ConnectedBeer = connect((state, props) => {
      return state.beers[props.id];
    })(Beer);

    class App extends Component<any, any, any> {
      inlineTemplate = `<div>
              <t t-widget="ConnectedBeer" t-props="{id: state.beerId}"/>
          </div>`;
      widgets = { ConnectedBeer };
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
    class App extends Component<any, any, any> {
      inlineTemplate = `
          <div>
              <span t-foreach="props.beers" t-as="beer" t-key="beer.name"><t t-esc="beer.name"/></span>
          </div>`;
    }

    const mutations = {
      addBeer({ state }, name) {
        state.beers.push({ name });
      }
    };

    const state = { beers: [{ name: "jupiler" }] };
    const store = new Store({ state, mutations });
    (<any>env).store = store;

    function mapStateToProps(state) {
      return { beers: state.beers, otherKey: 1 };
    }
    const ConnectedApp = connect(mapStateToProps)(App);
    const app = new ConnectedApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.commit("addBeer", "kwak");
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><span>jupiler</span><span>kwak</span></div>"
    );
  });

  test("connected component with undefined, null and string props", async () => {
    class Beer extends Component<any, any, any> {
      inlineTemplate = `<div>
          <span>taster:<t t-esc="props.taster"/></span>
          <span t-if="props.selected">selected:<t t-esc="props.selected.name"/></span>
          <span t-if="props.consumed">consumed:<t t-esc="props.consumed.name"/></span>
        </div>`;
    }
    const ConnectedBeer = connect((state, props) => {
      return {
        selected: state.beers[props.id],
        consumed: state.beers[state.consumedID] || null,
        taster: state.taster
      };
    })(Beer);

    class App extends Component<any, any, any> {
      inlineTemplate = `<div>
              <t t-widget="ConnectedBeer" t-props="{id: state.beerId}"/>
          </div>`;
      widgets = { ConnectedBeer };
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
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span></div></div>"
    );

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
    class Beer extends Component<any, any, any> {
      inlineTemplate = `<div>
          <span>taster:<t t-esc="props.taster"/></span>
          <span t-if="props.selected">selected:<t t-esc="props.selected.name"/></span>
          <span t-if="props.consumed">consumed:<t t-esc="props.consumed.name"/></span>
        </div>`;
    }
    const ConnectedBeer = connect((state, props) => {
      return {
        selected: state.beers[props.id],
        consumed: state.beers[state.consumedID] || null,
        taster: state.taster
      };
    })(Beer);

    class App extends Component<any, any, any> {
      inlineTemplate = `<div>
              <t t-widget="ConnectedBeer" t-props="{id: state.beerId}"/>
          </div>`;
      widgets = { ConnectedBeer };
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
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span></div></div>"
    );

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
    class Parent extends Component<any, any, any> {
      inlineTemplate = `
        <div>
            <t t-widget="Child" t-ref="'child'" t-props="{key: props.current}"/>
        </div>
      `;
      widgets = { Child: ConnectedChild };
    }
    const ConnectedParent = connect(function(s) {
      steps.push("parent");
      return { current: s.current, isvisible: s.isvisible };
    })(Parent);

    class Child extends Component<any, any, any> {
      inlineTemplate = `<span><t t-esc="props.msg"/></span>`;
    }

    const ConnectedChild = connect(function(s, props) {
      steps.push("child");
      return { msg: s.msg[props.key] };
    })(Child);

    const state = { current: "a", msg: { a: "a", b: "b" } };
    const mutations = {
      setCurrent({ state }, c) {
        state.current = c;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new ConnectedParent(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>a</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    store.commit("setCurrent", "b");
    await nextTick();
    expect(steps).toEqual(["parent", "child", "parent", "child", "child"]);
  });

  test("connected component willpatch/patch hooks are called on store updates", async () => {
    const steps: string[] = [];
    class App extends Component<any, any, any> {
      inlineTemplate = `<div><t t-esc="props.msg"/></div>`;
      willPatch() {
        steps.push("willpatch");
      }
      patched() {
        steps.push("patched");
      }
    }
    const ConnectedApp = connect(function(s) {
      return { msg: s.msg };
    })(App);

    const state = { msg: "a" };
    const mutations = {
      setMsg({ state }, c) {
        state.msg = c;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new ConnectedApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>a</div>");

    store.commit("setMsg", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>b</div>");
    expect(steps).toEqual(["willpatch", "patched"]);
  });
});
