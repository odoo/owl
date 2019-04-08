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

  test("can dispatch an action in an action", () => {
    const state = { n: 1 };
    const mutations = {
      inc(state, delta) {
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
});

describe("advanced state properties", () => {
  test("state in the store is reference equal after empty mutation", async () => {
    const mutations = {
      donothing() {}
    };
    const store = new Store({ state: {}, mutations });
    const state = store.state;
    store.commit("donothing");
    expect(store.state).toBe(state);
  });

  test("state in the store is not reference equal after changing one number value", async () => {
    const mutations = {
      dosomething(state) {
        expect(state.rochefort).toBe(8);
        state.rochefort += 2;
        expect(state.rochefort).toBe(10);
      }
    };
    const store = new Store({ state: { rochefort: 8 }, mutations });
    const state = store.state;
    expect(state.rochefort).toBe(8);
    store.commit("dosomething");
    expect(store.state.rochefort).toBe(10);
    expect(store.state).not.toBe(state);
  });

  test("state is reference equal after pushing in a list", async () => {
    const mutations = {
      addRochefort(state) {
        state.rocheforts.push(10);
      }
    };
    const store = new Store({ state: { rocheforts: [] }, mutations });
    const state = store.state;
    store.commit("addRochefort");
    expect(store.state.rocheforts).toEqual([10]);
    expect(store.state).toBe(state);
  });

  test("nested state in the store behaves properly", async () => {
    const state = { jupiler: { maes: 1 } };
    const mutations = {
      dostuff(state, inc) {
        state.jupiler.maes += inc;
      }
    };
    const store = new Store({ state, mutations });
    expect(store.state.jupiler.maes).toBe(1);
    const stateA = store.state;
    const jupiler = store.state.jupiler;
    store.commit("dostuff", 10);
    expect(store.state.jupiler.maes).toBe(11);
    expect(store.state).toBe(stateA);
    expect(store.state.jupiler).not.toBe(jupiler);
  });

  test("sibling properties are not affected", async () => {
    const state = { jupiler: { maes: 1 }, stella: 3 };
    const mutations = {
      dostuff(state, inc) {
        state.stella += inc;
      }
    };
    const store = new Store({ state, mutations });
    const jupiler = store.state.jupiler;
    const stateA = store.state;
    store.commit("dostuff", 10);
    expect(store.state.stella).toBe(13);
    expect(store.state).not.toBe(stateA);
    expect(store.state.jupiler).toBe(jupiler);
  });

  test("interaction between mutations on sibling properties", async () => {
    const state = { jupiler: { maes: 1 }, stella: 3 };
    const mutations = {
      dostuffA(state, inc) {
        state.stella += inc;
      },
      dostuffB(state, inc) {
        state.jupiler.maes += inc;
      }
    };
    const store = new Store({ state, mutations });
    store.commit("dostuffA", 10);
    const jupiler = store.state.jupiler;
    store.commit("dostuffB", 10);
    expect(store.state.jupiler).not.toBe(jupiler);
  });

  test("can use object assign in store", async () => {
    const mutations = {
      dosomething(state) {
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
      inc(state) {
        state.counter++;
      }
    };
    const state = { counter: 0 };
    const store = new Store({ state, mutations });
    const curState = store.state;
    expect(store.state.counter).toBe(0);
    store.commit("inc", {});
    expect(store.state.counter).toBe(1);
    expect(store.state).not.toBe(curState);
  });

  test("aku reactive store state 2", async () => {
    const mutations = {
      inc(state) {
        state.convo.counter++;
      }
    };
    const state = { convo: { counter: 0 } };
    const store = new Store({ state, mutations });
    const curState = store.state;
    const convo = state.convo;
    expect(store.state.convo.counter).toBe(0);
    store.commit("inc", {});
    expect(store.state.convo.counter).toBe(1);
    expect(store.state.convo).not.toBe(convo);
    expect(store.state).toBe(curState);
  });

  test("aku reactive store state 3", async () => {
    const mutations = {
      inc1(state) {
        state.threads[1].counter++;
      },
      inc2(state) {
        state.threads[2].counter++;
      }
    };
    const state = {
      threads: {
        1: { counter: 0 },
        2: { counter: 0 }
      }
    };
    const store = new Store({ state, mutations });
    const curState = store.state;
    const threads = state.threads;
    const thread1 = state.threads[1];
    const thread2 = state.threads[2];
    expect(store.state.threads[1].counter).toBe(0);
    expect(store.state.threads[2].counter).toBe(0);
    store.commit("inc1", {});
    expect(store.state.threads[1].counter).toBe(1);
    expect(store.state.threads[2].counter).toBe(0);
    expect(store.state.threads[1]).not.toBe(thread1);
    expect(store.state.threads[2]).toBe(thread2);
    expect(store.state.threads).toBe(threads);
    expect(store.state).toBe(curState);
    const newThread1 = curState.threads[1];
    store.commit("inc2", {});
    expect(store.state.threads[1].counter).toBe(1);
    expect(store.state.threads[2].counter).toBe(1);
    expect(store.state.threads[1]).toBe(newThread1);
    expect(store.state.threads[2]).not.toBe(thread2);
    expect(store.state.threads).toBe(threads);
    expect(store.state).toBe(curState);
  });

  test("aku reactive store state 4", async () => {
    const mutations = {
      incT(state) {
        state.threads[1].counter++;
      },
      incM(state) {
        state.messages[1].counter++;
      }
    };
    const state = {
      threads: {
        1: { counter: 0 }
      },
      messages: {
        1: { counter: 0 }
      }
    };
    const store = new Store({ state, mutations });
    const curState = store.state;
    const threads = state.threads;
    const messages = state.messages;
    const thread = state.threads[1];
    const message = state.messages[1];
    expect(store.state.threads[1].counter).toBe(0);
    expect(store.state.messages[1].counter).toBe(0);
    store.commit("incT", {});
    expect(store.state.threads[1].counter).toBe(1);
    expect(store.state.messages[1].counter).toBe(0);
    expect(store.state.threads[1]).not.toBe(thread);
    expect(store.state.messages[1]).toBe(message);
    expect(store.state.threads).toBe(threads);
    expect(store.state.messages).toBe(messages);
    expect(store.state).toBe(curState);
    const newThread = curState.threads[1];
    store.commit("incM", {});
    expect(store.state.threads[1].counter).toBe(1);
    expect(store.state.messages[1].counter).toBe(1);
    expect(store.state.threads[1]).toBe(newThread);
    expect(store.state.messages[1]).not.toBe(message);
    expect(store.state.threads).toBe(threads);
    expect(store.state.messages).toBe(messages);
    expect(store.state).toBe(curState);
  });

  test("aku reactive store state 5", async () => {
    const mutations = {
      inc(state) {
        state.counter++;
      },
      incT(state) {
        state.threads[1].counter++;
      }
    };
    const state = {
      threads: {
        1: { counter: 0 }
      },
      counter: 0
    };
    const store = new Store({ state, mutations });
    const curState = store.state;
    const threads = state.threads;
    const thread = state.threads[1];
    expect(store.state.counter).toBe(0);
    expect(store.state.threads[1].counter).toBe(0);
    store.commit("inc", {});
    expect(store.state.counter).toBe(1);
    expect(store.state.threads[1].counter).toBe(0);
    expect(store.state.threads[1]).toBe(thread);
    expect(store.state.threads).toBe(threads);
    expect(store.state).not.toBe(curState);
    const newCurState = store.state;
    store.commit("incT", {});
    expect(store.state.counter).toBe(1);
    expect(store.state.threads[1].counter).toBe(1);
    expect(store.state.threads[1]).not.toBe(thread);
    expect(store.state.threads).toBe(threads);
    expect(store.state).toBe(newCurState);
  });

  test("aku reactive store state 6", async () => {
    const mutations = {
      inc1(state) {
        state.threads[1].c1++;
      },
      inc2(state) {
        state.threads[1].c2++;
      }
    };
    const state = {
      threads: {
        1: { c1: 0, c2: 0 }
      }
    };
    const store = new Store({ state, mutations });
    const curState = store.state;
    const threads = state.threads;
    const thread = state.threads[1];
    expect(store.state.threads[1].c1).toBe(0);
    expect(store.state.threads[1].c2).toBe(0);
    store.commit("inc1", {});
    expect(store.state.threads[1].c1).toBe(1);
    expect(store.state.threads[1].c2).toBe(0);
    expect(store.state.threads[1]).not.toBe(thread);
    expect(store.state.threads).toBe(threads);
    expect(store.state).toBe(curState);
    const newThread = store.state.threads[1];
    store.commit("inc2", {});
    expect(store.state.threads[1].c1).toBe(1);
    expect(store.state.threads[1].c2).toBe(1);
    expect(store.state.threads[1]).not.toBe(newThread);
    expect(store.state.threads).toBe(threads);
    expect(store.state).toBe(curState);
  });

  test("aku reactive store state 7", async () => {
    const mutations = {
      register(state) {
        state.threads[1].messages.push(1);
      }
    };
    const state = {
      threads: {
        1: {
          messages: []
        }
      },
      messages: {
        1: {}
      }
    };
    const store = new Store({ state, mutations });
    const curState = store.state;
    const threads = state.threads;
    const messages = state.messages;
    const thread = state.threads[1];
    const threadMessages = state.threads[1].messages;
    const message = state.messages[1];
    expect(store.state.threads[1].messages.length).toBe(0);
    store.commit("register", {});
    expect(store.state.threads[1].messages.length).toBe(1);
    expect(store.state.threads[1].messages[0]).toBe(1);
    expect(store.state.threads[1].messages).not.toBe(threadMessages);
    expect(store.state.threads[1]).toBe(thread);
    expect(store.state.threads).toBe(threads);
    expect(store.state.messages[1]).toBe(message);
    expect(store.state.messages).toBe(messages);
    expect(store.state).toBe(curState);
  });
});

describe("updates triggered by the store", () => {
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

  test("empty commits do not trigger updates", async () => {
    let updateCounter = 0;
    const state = { n: 1 };
    const mutations = {
      inc(state, delta) {
        state.n += delta;
      },
      noop() {}
    };
    const store = new Store({ state, mutations });
    store.on("update", null, () => updateCounter++);

    store.commit("noop");
    await nextMicroTick();
    expect(updateCounter).toBe(0);
    store.commit("inc", 50);
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

  test.skip("connect receives ownprops as second argument", async () => {
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
