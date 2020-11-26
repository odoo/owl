import { Component, mount, onMounted, xml, onWillStart } from "../../src/core";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("lifecycle hooks", () => {
  test("willStart hook is called", async () => {
    let willstart = false;
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      async willStart() {
        willstart = true;
      }
    }

    await mount(Test, { target: fixture });
    expect(willstart).toBe(true);
  });

  test("willStart hook is called (hook in setup)", async () => {
    let willstart = false;
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        onWillStart(() => {
          willstart = true;
        });
      }
    }

    await mount(Test, { target: fixture });
    expect(willstart).toBe(true);
  });

  test("mounted hook is not called if not in DOM", async () => {
    let mounted = false;
    class Test extends Component {
      static template = xml`<div/>`;
      mounted() {
        mounted = true;
      }
    }
    const target = document.createElement("div");
    await mount(Test, { target });
    expect(mounted).toBe(false);
  });

  test("mounted hook is called if mounted in DOM", async () => {
    let mounted = false;
    class Test extends Component {
      static template = xml`<div/>`;
      mounted() {
        mounted = true;
      }
    }
    await mount(Test, { target: fixture });
    expect(mounted).toBe(true);
  });

  test("mounted hook is called if mounted in DOM (with hook)", async () => {
    let mounted = false;
    class Test extends Component {
      static template = xml`<div/>`;

      constructor(props: any) {
        super(props);
        onMounted(() => {
          mounted = true;
        });
      }
    }
    await mount(Test, { target: fixture });
    expect(mounted).toBe(true);
  });

  test("mounted hook is called if mounted in DOM (with hook in setup)", async () => {
    let mounted = false;
    class Test extends Component {
      static template = xml`<div/>`;

      setup() {
        onMounted(() => {
          mounted = true;
        });
      }
    }
    await mount(Test, { target: fixture });
    expect(mounted).toBe(true);
  });
});
