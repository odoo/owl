import { makeTestFixture, snapshotEverything, nextTick, logStep, nextMicroTick } from "../helpers";
import { mount, Component, useState, xml, App } from "../../src/index";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("event handling", () => {
  test("handler receive the event as argument", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<span t-on-click="inc"><Child/><t t-esc="state.value"/></span>`;
      static components = { Child };
      state = useState({ value: 1 });
      inc(ev: any) {
        this.state.value++;
        expect(ev.type).toBe("click");
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div>1</span>");

    fixture.querySelector("div")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div>2</span>");
  });

  test("Invalid handler throws an error", async () => {
    window.addEventListener(
      "error",
      (ev) => {
        logStep(ev.error.message);
        ev.preventDefault();
      },
      { once: true }
    );

    class Parent extends Component {
      static template = xml`<button t-on-click="dosomething">click</button>`;

      doSomething() {}
    }

    await mount(Parent, fixture);
    expect([]).toBeLogged();
    fixture.querySelector("button")!.click();
    expect(["Invalid handler (expected a function, received: 'undefined')"]).toBeLogged();
  });

  test("support for callable expression in event handler", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.value"/><input type="text" t-on-input="obj.onInput"/></div>`;
      state = useState({ value: "" });
      obj = { onInput: (ev: any) => (this.state.value = ev.target.value) };
    }

    await mount(Counter, fixture);
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div><input type="text"></div>`);
    const input = fixture.getElementsByTagName("input")[0];
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div>test<input type="text"></div>`);
  });

  test("t-on with handler bound to dynamic argument on a t-foreach", async () => {
    let onClickArgs: [number, MouseEvent] | null = null;
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="items" t-as="item" t-key="item">
            <div class="item" t-on-click="ev => onClick(item, ev)"/>
          </t>
        </div>`;
      items = [1, 2, 3, 4];
      onClick(n: number, ev: MouseEvent) {
        onClickArgs = [n, ev];
      }
    }

    await mount(Parent, fixture);
    expect(onClickArgs).toBeNull();
    (<HTMLElement>fixture.querySelector(".item")).click();
    expect(onClickArgs![0]).toBe(1);
    expect(onClickArgs![1]).toBeInstanceOf(MouseEvent);
  });

  test("objects from scope are properly captured by t-on", async () => {
    let onClickArgs: [number, MouseEvent] | null = null;
    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="items" t-as="item" t-key="item">
            <div class="item" t-on-click="ev => onClick(item.val, ev)"/>
          </t>
        </div>`;
      items = [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }];
      onClick(n: number, ev: MouseEvent) {
        onClickArgs = [n, ev];
      }
    }
    await mount(Parent, fixture);
    expect(onClickArgs).toBeNull();
    (<HTMLElement>fixture.querySelector(".item")).click();
    expect(onClickArgs![0]).toBe(1);
    expect(onClickArgs![1]).toBeInstanceOf(MouseEvent);
  });

  test("handler is not called if component is destroyed", async () => {
    class Parent extends Component {
      static template = xml`<span t-on-click="click"/>`;
      click() {
        logStep("click");
      }
    }

    const app = new App(Parent);
    await app.mount(fixture);
    const span = fixture.querySelector("span")!;

    span.click();
    expect(["click"]).toBeLogged();

    app.destroy();
    expect([]).toBeLogged();

    span.click();
    expect([]).toBeLogged();
  });

  test("input blur event is not called if component is destroyed", async () => {
    class Child extends Component {
      static template = xml`<input t-on-blur="blur"/>`;

      blur() {
        logStep("blur");
      }
    }
    class Parent extends Component {
      static template = xml`
      <div>
        <t t-if="state.cond"><Child/></t>
        <textarea/>
      </div>`;
      static components = { Child };

      state = useState({ cond: true });
    }

    const parent = await mount(Parent, fixture);

    fixture.querySelector("input")!.focus();
    await nextMicroTick();
    // to unfocus input
    fixture.querySelector("textarea")!.focus();
    expect(["blur"]).toBeLogged();

    fixture.querySelector("input")!.focus();
    parent.state.cond = false;
    await nextTick();
    // input is removed when component is destroyed => nothing should happen
    expect([]).toBeLogged();
  });

  test("handler works when app is mounted in an iframe", async () => {
    let clickCount = 0;

    class Parent extends Component {
      static template = xml`<span t-on-click="inc">click me</span>`;
      inc() {
        clickCount++;
      }
    }
    const iframe = document.createElement("iframe");
    fixture.appendChild(iframe);
    const iframeDoc = iframe.contentDocument!;
    await mount(Parent, iframeDoc.body);
    expect(clickCount).toBe(0);
    iframeDoc.querySelector("span")!.click();
    expect(clickCount).toBe(1);
  });
});
