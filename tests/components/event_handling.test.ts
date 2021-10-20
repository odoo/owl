import { makeTestFixture, snapshotEverything, nextTick } from "../helpers";
import { mount, Component, useState, xml } from "../../src/index";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("event handling", () => {
  test("can set handler on sub component", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child t-on-click="inc"/><t t-esc="state.value"/>`;
      static components = { Child };
      state = useState({ value: 1 });
      inc() {
        this.state.value++;
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>1");

    fixture.querySelector("div")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>2");
  });

  test("handler receive the event as argument", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child t-on-click="inc"/><t t-esc="state.value"/>`;
      static components = { Child };
      state = useState({ value: 1 });
      inc(ev: any) {
        this.state.value++;
        expect(ev.type).toBe("click");
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>1");

    fixture.querySelector("div")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>2");
  });

  test("support for callable expression in event handler", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.value"/><input type="text" t-on-input="obj.onInput"/></div>`;
      state = useState({ value: "" });
      obj = { onInput: (ev: any) => (this.state.value = ev.target.value) };
    }

    const counter = await mount(Counter, fixture);
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div><input type="text"></div>`);
    const input = (<HTMLElement>counter.el).getElementsByTagName("input")[0];
    input.value = "test";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div>test<input type="text"></div>`);
  });

  test.skip("t-on with prevent and/or stop modifiers", async () => {
    /*  expect.assertions(7);
    qweb.addTemplate(
      "test",
      `<div>
        <button t-on-click.prevent="onClickPrevented">Button 1</button>
        <button t-on-click.stop="onClickStopped">Button 2</button>
        <button t-on-click.prevent.stop="onClickPreventedAndStopped">Button 3</button>
      </div>`
    );
    let owner = {
      onClickPrevented(e) {
        expect(e.defaultPrevented).toBe(true);
        expect(e.cancelBubble).toBe(false);
      },
      onClickStopped(e) {
        expect(e.defaultPrevented).toBe(false);
        expect(e.cancelBubble).toBe(true);
      },
      onClickPreventedAndStopped(e) {
        expect(e.defaultPrevented).toBe(true);
        expect(e.cancelBubble).toBe(true);
      },
    };
    const node = renderToDOM(qweb, "test", owner, { handlers: [] });

    const buttons = (<HTMLElement>node).getElementsByTagName("button");
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();*/
  });

  test.skip("t-on with self modifier", async () => {
    /*expect.assertions(2);
    qweb.addTemplate(
      "test",
      `<div>
        <button t-on-click="onClick"><span>Button</span></button>
        <button t-on-click.self="onClickSelf"><span>Button</span></button>
      </div>`
    );
    let steps: string[] = [];
    let owner = {
      onClick(e) {
        steps.push("onClick");
      },
      onClickSelf(e) {
        steps.push("onClickSelf");
      },
    };
    const node = renderToDOM(qweb, "test", owner, { handlers: [] });

    const buttons = (<HTMLElement>node).getElementsByTagName("button");
    const spans = (<HTMLElement>node).getElementsByTagName("span");
    spans[0].click();
    spans[1].click();
    buttons[0].click();
    buttons[1].click();

    expect(steps).toEqual(["onClick", "onClick", "onClickSelf"]);*/
  });

  test.skip("t-on with self and prevent modifiers (order matters)", async () => {
    /*expect.assertions(2);
    qweb.addTemplate(
      "test",
      `<div>
        <button t-on-click.self.prevent="onClick"><span>Button</span></button>
      </div>`
    );
    let steps: boolean[] = [];
    let owner = {
      onClick() {},
    };
    const node = renderToDOM(qweb, "test", owner, { handlers: [] });
    (<HTMLElement>node).addEventListener("click", function (e) {
      steps.push(e.defaultPrevented);
    });

    const button = (<HTMLElement>node).getElementsByTagName("button")[0];
    const span = (<HTMLElement>node).getElementsByTagName("span")[0];
    span.click();
    button.click();

    expect(steps).toEqual([false, true]);*/
  });

  test.skip("t-on with prevent and self modifiers (order matters)", async () => {
    /*expect.assertions(2);
    qweb.addTemplate(
      "test",
      `<div>
        <button t-on-click.prevent.self="onClick"><span>Button</span></button>
      </div>`
    );
    let steps: boolean[] = [];
    let owner = {
      onClick() {},
    };
    const node = renderToDOM(qweb, "test", owner, { handlers: [] });
    (<HTMLElement>node).addEventListener("click", function (e) {
      steps.push(e.defaultPrevented);
    });

    const button = (<HTMLElement>node).getElementsByTagName("button")[0];
    const span = (<HTMLElement>node).getElementsByTagName("span")[0];
    span.click();
    button.click();

    expect(steps).toEqual([true, true]);*/
  });

  test.skip("t-on with prevent modifier in t-foreach", async () => {
    /*expect.assertions(5);
    qweb.addTemplate(
      "test",
      `<div>
        <t t-foreach="projects" t-as="project">
          <a href="#" t-key="project" t-on-click.prevent="onEdit(project.id)">
            Edit <t t-esc="project.name"/>
          </a>
        </t>
      </div>`
    );
    const steps: string[] = [];
    const owner = {
      projects: [
        { id: 1, name: "Project 1" },
        { id: 2, name: "Project 2" },
      ],

      onEdit(projectId, ev) {
        expect(ev.defaultPrevented).toBe(true);
        steps.push(projectId);
      },
    };

    const node = <HTMLElement>renderToDOM(qweb, "test", owner, { handlers: [] });
    expect(node.outerHTML).toBe(
      `<div><a href="#"> Edit Project 1</a><a href="#"> Edit Project 2</a></div>`
    );

    const links = node.querySelectorAll("a")!;
    links[0].click();
    links[1].click();

    expect(steps).toEqual([1, 2]);*/
  });

  test.skip("t-on with empty handler (only modifiers)", () => {
    /*expect.assertions(2);
    qweb.addTemplate(
      "test",
      `<div>
        <button t-on-click.prevent="">Button</button>
      </div>`
    );
    const node = renderToDOM(qweb, "test", {}, { handlers: [] });

    node.addEventListener("click", (e) => {
      expect(e.defaultPrevented).toBe(true);
    });

    const button = (<HTMLElement>node).getElementsByTagName("button")[0];
    button.click();*/
  });

  test.skip("t-on combined with t-esc", async () => {
    /*expect.assertions(3);
    qweb.addTemplate("test", `<div><button t-on-click="onClick" t-esc="text"/></div>`);
    const steps: string[] = [];
    const owner = {
      text: "Click here",
      onClick() {
        steps.push("onClick");
      },
    };

    const node = <HTMLElement>renderToDOM(qweb, "test", owner, { handlers: [] });
    expect(node.outerHTML).toBe(`<div><button>Click here</button></div>`);

    node.querySelector("button")!.click();

    expect(steps).toEqual(["onClick"]);*/
  });

  test.skip("t-on combined with t-raw", async () => {
    /*expect.assertions(3);
    qweb.addTemplate("test", `<div><button t-on-click="onClick" t-raw="html"/></div>`);
    const steps: string[] = [];
    const owner = {
      html: "Click <b>here</b>",
      onClick() {
        steps.push("onClick");
      },
    };

    const node = <HTMLElement>renderToDOM(qweb, "test", owner, { handlers: [] });
    expect(node.outerHTML).toBe(`<div><button>Click <b>here</b></button></div>`);

    node.querySelector("button")!.click();

    expect(steps).toEqual(["onClick"]);*/
  });

  test.skip("t-on with .capture modifier", () => {
    /*expect.assertions(2);
    qweb.addTemplate(
      "test",
      `<div t-on-click.capture="onCapture">
        <button t-on-click="doSomething">Button</button>
      </div>`
    );

    const steps: string[] = [];
    const owner = {
      onCapture() {
        steps.push("captured");
      },
      doSomething() {
        steps.push("normal");
      },
    };
    const node = renderToDOM(qweb, "test", owner, { handlers: [] });

    const button = (<HTMLElement>node).getElementsByTagName("button")[0];
    button.click();
    expect(steps).toEqual(["captured", "normal"]);*/
  });

  test.only("t-on with handler bound to dynamic argument on a t-foreach", async () => {
    expect.assertions(3);
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="items" t-as="item" t-key="item">
            <div class="item" t-on-click="onClick(item)"/>
          </t>
        </div>`;
      items = [1, 2, 3, 4];
      onClick(n: number, ev: MouseEvent) {
        expect(n).toBe(1);
        expect(ev).toBeInstanceOf(MouseEvent);
      }
    }

    await mount(Parent, fixture);
    (<HTMLElement>fixture.querySelector(".item")).click();
  });
});
