import { Store, connect } from "../src/store";
import { Component, Env } from "../src/component";
import {
  nextMicroTick,
  makeTestWEnv,
  makeTestFixture,
  nextTick
} from "./helpers";

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
      addTodo(state, msg) {
        state.todos.push({ msg });
      }
    };
    const TodoApp = connect(s => s)(App);
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
      destroyed() {
        steps.push("child:destroyed");
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
    expect(steps).toEqual([
      "child:mounted",
      "child:willUnmount",
      "child:destroyed"
    ]);
  });

  test("connect receives ownprops as second argument", async () => {
    const state = { todos: [{ id: 1, text: "jupiler" }] };
    let nextId = 2;
    const mutations = {
      addTodo(state, text) {
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

    const ConnectedTodoList = connect(state => state)(TodoList);

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
