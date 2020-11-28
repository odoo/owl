import { fromName, makeTestFixture, snapshotTemplateCode, nextTick } from "../helpers";
import { mount, Component, xml, useState } from "../../src/core";

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

    snapshotTemplateCode(fromName(Parent.template));

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>1");

    fixture.querySelector("div")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>2");
  });
});
