import { TemplateSet } from "../../src/runtime/template_set";
import { mount } from "../../src/runtime/blockdom";
import { makeTestFixture, renderToBdom, renderToString, snapshotEverything } from "../helpers";
import { markup } from "../../src/runtime/utils";
import { STATUS } from "../../src/runtime/status";

snapshotEverything();
// -----------------------------------------------------------------------------
// t-on
// -----------------------------------------------------------------------------

describe("t-on", () => {
  function mountToFixture(template: string, ctx: any = {}, node?: any): HTMLDivElement {
    if (!node) {
      node = { component: ctx, status: STATUS.MOUNTED };
      ctx.__owl__ = node;
    }
    const block = renderToBdom(template, ctx, node);
    const fixture = makeTestFixture();

    mount(block, fixture);
    return fixture;
  }

  test("can bind event handler", () => {
    const template = `<button t-on-click="add">Click</button>`;
    let a = 1;
    const fixture = mountToFixture(template, { add: () => (a = 3) });
    expect(a).toBe(1);
    fixture.querySelector("button")!.click();
    expect(a).toBe(3);
  });

  test("receive event in first argument", () => {
    expect.assertions(2);
    const template = `<button t-on-click="add">Click</button>`;
    const fixture = mountToFixture(template, {
      add: (ev: any) => {
        expect(ev).toBeInstanceOf(Event);
      },
    });
    fixture.querySelector("button")!.click();
  });

  test("can bind two event handlers", () => {
    const template = `
        <button t-on-click="handleClick" t-on-dblclick="handleDblClick">Click</button>`;
    let steps: string[] = [];
    const fixture = mountToFixture(template, {
      handleClick() {
        steps.push("click");
      },
      handleDblClick() {
        steps.push("dblclick");
      },
    });
    expect(steps).toEqual([]);
    fixture.querySelector("button")!.click();
    expect(steps).toEqual(["click"]);
    fixture.querySelector("button")!.dispatchEvent(new Event("dblclick", { bubbles: true }));
    expect(steps).toEqual(["click", "dblclick"]);
  });

  test("can bind handlers with arguments", () => {
    const template = `<button t-on-click="() => add(5)">Click</button>`;
    let a = 1;
    const fixture = mountToFixture(template, { add: (n: number) => (a = a + n) });
    expect(a).toBe(1);
    fixture.querySelector("button")!.click();
    expect(a).toBe(6);
  });

  test("can bind handlers with object arguments", () => {
    const template = `<button t-on-click="() => add({val: 5})">Click</button>`;
    let a = 1;
    const fixture = mountToFixture(template, { add: ({ val }: any) => (a = a + val) });
    expect(a).toBe(1);
    fixture.querySelector("button")!.click();
    expect(a).toBe(6);
  });

  test("can bind handlers with empty  object", () => {
    expect.assertions(2);
    const template = `<button t-on-click="() => doSomething({})">Click</button>`;
    const fixture = mountToFixture(template, {
      doSomething(arg: any) {
        expect(arg).toEqual({});
      },
    });
    fixture.querySelector("button")!.click();
  });

  test("can bind handlers with empty object (with non empty inner string)", () => {
    expect.assertions(2);
    const template = `<button t-on-click="() => doSomething({ })">Click</button>`;
    const fixture = mountToFixture(template, {
      doSomething(arg: any) {
        expect(arg).toEqual({});
      },
    });
    fixture.querySelector("button")!.click();
  });

  test("can bind handlers with empty object (with non empty inner string)", () => {
    expect.assertions(2);
    const template = `
        <ul>
          <li t-foreach="['someval']" t-as="action" t-key="action_index">
            <a t-on-click="() => activate(action)">link</a>
          </li>
        </ul>`;
    const fixture = mountToFixture(template, {
      activate(action: string) {
        expect(action).toBe("someval");
      },
    });
    fixture.querySelector("a")!.click();
  });

  test("handler is bound to proper owner", () => {
    expect.assertions(2);
    const template = `<button t-on-click="add">Click</button>`;
    let owner = {
      add() {
        expect(this).toBe(owner);
      },
    };
    const fixture = mountToFixture(template, owner);
    fixture.querySelector("button")!.click();
  });

  test("handler is bound to proper owner, part 2", () => {
    expect.assertions(2);
    const template = `
        <t t-foreach="[1]" t-as="value" t-key="value">
          <button t-on-click="add">Click</button>
        </t>`;
    let owner = {
      add() {
        expect(this).toBe(owner);
      },
    };
    const fixture = mountToFixture(template, owner);
    fixture.querySelector("button")!.click();
  });

  test("handler is bound to proper owner, part 3", () => {
    expect.assertions(3);
    const context = new TemplateSet();
    const sub = `<button t-on-click="add">Click</button>`;
    const main = `<t t-call="sub"/>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    let owner: any = {
      add() {
        expect(this).toBe(owner);
      },
    };
    const node = { component: owner, status: STATUS.MOUNTED };
    owner.__owl__ = node;
    const fixture = makeTestFixture();
    const render = context.getTemplate("main");
    const bdom = render(owner, node);
    mount(bdom, fixture);
    fixture.querySelector("button")!.click();
  });

  test("handler is bound to proper owner, part 4", () => {
    expect.assertions(3);
    const context = new TemplateSet();
    const sub = `<button t-on-click="add">Click</button>`;
    const main = `
        <t t-foreach="[1]" t-as="value" t-key="value">
          <t t-call="sub"/>
        </t>`;
    context.addTemplate("sub", sub);
    context.addTemplate("main", main);

    let owner: any = {
      add() {
        expect(this).toBe(owner);
      },
    };
    const node = { component: owner, status: STATUS.MOUNTED };
    owner.__owl__ = node;
    const fixture = makeTestFixture();
    const render = context.getTemplate("main");
    const bdom = render(owner, node);
    mount(bdom, fixture);
    fixture.querySelector("button")!.click();
  });

  test("t-on with inline statement", () => {
    const template = `<button t-on-click="() => state.counter++">Click</button>`;
    let owner = { state: { counter: 0 } };
    const fixture = mountToFixture(template, owner);
    expect(owner.state.counter).toBe(0);
    fixture.querySelector("button")!.click();
    expect(owner.state.counter).toBe(1);
  });

  test("t-on with inline statement (function call)", () => {
    const template = `<button t-on-click="() => state.incrementCounter(2)">Click</button>`;
    let owner = {
      state: {
        counter: 0,
        incrementCounter: (inc: number) => {
          owner.state.counter += inc;
        },
      },
    };
    const fixture = mountToFixture(template, owner);
    expect(owner.state.counter).toBe(0);
    fixture.querySelector("button")!.click();
    expect(owner.state.counter).toBe(2);
  });

  test("t-on with inline statement, part 2", () => {
    const template = `<button t-on-click="() => state.flag = !state.flag">Toggle</button>`;
    let owner = {
      state: {
        flag: true,
      },
    };
    const fixture = mountToFixture(template, owner);
    expect(owner.state.flag).toBe(true);
    fixture.querySelector("button")!.click();
    expect(owner.state.flag).toBe(false);
    fixture.querySelector("button")!.click();
    expect(owner.state.flag).toBe(true);
  });

  test("t-on with inline statement, part 3", () => {
    const template = `<button t-on-click="() => state.n = someFunction(3)">Toggle</button>`;
    let owner = {
      someFunction(n: number) {
        return n + 1;
      },
      state: {
        n: 11,
      },
    };

    const fixture = mountToFixture(template, owner);
    expect(owner.state.n).toBe(11);
    fixture.querySelector("button")!.click();
    expect(owner.state.n).toBe(4);
  });

  test("t-on with t-call", async () => {
    expect.assertions(3);
    const app = new TemplateSet();
    const sub = `<p t-on-click="update">lucas</p>`;
    const main = `<div><t t-call="sub"/></div>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    let owner: any = {
      update() {
        expect(this).toBe(owner);
      },
    };
    const node = { component: owner, status: STATUS.MOUNTED };
    owner.__owl__ = node;

    const fixture = makeTestFixture();
    const render = app.getTemplate("main");
    const bdom = render(owner, node);
    mount(bdom, fixture);
    fixture.querySelector("p")!.click();
  });

  test("t-on, with arguments and t-call", async () => {
    expect.assertions(4);
    const app = new TemplateSet();
    const sub = `<p t-on-click="() => this.update(value)">lucas</p>`;
    const main = `<div><t t-call="sub"/></div>`;
    app.addTemplate("sub", sub);
    app.addTemplate("main", main);

    let owner: any = {
      update(val: number) {
        expect(this).toBe(owner);
        expect(val).toBe(444);
      },
      get this() {
        return owner;
      },
      value: 444,
    };

    const node = { component: owner, status: STATUS.MOUNTED };
    owner.__owl__ = node;

    const fixture = makeTestFixture();
    const render = app.getTemplate("main");
    const bdom = render.call(owner, owner, node);
    mount(bdom, fixture);
    fixture.querySelector("p")!.click();
  });

  test("nice error when t-on is evaluated with a missing event", () => {
    const template = `<div t-on="somemethod"></div>`;
    expect(() => renderToString(template, { someMethod() {} })).toThrow(
      "Missing event name with t-on directive"
    );
  });

  describe("t-on modifiers (native listener)", () => {
    test("basic support for native listener", () => {
      const template = `<div class="myClass" t-on-click="divClicked">
        <button t-on-click="btnClicked">Button</button>
      </div>`;

      const steps: string[] = [];

      const owner = {
        divClicked(ev: Event) {
          expect(ev.currentTarget).toBe(div);
          steps.push("divClicked");
        },
        btnClicked(ev: Event) {
          expect(ev.currentTarget).toBe(button);
          steps.push("btnClicked");
        },
      };
      const node = mountToFixture(template, owner);
      const div = node.querySelector(".myClass");
      const button = (<HTMLElement>node).getElementsByTagName("button")[0];
      button.click();
      expect(steps).toEqual(["btnClicked", "divClicked"]);
    });

    test("t-on with prevent and/or stop modifiers", async () => {
      expect.assertions(7);
      const template = `<div>
      <button t-on-click.prevent="onClickPrevented">Button 1</button>
      <button t-on-click.stop="onClickStopped">Button 2</button>
      <button t-on-click.prevent.stop="onClickPreventedAndStopped">Button 3</button>
      </div>`;

      let owner = {
        onClickPrevented(e: Event) {
          expect(e.defaultPrevented).toBe(true);
          expect(e.cancelBubble).toBe(false);
        },
        onClickStopped(e: Event) {
          expect(e.defaultPrevented).toBe(false);
          expect(e.cancelBubble).toBe(true);
        },
        onClickPreventedAndStopped(e: Event) {
          expect(e.defaultPrevented).toBe(true);
          expect(e.cancelBubble).toBe(true);
        },
      };

      const node = mountToFixture(template, owner);

      const buttons = (<HTMLElement>node).getElementsByTagName("button");
      buttons[0].click();
      buttons[1].click();
      buttons[2].click();
    });

    test("t-on with self modifier", async () => {
      expect.assertions(2);
      const template = `<div>
        <button t-on-click="onClick"><span>Button</span></button>
        <button t-on-click.self="onClickSelf"><span>Button</span></button>
      </div>`;
      let steps: string[] = [];
      let owner = {
        onClick(e: Event) {
          steps.push("onClick");
        },
        onClickSelf(e: Event) {
          steps.push("onClickSelf");
        },
      };
      const node = mountToFixture(template, owner);

      const buttons = (<HTMLElement>node).getElementsByTagName("button");
      const spans = (<HTMLElement>node).getElementsByTagName("span");
      spans[0].click();
      spans[1].click();
      buttons[0].click();
      buttons[1].click();

      expect(steps).toEqual(["onClick", "onClick", "onClickSelf"]);
    });

    test("t-on with self and prevent modifiers (order matters)", async () => {
      expect.assertions(2);
      const template = `<div>
        <button t-on-click.self.prevent="onClick"><span>Button</span></button>
      </div>`;
      let steps: boolean[] = [];
      let owner = {
        onClick() {},
      };
      const node = mountToFixture(template, owner);
      (<HTMLElement>node).addEventListener("click", function (e) {
        steps.push(e.defaultPrevented);
      });

      const button = (<HTMLElement>node).getElementsByTagName("button")[0];
      const span = (<HTMLElement>node).getElementsByTagName("span")[0];
      span.click();
      button.click();

      expect(steps).toEqual([false, true]);
    });

    test("t-on with prevent and self modifiers (order matters)", async () => {
      expect.assertions(2);
      const template = `<div>
        <button t-on-click.prevent.self="onClick"><span>Button</span></button>
      </div>`;
      let steps: boolean[] = [];
      let owner = {
        onClick() {},
      };
      const node = mountToFixture(template, owner);
      (<HTMLElement>node).addEventListener("click", function (e) {
        steps.push(e.defaultPrevented);
      });

      const button = (<HTMLElement>node).getElementsByTagName("button")[0];
      const span = (<HTMLElement>node).getElementsByTagName("span")[0];
      span.click();
      button.click();

      expect(steps).toEqual([true, true]);
    });

    test("t-on with prevent modifier in t-foreach", async () => {
      expect.assertions(5);
      const template = `<div>
        <t t-foreach="projects" t-as="project" t-key="project">
          <a href="#" t-on-click.prevent="ev => onEdit(project.id, ev)">
            Edit <t t-esc="project.name"/>
          </a>
        </t>
      </div>`;
      const steps: string[] = [];
      const owner = {
        projects: [
          { id: 1, name: "Project 1" },
          { id: 2, name: "Project 2" },
        ],

        onEdit(projectId: string, ev: Event) {
          expect(ev.defaultPrevented).toBe(true);
          steps.push(projectId);
        },
      };

      const node = mountToFixture(template, owner);
      expect(node.innerHTML).toBe(
        `<div><a href="#"> Edit Project 1</a><a href="#"> Edit Project 2</a></div>`
      );

      const links = node.querySelectorAll("a")!;
      links[0].click();
      links[1].click();

      expect(steps).toEqual([1, 2]);
    });

    test("t-on with empty handler (only modifiers)", () => {
      expect.assertions(2);
      const template = `<div>
        <button t-on-click.prevent="">Button</button>
      </div>`;
      const node = mountToFixture(template, {});

      node.addEventListener("click", (e) => {
        expect(e.defaultPrevented).toBe(true);
      });

      const button = (<HTMLElement>node).getElementsByTagName("button")[0];
      button.click();
    });

    test("t-on crashes when used with unknown modifier", async () => {
      const template = `<div t-on-click.somemodifier="onClick" />`;

      let owner = { onClick(e: Event) {} };

      expect(() => mountToFixture(template, owner)).toThrowError("Unknown event modifier");
    });

    test("t-on combined with t-esc", async () => {
      expect.assertions(3);
      const template = `<div><button t-on-click="onClick" t-esc="text"/></div>`;
      const steps: string[] = [];
      const owner = {
        text: "Click here",
        onClick() {
          steps.push("onClick");
        },
      };

      const node = mountToFixture(template, owner);
      expect(node.innerHTML).toBe(`<div><button>Click here</button></div>`);

      node.querySelector("button")!.click();

      expect(steps).toEqual(["onClick"]);
    });

    test("t-on combined with t-out", async () => {
      expect.assertions(3);
      const template = `<div><button t-on-click="onClick" t-out="html"/></div>`;
      const steps: string[] = [];
      const owner = {
        html: markup("Click <b>here</b>"),
        onClick() {
          steps.push("onClick");
        },
      };

      const node = mountToFixture(template, owner);
      expect(node.innerHTML).toBe(`<div><button>Click <b>here</b></button></div>`);

      node.querySelector("button")!.click();

      expect(steps).toEqual(["onClick"]);
    });

    test("t-on with .capture modifier", () => {
      expect.assertions(2);
      const template = `<div t-on-click.capture="onCapture">
        <button t-on-click="doSomething">Button</button>
      </div>`;

      const steps: string[] = [];
      const owner = {
        onCapture() {
          steps.push("captured");
        },
        doSomething() {
          steps.push("normal");
        },
      };
      const node = mountToFixture(template, owner);

      const button = (<HTMLElement>node).getElementsByTagName("button")[0];
      button.click();
      expect(steps).toEqual(["captured", "normal"]);
    });
  });

  describe("t-on modifiers (synthetic listener)", () => {
    test("basic support for synthetic", () => {
      const template = `<div t-on-click.synthetic="divClicked">
        <button t-on-click.synthetic="btnClicked">Button</button>
      </div>`;

      const steps: string[] = [];

      const owner = {
        divClicked(ev: Event) {
          expect(ev.currentTarget).toBe(document);
          steps.push("divClicked");
        },
        btnClicked(ev: Event) {
          expect(ev.currentTarget).toBe(document);
          steps.push("btnClicked");
        },
      };
      const node = mountToFixture(template, owner);
      const button = (<HTMLElement>node).getElementsByTagName("button")[0];
      button.click();
      expect(steps).toEqual(["btnClicked", "divClicked"]);
    });
  });
});
