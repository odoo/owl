import { Component } from "../../src/runtime/component";
import { mount, useState, xml } from "../../src/index";
import { editInput, makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-model directive", () => {
  test("basic use, on an input", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state.text"/>
          <span><t t-esc="state.text"/></span>
        </div>`;
      state = useState({ text: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("t-model on an input with an undefined value", async () => {
    class SomeComponent extends Component {
      static template = xml`<input t-model="state.text"/>`;
      state = useState({ text: undefined });
    }
    await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<input>");

    const input = fixture.querySelector("input")!;
    expect(input.value).toBe("");
  });

  test("basic use, on an input with bracket expression", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state['text']"/>
          <span><t t-esc="state.text"/></span>
        </div>`;
      state = useState({ text: "" });
    }

    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("throws if invalid expression", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state"/>
        </div>`;
      state = useState({ text: "" });
    }
    let error: Error;
    try {
      await mount(SomeComponent, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`Invalid t-model expression: "state" (it should be assignable)`);
  });

  test("basic use, on another key in component", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input t-model="some.text"/>
            <span><t t-esc="some.text"/></span>
        </div>`;
      some = useState({ text: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.some.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("on an input, type=checkbox", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input type="checkbox" t-model="state.flag"/>
            <span>
                <t t-if="state.flag">yes</t>
                <t t-else="">no</t>
            </span>
        </div>`;
      state = useState({ flag: false });
    }

    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe('<div><input type="checkbox"><span>no</span></div>');

    let input = fixture.querySelector("input")!;
    input.click();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><input type="checkbox"><span>yes</span></div>');
    expect(comp.state.flag).toBe(true);

    input.click();
    await nextTick();
    expect(comp.state.flag).toBe(false);
  });

  test("on an textarea", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <textarea t-model="state.text"/>
            <span><t t-esc="state.text"/></span>
        </div>`;
      state = useState({ text: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><textarea></textarea><span></span></div>");

    const textarea = fixture.querySelector("textarea")!;
    await editInput(textarea, "test");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><textarea></textarea><span>test</span></div>");
  });

  test("on an input type=radio", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input type="radio" id="one" value="One" t-model="state.choice"/>
            <input type="radio" id="two" value="Two" t-model="state.choice"/>
            <span>Choice: <t t-esc="state.choice"/></span>
        </div>`;
      state = useState({ choice: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: </span></div>'
    );

    const firstInput = fixture.querySelector("input")!;
    firstInput.click();
    await nextTick();
    expect(comp.state.choice).toBe("One");
    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: One</span></div>'
    );

    const secondInput = fixture.querySelectorAll("input")[1];
    secondInput.click();
    await nextTick();
    expect(comp.state.choice).toBe("Two");
    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: Two</span></div>'
    );
  });

  test("on an input type=radio, with initial value", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input type="radio" id="one" value="One" t-model="state.choice"/>
            <input type="radio" id="two" value="Two" t-model="state.choice"/>
        </div>`;
      state = useState({ choice: "Two" });
    }
    await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"></div>'
    );

    const secondInput = fixture.querySelectorAll("input")[1];
    expect(secondInput.checked).toBe(true);
  });

  test("on a select", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <select t-model="state.color">
                <option value="">Please select one</option>
                <option value="red">Red</option>
                <option value="blue">Blue</option>
            </select>
            <span>Choice: <t t-esc="state.color"/></span>
        </div>`;
      state = useState({ color: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><select><option value="">Please select one</option><option value="red">Red</option><option value="blue">Blue</option></select><span>Choice: </span></div>'
    );

    const select = fixture.querySelector("select")!;
    select.value = "red";
    select.dispatchEvent(new Event("change"));
    await nextTick();

    expect(comp.state.color).toBe("red");
    expect(fixture.innerHTML).toBe(
      '<div><select><option value="">Please select one</option><option value="red">Red</option><option value="blue">Blue</option></select><span>Choice: red</span></div>'
    );
  });

  test("on a select, initial state", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <select t-model="state.color">
            <option value="">Please select one</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
          </select>
        </div>
      `;
      state = useState({ color: "red" });
    }
    await mount(SomeComponent, fixture);
    const select = fixture.querySelector("select")!;
    expect(select.value).toBe("red");
  });

  test("on a sub state key", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state.something.text"/>
          <span><t t-esc="state.something.text"/></span>
        </div>
      `;
      state = useState({ something: { text: "" } });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.something.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("with expression having a changing key", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state.something[text.key]"/>
          <span><t t-esc="state.something[text.key]"/></span>
        </div>
      `;
      state: { something: { [key: string]: string } } = useState({ something: {} });
      text = useState({ key: "foo" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    let input = fixture.querySelector("input")!;
    await editInput(input, "footest");
    expect(comp.state.something[comp.text.key]).toBe("footest");
    expect(fixture.innerHTML).toBe("<div><input><span>footest</span></div>");

    comp.text.key = "bar";
    await nextTick();
    input = fixture.querySelector("input")!;
    await editInput(input, "test bar");
    expect(comp.state.something[comp.text.key]).toBe("test bar");
    expect(fixture.innerHTML).toBe("<div><input><span>test bar</span></div>");
  });

  test(".lazy modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
            <input t-model.lazy="state.text"/>
            <span><t t-esc="state.text"/></span>
        </div>
      `;
      state = useState({ text: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(comp.state.text).toBe("");
    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");
    input.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test(".trim modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model.trim="state.text"/>
          <span><t t-esc="state.text"/></span>
        </div>
      `;
      state = useState({ text: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    const input = fixture.querySelector("input")!;
    await editInput(input, " test ");
    expect(comp.state.text).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test(".number modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model.number="state.number"/>
          <span><t t-esc="state.number"/></span>
        </div>
      `;
      state = useState({ number: 0 });
    }
    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe("<div><input><span>0</span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "13");
    expect(comp.state.number).toBe(13);
    expect(fixture.innerHTML).toBe("<div><input><span>13</span></div>");

    await editInput(input, "invalid");
    expect(comp.state.number).toBe("invalid");
    expect(fixture.innerHTML).toBe("<div><input><span>invalid</span></div>");
  });

  test("in a t-foreach", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-foreach="state" t-as="thing" t-key="thing.id">
            <input type="checkbox" t-model="thing.f"/>
          </t>
        </div>
      `;
      state = useState([
        { f: false, id: 1 },
        { f: false, id: 2 },
        { f: false, id: 3 },
      ]);
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><input type="checkbox"><input type="checkbox"><input type="checkbox"></div>'
    );

    const input = fixture.querySelectorAll("input")[1]!;
    input.click();
    expect(comp.state[1].f).toBe(true);
    expect(comp.state[0].f).toBe(false);
    expect(comp.state[2].f).toBe(false);
  });

  test("in a t-foreach, part 2", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-foreach="state" t-as="thing" t-key="thing_index" >
            <input t-model="state[thing_index]"/>
          </t>
        </div>
      `;
      state = useState(["zuko", "iroh"]);
    }
    const comp = await mount(SomeComponent, fixture);
    expect(comp.state).toEqual(["zuko", "iroh"]);

    const input = fixture.querySelectorAll("input")[1]!;
    await editInput(input, "uncle iroh");
    expect(comp.state).toEqual(["zuko", "uncle iroh"]);
  });

  test("in a t-foreach, part 3", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-foreach="names" t-as="name" t-key="name_index">
            <input t-model="state.values[name]"/>
          </t>
        </div>
      `;
      names = ["Crusher", "Data", "Riker", "Worf"];
      state = useState({ values: {} });
    }
    const comp = await mount(SomeComponent, fixture);
    expect(comp.state).toEqual({ values: {} });

    const input = fixture.querySelectorAll("input")[1]!;
    await editInput(input, "Commander");
    expect(comp.state).toEqual({ values: { Data: "Commander" } });
  });

  test("two inputs in a div alternating with a t-if", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input class="a" t-if="state.flag" t-model="state.text1"/>
          <input class="b" t-if="!state.flag" t-model="state.text2"/>
        </div>
      `;
      state = useState({ flag: true, text1: "", text2: "" });
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe('<div><input class="a"></div>');
    let input = fixture.querySelector("input")!;
    expect(input.value).toBe("");
    await editInput(input, "Jean-Luc");
    expect(comp.state.text1).toBe("Jean-Luc");

    comp.state.flag = false;
    await nextTick();

    expect(fixture.innerHTML).toBe('<div><input class="b"></div>');
    input = fixture.querySelector("input")!;
    expect(input.value).toBe("");
    await editInput(input, "Picard");
    expect(comp.state.text2).toBe("Picard");
  });

  test("following a scope protecting directive (e.g. t-set)", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-set="admiral" t-value="'Bruno'"/>
          <input t-model="state['text']"/>
        </div>
      `;
      state = useState({ text: "Jean-Luc Picard" });
    }
    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe("<div><input></div>");
    const input = fixture.querySelector("input")!;
    expect(input.value).toBe("Jean-Luc Picard");
    await editInput(input, "Commander Data");
    expect(comp.state.text).toBe("Commander Data");
  });

  test("can also define t-on directive on same event, part 1", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state['text']" t-on-input="onInput"/>
        </div>
      `;
      state = useState({ text: "", other: "" });
      onInput(ev: InputEvent) {
        this.state.other = (ev.target as HTMLInputElement).value;
      }
    }
    const comp = await mount(SomeComponent, fixture);
    expect(comp.state.text).toBe("");
    expect(comp.state.other).toBe("");
    const input = fixture.querySelector("input")!;
    await editInput(input, "Beam me up, Scotty");
    expect(comp.state.text).toBe("Beam me up, Scotty");
    expect(comp.state.other).toBe("Beam me up, Scotty");
  });

  test("can also define t-on directive on same event, part 2", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input type="radio" id="one" value="One" t-model="state.choice" t-on-click="onClick"/>
          <input type="radio" id="two" value="Two" t-model="state.choice" t-on-click="onClick"/>
          <input type="radio" id="three" value="Three" t-model="state.choice" t-on-click="onClick"/>
        </div>
      `;
      state = useState({ choice: "", lastClicked: "" });
      onClick(ev: MouseEvent) {
        this.state.lastClicked = (ev.target as HTMLInputElement).value;
      }
    }

    const comp = await mount(SomeComponent, fixture);
    expect(comp.state.choice).toBe("");
    expect(comp.state.lastClicked).toBe("");

    const lastInput = fixture.querySelectorAll("input")[2];
    lastInput.click();
    await nextTick();
    expect(comp.state.choice).toBe("Three");
    expect(comp.state.lastClicked).toBe("Three");
  });

  test("t-model on select with static options", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="state.model">
             <option value="a" t-esc="'a'"/>
             <option value="b" t-esc="'b'"/>
             <option value="c" t-esc="'c'"/>
          </select>
        </div>
      `;
      state: any;
      options: any;
      setup() {
        this.state = useState({ model: "b" });
        this.options = ["a", "b", "c"];
      }
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="state.model">
             <option t-att-value="options[0]" t-esc="options[0]"/>
             <option t-att-value="options[1]" t-esc="options[1]"/>
          </select>
        </div>
      `;
      state: any;
      options: any;
      setup() {
        this.state = useState({ model: "b" });
        this.options = ["a", "b"];
      }
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options -- 2", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="state.model">
             <option t-att-value="options[0]" t-esc="options[0]"/>
             <option t-attf-value="{{ options[1] }}" t-esc="options[1]"/>
          </select>
        </div>
      `;
      state: any;
      options: any;
      setup() {
        this.state = useState({ model: "b" });
        this.options = ["a", "b"];
      }
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options -- 3", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="state.model">
             <option t-att-value="options[0]" t-esc="options[0]"/>
             <option value="b" t-esc="options[1]"/>
          </select>
        </div>
      `;
      state: any;
      options: any;
      setup() {
        this.state = useState({ model: "b" });
        this.options = ["a", "b"];
      }
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options in foreach", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="state.model">
            <t t-foreach="options" t-as="v" t-key="v">
                <option t-att-value="v" t-esc="v"/>
            </t>
          </select>
          </div>
      `;
      state: any;
      options: any;
      setup() {
        this.state = useState({ model: "b" });
        this.options = ["a", "b", "c"];
      }
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model is applied before t-on-input", async () => {
    expect.assertions(3);
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state['text']" t-on-input="onInput"/>
        </div>
      `;
      state = useState({ text: "", other: "" });
      onInput(ev: InputEvent) {
        expect(this.state.text).toBe("Beam me up, Scotty");
        expect((ev.target as HTMLInputElement).value).toBe("Beam me up, Scotty");
      }
    }
    await mount(SomeComponent, fixture);
    const input = fixture.querySelector("input")!;
    await editInput(input, "Beam me up, Scotty");
  });
});
