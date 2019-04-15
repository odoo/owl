import { Store, makeObserver, connect } from "../src/store";
import {
  nextTick,
  nextMicroTick,
  makeTestFixture,
  makeTestWEnv
} from "./helpers";
import { Env, Component } from "../src/component";

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
    const someEnv = {};
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
});

describe("observer", () => {
  test("properly observe objects", () => {
    const observer = makeObserver();
    const obj: any = {};

    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    const ob2: any = { a: 1 };
    observer.observe(ob2);
    expect(ob2.__owl__.rev).toBe(1);
    ob2.a = 2;
    expect(observer.rev).toBe(2);
    expect(ob2.__owl__.rev).toBe(2);

    ob2.b = 3;
    expect(observer.rev).toBe(2);
    expect(ob2.__owl__.rev).toBe(2);

    observer.set(ob2, "b", 4);
    expect(observer.rev).toBe(3);
    expect(ob2.__owl__.rev).toBe(3);
  });

  test("properly handle null or undefined", () => {
    const observer = makeObserver();
    const obj: any = { a: null, b: undefined };

    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    obj.a = 3;
    expect(obj.__owl__.rev).toBe(2);

    obj.b = 5;
    expect(obj.__owl__.rev).toBe(3);

    obj.a = null;
    obj.b = undefined;
    expect(obj.__owl__.rev).toBe(5);
  });

  test("can change values in array", () => {
    const observer = makeObserver();
    const obj: any = { arr: [1, 2] };

    observer.observe(obj);
    expect(obj.arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    obj.arr[0] = "nope";
    expect(obj.arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    observer.set(obj.arr, 0, "yep");
    expect(obj.arr.__owl__.rev).toBe(2);
    expect(observer.rev).toBe(2);
  });

  test("various object property changes", () => {
    const observer = makeObserver();
    const obj: any = { a: 1 };
    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    obj.a = 2;
    expect(observer.rev).toBe(2);
    expect(obj.__owl__.rev).toBe(2);

    // same value again
    obj.a = 2;
    expect(observer.rev).toBe(2);
    expect(obj.__owl__.rev).toBe(2);

    obj.a = 3;
    expect(observer.rev).toBe(3);
    expect(obj.__owl__.rev).toBe(3);
  });

  test("properly observe arrays", () => {
    const observer = makeObserver();
    const arr: any = [];
    observer.observe(arr);
    expect(arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);
    expect(arr.length).toBe(0);

    arr.push(1);
    expect(arr.__owl__.rev).toBe(2);
    expect(observer.rev).toBe(2);
    expect(arr.length).toBe(1);

    arr.splice(1, 0, "hey");
    expect(arr.__owl__.rev).toBe(3);
    expect(observer.rev).toBe(3);
    expect(arr.length).toBe(2);

    arr.unshift("lindemans");
    expect(arr.__owl__.rev).toBe(4);

    arr.reverse();
    expect(arr.__owl__.rev).toBe(5);

    arr.pop();
    expect(arr.__owl__.rev).toBe(6);

    arr.shift();
    expect(arr.__owl__.rev).toBe(7);

    arr.sort();
    expect(arr.__owl__.rev).toBe(8);

    expect(arr).toEqual([1]);
  });

  test("object pushed into arrays are observed", () => {
    const observer = makeObserver();
    const arr: any = [];
    observer.observe(arr);
    expect(observer.rev).toBe(1);

    arr.push({ kriek: 5 });
    expect(observer.rev).toBe(2);
    expect(arr.__owl__.rev).toBe(2);
    expect(arr[0].__owl__.rev).toBe(1);

    arr[0].kriek = 6;
    expect(observer.rev).toBe(3);
    expect(arr.__owl__.rev).toBe(2);
    expect(arr[0].__owl__.rev).toBe(2);
  });

  test("properly observe arrays in object", () => {
    const observer = makeObserver();
    const state: any = { arr: [] };
    observer.observe(state);
    expect(state.arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);
    expect(state.arr.length).toBe(0);

    state.arr.push(1);
    expect(state.arr.__owl__.rev).toBe(2);
    expect(observer.rev).toBe(2);
    expect(state.arr.length).toBe(1);
  });

  test("properly observe objects in array", () => {
    const observer = makeObserver();
    const state: any = { arr: [{ something: 1 }] };
    observer.observe(state);
    expect(state.arr.__owl__.rev).toBe(1);
    expect(state.arr[0].__owl__.rev).toBe(1);

    state.arr[0].something = 2;
    expect(state.arr.__owl__.rev).toBe(1);
    expect(state.arr[0].__owl__.rev).toBe(2);
  });

  test("properly observe objects in object", () => {
    const observer = makeObserver();
    const state: any = { a: { b: 1 } };
    observer.observe(state);
    expect(state.__owl__.rev).toBe(1);
    expect(state.a.__owl__.rev).toBe(1);

    state.a.b = 2;
    expect(state.__owl__.rev).toBe(1);
    expect(state.a.__owl__.rev).toBe(2);
  });

  test("properly unobserve objects in object", () => {
    const observer = makeObserver();
    const state: any = { a: { b: 1 } };
    observer.observe(state);
    expect(state.__owl__.rev).toBe(1);
    const initialA = state.a;
    expect(initialA.__owl__.rev).toBe(1);

    state.a = "Karlsquell";
    expect(initialA.__owl__).not.toBeDefined();
  });

  test("reobserve new object values", () => {
    const observer = makeObserver();
    const obj: any = { a: 1 };
    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    obj.a = { b: 2 };
    expect(observer.rev).toBe(2);
    expect(obj.__owl__.rev).toBe(2);
    expect(obj.a.__owl__.rev).toBe(1);

    obj.a.b = 3;
    expect(observer.rev).toBe(3);
    expect(obj.__owl__.rev).toBe(2);
    expect(obj.a.__owl__.rev).toBe(2);
  });

  test("deep observe misc changes", () => {
    const observer = makeObserver();
    const state: any = { o: { a: 1 }, arr: [1], n: 13 };
    observer.observe(state);
    expect(state.__owl__.rev).toBe(1);
    expect(state.__owl__.deepRev).toBe(1);

    state.o.a = 2;
    expect(observer.rev).toBe(2);
    expect(state.__owl__.rev).toBe(1);
    expect(state.__owl__.deepRev).toBe(2);

    state.arr.push(2);
    expect(state.__owl__.rev).toBe(1);
    expect(state.__owl__.deepRev).toBe(3);

    state.n = 155;
    expect(state.__owl__.rev).toBe(2);
    expect(state.__owl__.deepRev).toBe(4);
  });

  test("properly handle already observed state", () => {
    const observer = makeObserver();
    const obj1: any = { a: 1 };
    const obj2: any = { b: 1 };
    observer.observe(obj1);
    observer.observe(obj2);
    expect(obj1.__owl__.rev).toBe(1);
    expect(obj2.__owl__.rev).toBe(1);

    obj1.a = 2;
    obj2.b = 3;
    expect(obj1.__owl__.rev).toBe(2);
    expect(obj2.__owl__.rev).toBe(2);

    obj2.b = obj1;
    expect(obj1.__owl__.rev).toBe(2);
    expect(obj2.__owl__.rev).toBe(3);
  });

  test("accept cycles in observed state", () => {
    const observer = makeObserver();
    const obj1: any = {};
    const obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    observer.observe(obj1);
    expect(obj1.__owl__.rev).toBe(1);
    expect(obj2.__owl__.rev).toBe(1);

    obj2.key = 3;
    expect(obj1.__owl__.rev).toBe(1);
    expect(obj2.__owl__.rev).toBe(2);
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
                <t t-foreach="props.todos" t-as="todo">
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

    await parent.updateState({ child: false });
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

    await app.updateState({ beerId: 2 });
    expect(fixture.innerHTML).toBe("<div><span>kwak</span></div>");
  });
});
