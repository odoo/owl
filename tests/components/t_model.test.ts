import { Component } from "../../src/runtime/component";
import { derived, mount, signal, xml } from "../../src/index";
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
          <input t-model="this.text"/>
          <span><t t-esc="this.text()"/></span>
        </div>`;
      text = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("t-model on an input with an undefined value", async () => {
    class SomeComponent extends Component {
      static template = xml`<input t-model="this.text"/>`;
      text = signal<any>(undefined);
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
          <span><t t-esc="state.text()"/></span>
        </div>`;
      state = { text: signal("") };
    }

    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("throws if invalid expression", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="state"/>
        </div>`;
      state = { text: "" };
    }
    let error: Error;
    try {
      await mount(SomeComponent, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      `Invalid t-model expression: expression should evaluate to a function with a 'set' method defined on it`
    );
  });

  test("basic use, on another key in component", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input t-model="this.some.text"/>
            <span><t t-esc="this.some.text()"/></span>
        </div>`;
      some = { text: signal("") };
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.some.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("on an input, type=checkbox", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input type="checkbox" t-model="this.flag"/>
            <span>
                <t t-if="this.flag()">yes</t>
                <t t-else="">no</t>
            </span>
        </div>`;
      flag = signal(false);
    }

    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe('<div><input type="checkbox"><span>no</span></div>');

    let input = fixture.querySelector("input")!;
    input.click();
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><input type="checkbox"><span>yes</span></div>');
    expect(comp.flag()).toBe(true);

    input.click();
    await nextTick();
    expect(comp.flag()).toBe(false);
  });

  test("on an textarea", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <textarea t-model="this.text"/>
            <span><t t-esc="this.text()"/></span>
        </div>`;
      text = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><textarea></textarea><span></span></div>");

    const textarea = fixture.querySelector("textarea")!;
    await editInput(textarea, "test");
    expect(comp.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><textarea></textarea><span>test</span></div>");
  });

  test("on an input type=radio", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input type="radio" id="one" value="One" t-model="this.choice"/>
            <input type="radio" id="two" value="Two" t-model="this.choice"/>
            <span>Choice: <t t-esc="this.choice()"/></span>
        </div>`;
      choice = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: </span></div>'
    );

    const firstInput = fixture.querySelector("input")!;
    firstInput.click();
    await nextTick();
    expect(comp.choice()).toBe("One");
    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: One</span></div>'
    );

    const secondInput = fixture.querySelectorAll("input")[1];
    secondInput.click();
    await nextTick();
    expect(comp.choice()).toBe("Two");
    expect(fixture.innerHTML).toBe(
      '<div><input type="radio" id="one" value="One"><input type="radio" id="two" value="Two"><span>Choice: Two</span></div>'
    );
  });

  test("on an input type=radio, with initial value", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>
            <input type="radio" id="one" value="One" t-model="this.choice"/>
            <input type="radio" id="two" value="Two" t-model="this.choice"/>
        </div>`;
      choice = signal("Two");
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
            <select t-model="this.color">
                <option value="">Please select one</option>
                <option value="red">Red</option>
                <option value="blue">Blue</option>
            </select>
            <span>Choice: <t t-esc="this.color()"/></span>
        </div>`;
      color = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><select><option value="">Please select one</option><option value="red">Red</option><option value="blue">Blue</option></select><span>Choice: </span></div>'
    );

    const select = fixture.querySelector("select")!;
    select.value = "red";
    select.dispatchEvent(new Event("change"));
    await nextTick();

    expect(comp.color()).toBe("red");
    expect(fixture.innerHTML).toBe(
      '<div><select><option value="">Please select one</option><option value="red">Red</option><option value="blue">Blue</option></select><span>Choice: red</span></div>'
    );
  });

  test("on a select, initial state", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <select t-model="this.color">
            <option value="">Please select one</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
          </select>
        </div>
      `;
      color = signal("red");
    }
    await mount(SomeComponent, fixture);
    const select = fixture.querySelector("select")!;
    expect(select.value).toBe("red");
  });

  test("on a sub state key", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="this.state.something.text"/>
          <span><t t-esc="this.state.something.text()"/></span>
        </div>
      `;
      state = { something: { text: signal("") } };
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "test");
    expect(comp.state.something.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test("with expression having a changing key", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="this.state.something[this.key()]"/>
          <span><t t-esc="this.state.something[this.key()]()"/></span>
        </div>
      `;
      state = {
        something: {
          foo: signal(""),
          bar: signal(""),
        },
      };
      key = signal<"foo" | "bar">("foo");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    let input = fixture.querySelector("input")!;
    await editInput(input, "footest");
    expect(comp.state.something[comp.key()]()).toBe("footest");
    expect(fixture.innerHTML).toBe("<div><input><span>footest</span></div>");

    comp.key.set("bar");
    await nextTick();
    input = fixture.querySelector("input")!;
    await editInput(input, "test bar");
    expect(comp.state.something[comp.key()]()).toBe("test bar");
    expect(fixture.innerHTML).toBe("<div><input><span>test bar</span></div>");
  });

  test(".lazy modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
            <input t-model.lazy="this.text"/>
            <span><t t-esc="this.text()"/></span>
        </div>
      `;
      text = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(comp.text()).toBe("");
    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");
    input.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comp.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test(".trim modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model.trim="this.text"/>
          <span><t t-esc="this.text()"/></span>
        </div>
      `;
      text = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    const input = fixture.querySelector("input")!;
    await editInput(input, " test ");
    expect(comp.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test(".trim modifier implies .lazy modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
            <input t-model.trim="this.text"/>
            <span><t t-esc="this.text()"/></span>
        </div>
      `;
      text = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");

    const input = fixture.querySelector("input")!;
    input.value = "test ";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(comp.text()).toBe("");
    expect(fixture.innerHTML).toBe("<div><input><span></span></div>");
    input.dispatchEvent(new Event("change"));
    await nextTick();
    expect(comp.text()).toBe("test");
    expect(fixture.innerHTML).toBe("<div><input><span>test</span></div>");
  });

  test(".number modifier", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model.number="this.number"/>
          <span><t t-esc="this.number()"/></span>
        </div>
      `;
      number = signal(0);
    }
    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe("<div><input><span>0</span></div>");

    const input = fixture.querySelector("input")!;
    await editInput(input, "13");
    expect(comp.number()).toBe(13);
    expect(fixture.innerHTML).toBe("<div><input><span>13</span></div>");

    await editInput(input, "invalid");
    expect(comp.number()).toBe("invalid");
    expect(fixture.innerHTML).toBe("<div><input><span>invalid</span></div>");
  });

  test("in a t-foreach", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-foreach="this.things" t-as="thing" t-key="thing.id">
            <input type="checkbox" t-model="thing.f"/>
          </t>
        </div>
      `;
      things = [
        { f: signal(false), id: 1 },
        { f: signal(false), id: 2 },
        { f: signal(false), id: 3 },
      ];
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><input type="checkbox"><input type="checkbox"><input type="checkbox"></div>'
    );

    const input = fixture.querySelectorAll("input")[1]!;
    input.click();
    expect(comp.things[1].f()).toBe(true);
    expect(comp.things[0].f()).toBe(false);
    expect(comp.things[2].f()).toBe(false);
  });

  test("in a t-foreach, part 2", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-foreach="this.things" t-as="thing" t-key="thing_index">
            <input t-model="this.things[thing_index]"/>
          </t>
        </div>
      `;
      things = [signal("zuko"), signal("iroh")];
    }
    const comp = await mount(SomeComponent, fixture);
    expect(comp.things.map((thing) => thing())).toEqual(["zuko", "iroh"]);

    const input = fixture.querySelectorAll("input")[1]!;
    await editInput(input, "uncle iroh");
    expect(comp.things.map((thing) => thing())).toEqual(["zuko", "uncle iroh"]);
  });

  test("in a t-foreach, part 3", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-foreach="this.names" t-as="name" t-key="name_index">
            <input t-model="this.values[name]"/>
          </t>
        </div>
      `;
      names = ["Crusher", "Data", "Riker", "Worf"];
      values = {
        Crusher: signal(""),
        Data: signal(""),
        Riker: signal(""),
        Worf: signal(""),
      };
    }
    const comp = await mount(SomeComponent, fixture);
    const values = derived(() => ({
      Crusher: comp.values.Crusher(),
      Data: comp.values.Data(),
      Riker: comp.values.Riker(),
      Worf: comp.values.Worf(),
    }));
    expect(values()).toEqual({
      Crusher: "",
      Data: "",
      Riker: "",
      Worf: "",
    });

    const input = fixture.querySelectorAll("input")[1]!;
    await editInput(input, "Commander");
    expect(values()).toEqual({
      Crusher: "",
      Data: "Commander",
      Riker: "",
      Worf: "",
    });
  });

  test("two inputs in a div alternating with a t-if", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input class="a" t-if="this.flag()" t-model="this.text1"/>
          <input class="b" t-if="!this.flag()" t-model="this.text2"/>
        </div>
      `;
      flag = signal(true);
      text1 = signal("");
      text2 = signal("");
    }
    const comp = await mount(SomeComponent, fixture);

    expect(fixture.innerHTML).toBe('<div><input class="a"></div>');
    let input = fixture.querySelector("input")!;
    expect(input.value).toBe("");
    await editInput(input, "Jean-Luc");
    expect(comp.text1()).toBe("Jean-Luc");

    comp.flag.set(false);
    await nextTick();

    expect(fixture.innerHTML).toBe('<div><input class="b"></div>');
    input = fixture.querySelector("input")!;
    expect(input.value).toBe("");
    await editInput(input, "Picard");
    expect(comp.text2()).toBe("Picard");
  });

  test("following a scope protecting directive (e.g. t-set)", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t t-set="admiral" t-value="'Bruno'"/>
          <input t-model="this.text"/>
        </div>
      `;
      text = signal("Jean-Luc Picard");
    }
    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe("<div><input></div>");
    const input = fixture.querySelector("input")!;
    expect(input.value).toBe("Jean-Luc Picard");
    await editInput(input, "Commander Data");
    expect(comp.text()).toBe("Commander Data");
  });

  test("can also define t-on directive on same event, part 1", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="this.text" t-on-input="onInput"/>
        </div>
      `;
      text = signal("");
      other = signal("");
      onInput(ev: InputEvent) {
        this.other.set((ev.target as HTMLInputElement).value);
      }
    }
    const comp = await mount(SomeComponent, fixture);
    expect(comp.text()).toBe("");
    expect(comp.other()).toBe("");
    const input = fixture.querySelector("input")!;
    await editInput(input, "Beam me up, Scotty");
    expect(comp.text()).toBe("Beam me up, Scotty");
    expect(comp.other()).toBe("Beam me up, Scotty");
  });

  test("can also define t-on directive on same event, part 2", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input type="radio" id="one" value="One" t-model="this.choice" t-on-click="onClick"/>
          <input type="radio" id="two" value="Two" t-model="this.choice" t-on-click="onClick"/>
          <input type="radio" id="three" value="Three" t-model="this.choice" t-on-click="onClick"/>
        </div>
      `;
      choice = signal("");
      lastClicked = signal("");
      onClick(ev: MouseEvent) {
        this.lastClicked.set((ev.target as HTMLInputElement).value);
      }
    }

    const comp = await mount(SomeComponent, fixture);
    expect(comp.choice()).toBe("");
    expect(comp.lastClicked()).toBe("");

    const lastInput = fixture.querySelectorAll("input")[2];
    lastInput.click();
    await nextTick();
    expect(comp.choice()).toBe("Three");
    expect(comp.lastClicked()).toBe("Three");
  });

  test("t-model on select with static options", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="this.model">
             <option value="a" t-esc="'a'"/>
             <option value="b" t-esc="'b'"/>
             <option value="c" t-esc="'c'"/>
          </select>
        </div>
      `;
      model = signal("b");
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="this.model">
             <option t-att-value="this.options[0]" t-esc="this.options[0]"/>
             <option t-att-value="this.options[1]" t-esc="this.options[1]"/>
          </select>
        </div>
      `;
      model = signal("b");
      options = ["a", "b"];
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options -- 2", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="this.model">
             <option t-att-value="this.options[0]" t-esc="this.options[0]"/>
             <option t-attf-value="{{ this.options[1] }}" t-esc="this.options[1]"/>
          </select>
        </div>
      `;
      model = signal("b");
      options = ["a", "b"];
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options -- 3", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="this.model">
             <option t-att-value="this.options[0]" t-esc="this.options[0]"/>
             <option value="b" t-esc="this.options[1]"/>
          </select>
        </div>
      `;
      model = signal("b");
      options = ["a", "b"];
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic values on select options in foreach", async () => {
    class Test extends Component {
      static template = xml`
        <div>
          <select t-model="this.model">
            <t t-foreach="this.options" t-as="v" t-key="v">
                <option t-att-value="v" t-esc="v"/>
            </t>
          </select>
        </div>
      `;
      model = signal("b");
      options = ["a", "b", "c"];
    }

    await mount(Test, fixture);
    expect(fixture.querySelector("select")!.value).toEqual("b");
  });

  test("t-model with dynamic number values on select options in foreach", async () => {
    class Test extends Component {
      static template = xml`
          <select t-model.number="this.value">
            <t t-foreach="this.options" t-as="o" t-key="o.value">
                <option t-att-value="o.value" t-esc="o.value"/>
            </t>
          </select>
      `;
      value = signal(2);
      options = [{ value: 1 }, { value: 2 }, { value: 3 }];
    }

    const comp = await mount(Test, fixture);
    // check that we have a value of 2 selected
    expect(fixture.querySelector("select")!.value).toEqual("2");
    expect(comp.value()).toBe(2);

    // emulate a click on the option=3 element
    fixture.querySelectorAll("option")[2].selected = true;
    fixture.querySelector("select")!.dispatchEvent(new Event("change"));

    await nextTick();
    // check that we have now selected the number 3 (and not the string)
    expect(fixture.querySelector("select")!.value).toEqual("3");
    expect(comp.value()).toBe(3);
  });

  test("t-model is applied before t-on-input", async () => {
    expect.assertions(3);
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <input t-model="this.state['text']" t-on-input="onInput"/>
        </div>
      `;
      state = { text: signal("") };
      onInput(ev: InputEvent) {
        expect(this.state.text()).toBe("Beam me up, Scotty");
        expect((ev.target as HTMLInputElement).value).toBe("Beam me up, Scotty");
      }
    }
    await mount(SomeComponent, fixture);
    const input = fixture.querySelector("input")!;
    await editInput(input, "Beam me up, Scotty");
  });

  test("t-model with radio button group in t-foreach", async () => {
    expect.assertions(6);
    const steps: string[] = [];
    class SomeComponent extends Component {
      static template = xml`
        <div t-on-click="getData" id="get_data">
          <t t-foreach="this.options" t-as="opt" t-key="opt">
            <input type="radio" name="radio_group" t-model="this.group" t-att-value="opt" t-att-id="opt"/>
          </t>
        </div>
      `;
      group = signal("scotty");
      options = ["beam", "scotty"];

      getData() {
        steps.push(`group: ${this.group()}`);
      }
    }
    await mount(SomeComponent, fixture);
    const divEl = fixture.querySelector("#get_data") as HTMLElement;
    expect(fixture.querySelector("input:checked")!.getAttribute("id")).toBe("scotty");
    divEl.click();
    expect(steps).toEqual(["group: scotty"]);
    fixture.querySelector("input")!.click();
    expect(steps).toEqual(["group: scotty", "group: beam"]);
    await nextTick();
    expect(fixture.querySelector("input:checked")!.getAttribute("id")).toBe("beam");
    divEl.click();
    expect(steps).toEqual(["group: scotty", "group: beam", "group: beam"]);
  });
});
