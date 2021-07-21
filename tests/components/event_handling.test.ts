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
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div>test<input type="text"></div>`);
  });
});
