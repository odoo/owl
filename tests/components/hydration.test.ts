import { Component, mount, useState, xml } from "../../src";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("hydration", () => {
  test("can hydrate a simple static component", async () => {
    fixture.innerHTML = "<div>giuoco pianissimo</div>";
    const target = fixture.firstChild as any;

    class Test extends Component {
      static template = xml`<div>giuoco pianissimo</div>`;
    }

    await mount(Test, target, { hydrate: true });

    expect(fixture.innerHTML).toBe("<div>giuoco pianissimo</div>");
    expect(fixture.firstChild).toBe(target);
  });

  test("can hydrate a component with a handler", async () => {
    fixture.innerHTML = "<div>0</div>";
    const target = fixture.firstChild as any;

    class Counter extends Component {
      static template = xml`<div t-on-click="inc"><t t-esc="state.value"/></div>`;

      state = useState({ value: 0 });

      inc() {
        this.state.value++;
      }
    }

    await mount(Counter, target, { hydrate: true });

    expect(fixture.innerHTML).toBe("<div>0</div>");
    expect(fixture.firstChild).toBe(target);

    target.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1</div>");
  });

  test("can hydrate a component with a sub component", async () => {
    fixture.innerHTML = "<p><button>0</button></p>";
    const target = fixture.firstChild as any;

    class Counter extends Component {
      static template = xml`<button t-on-click="inc"><t t-esc="state.value"/></button>`;

      state = useState({ value: 0 });

      inc() {
        this.state.value++;
      }
    }

    class Parent extends Component {
      static template = xml`<p><Counter/></p>`;
      static components = { Counter };
    }

    await mount(Parent, target, { hydrate: true });

    expect(fixture.innerHTML).toBe("<p><button>0</button></p>");
    expect(fixture.firstChild).toBe(target);

    target.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<p><button>1</button></p>");
  });
});
