describe.skip("reactivity in lifecycle", () => {
  test("state changes in willUnmount do not trigger rerender", async () => {
    // const steps: string[] = [];

    // class Child extends Component {
    //   static template = xml`
    //       <span><t t-esc="props.val"/><t t-esc="state.n"/></span>
    //     `;
    //   state = useState({ n: 2 });
    //   __render(f) {
    //     steps.push("render");
    //     return super.__render(f);
    //   }
    //   willPatch() {
    //     steps.push("willPatch");
    //   }
    //   patched() {
    //     steps.push("patched");
    //   }

    //   willUnmount() {
    //     steps.push("willUnmount");
    //     this.state.n = 3;
    //   }
    // }
    // class Parent extends Component {
    //   static template = xml`
    //       <div>
    //         <Child t-if="state.flag" val="state.val"/>
    //       </div>
    //     `;
    //   static components = { Child };
    //   state = useState({ val: 1, flag: true });
    // }

    // const widget = await mount(Parent, { target: fixture });
    // expect(steps).toEqual(["render"]);
    // expect(fixture.innerHTML).toBe("<div><span>12</span></div>");
    // widget.state.flag = false;
    // await nextTick();
    // // we make sure here that no call to __render is done
    // expect(steps).toEqual(["render", "willUnmount"]);
  });

  test("state changes in willUnmount will be applied on remount", async () => {
    // class TestWidget extends Component {
    //   static template = xml`
    //       <div><t t-esc="state.val"/></div>
    //     `;
    //   state = useState({ val: 1 });
    //   willUnmount() {
    //     this.state.val = 3;
    //   }
    // }

    // const widget = new TestWidget();
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>1</div>");
    // widget.unmount();
    // expect(fixture.innerHTML).toBe("");
    // await nextTick(); // wait for changes to be detected before remounting
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>3</div>");
    // // we want to make sure that there are no remaining tasks left at this point.
    // expect(Component.scheduler.tasks.length).toBe(0);
  });

  test("change state just before mounting component", async () => {
    // const steps: number[] = [];
    // class TestWidget extends Component {
    //   static template = xml`
    //       <div><t t-esc="state.val"/></div>
    //     `;
    //   state = useState({ val: 1 });
    //   __render(f) {
    //     steps.push(this.state.val);
    //     return super.__render(f);
    //   }
    // }
    // TestWidget.prototype.__render = jest.fn(TestWidget.prototype.__render);

    // const widget = new TestWidget();
    // widget.state.val = 2;
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>2</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(1);

    // // unmount and re-mount, as in this case, willStart won't be called, so it's
    // // slightly different
    // widget.unmount();
    // widget.state.val = 3;
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>3</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(2);
    // expect(steps).toEqual([2, 3]);
  });

  test("change state while mounting component", async () => {
    // const steps: number[] = [];
    // class TestWidget extends Component {
    //   static template = xml`
    //       <div><t t-esc="state.val"/></div>
    //     `;
    //   state = useState({ val: 1 });
    //   __render(f) {
    //     steps.push(this.state.val);
    //     return super.__render(f);
    //   }
    // }
    // TestWidget.prototype.__render = jest.fn(TestWidget.prototype.__render);
    // TestWidget.prototype.__patch = jest.fn(TestWidget.prototype.__patch);

    // const widget = new TestWidget();
    // let prom = widget.mount(fixture);
    // widget.state.val = 2;
    // await prom;
    // expect(fixture.innerHTML).toBe("<div>2</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(1);

    // // unmount and re-mount, as in this case, willStart won't be called, so it's
    // // slightly different
    // widget.unmount();
    // prom = widget.mount(fixture);
    // widget.state.val = 3;
    // await prom;
    // expect(fixture.innerHTML).toBe("<div>3</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(3);
    // expect(TestWidget.prototype.__patch).toHaveBeenCalledTimes(2);
    // expect(steps).toEqual([2, 2, 3]);
  });

  test("change state and render while mounted in detached dom", async () => {
    // class App extends Component {
    //   static template = xml`<div><t t-esc="state.val"/></div>`;
    //   state = useState({ val: 1 });
    // }

    // const detachedDiv = document.createElement("div");
    // const app = await mount(App, { target: detachedDiv });

    // expect(detachedDiv.innerHTML).toBe("<div>1</div>");
    // app.state.val = 2;
    // await nextTick();
    // expect(detachedDiv.innerHTML).toBe("<div>2</div>");
  });

  test("destroy and change state after mounted in detached dom", async () => {
    // class App extends Component {
    //   static template = xml`<div><t t-esc="state.val"/></div>`;
    //   state = useState({ val: 1 });
    // }

    // const detachedDiv = document.createElement("div");
    // const app = await mount(App, { target: detachedDiv });

    // expect(detachedDiv.innerHTML).toBe("<div>1</div>");

    // app.destroy();
    // app.state.val = 2;
    // await nextTick();
    // expect(detachedDiv.innerHTML).toBe("");
  });

  test("change state while component is unmounted", async () => {
    // let child;
    // class Child extends Component {
    //   static template = xml`<span t-esc="state.val"/>`;
    //   state = useState({
    //     val: "C1",
    //   });
    //   constructor(parent, props) {
    //     super(parent, props);
    //     child = this;
    //   }
    // }

    // class Parent extends Component {
    //   static components = { Child };
    //   static template = xml`<div><t t-esc="state.val"/><Child/></div>`;
    //   state = useState({ val: "P1" });
    // }

    // const parent = new Parent();
    // await parent.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>P1<span>C1</span></div>");

    // parent.unmount();
    // expect(fixture.innerHTML).toBe("");

    // parent.state.val = "P2";
    // child.state.val = "C2";

    // await parent.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>P2<span>C2</span></div>");
  });
})