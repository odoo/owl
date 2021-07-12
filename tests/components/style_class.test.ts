import { Component, mount, xml } from "../../src";
import { fromName, makeTestFixture, snapshotTemplateCode } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("style and class handling", () => {
  test("can set style and class on component", async () => {
    class Test extends Component {
      static template = xml`
          <div style="font-weight:bold;" class="some-class">world</div>
        `;
    }
    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div style="font-weight:bold;" class="some-class">world</div>`);
    snapshotTemplateCode(fromName(Test.template));
  });

  test("can set class on sub component", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="some-class" />`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div class="some-class">child</div>`);
  });

  test("can set more than one class on sub component", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="a  b" />`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div class="a b">child</div>`);
  });

  test("component class and parent class combine together", async () => {
    class Child extends Component {
      static template = xml`<div class="child">child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="from parent" />`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div class="child from parent">child</div>`);
  });

  test("setting a class on a child component with text node", async () => {
    class Child extends Component {
      static template = xml`child`;
    }

    class Parent extends Component {
      static template = xml`<Child class="some-class" />`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`child`);
  });

  test("can set class on sub sub component", async () => {
    class ChildChild extends Component {
      static template = xml`<div>childchild</div>`;
    }

    class Child extends Component {
      static template = xml`<ChildChild class="fromchild" />`;
      static components = { ChildChild };
    }

    class Parent extends Component {
      static template = xml`<Child class="fromparent" />`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div class="fromchild fromparent">childchild</div>`);
  });

  test("can set class on multi root component", async () => {
    class Child extends Component {
      static template = xml`<div>a</div><span>b</span>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="fromparent" />`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div class="fromparent">a</div><span>b</span>`);
  });
});
