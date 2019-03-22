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
});
