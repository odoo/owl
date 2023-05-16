import { Component, mount, xml } from "../../src";
import { makeTestFixture, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("translation support", () => {
  test("can translate node content", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>word</div>`;
    }

    await mount(SomeComponent, fixture, {
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
    });
    expect(fixture.innerHTML).toBe("<div>mot</div>");
  });

  test("does not translate node content if disabled", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <span>word</span>
          <span t-translation="off">word</span>
        </div>
      `;
    }

    await mount(SomeComponent, fixture, {
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
    });

    expect(fixture.innerHTML).toBe("<div><span>mot</span><span>word</span></div>");
  });

  test("some attributes are translated", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <p label="word">word</p>
          <p title="word">word</p>
          <p placeholder="word">word</p>
          <p alt="word">word</p>
          <p something="word">word</p>
        </div>
      `;
    }

    await mount(SomeComponent, fixture, {
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
    });
    expect(fixture.innerHTML).toBe(
      '<div><p label="mot">mot</p><p title="mot">mot</p><p placeholder="mot">mot</p><p alt="mot">mot</p><p something="word">mot</p></div>'
    );
  });

  test("can set and remove translatable attributes", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div tomato="word" potato="word" title="word" label="word">text</div>
      `;
    }

    await mount(SomeComponent, fixture, {
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
      translatableAttributes: ["potato", "-label"],
    });
    expect(fixture.innerHTML).toBe(
      '<div tomato="word" potato="mot" title="mot" label="word">text</div>'
    );
  });

  test("translation is done on the trimmed text, with extra spaces readded after", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div> word </div>
      `;
    }

    const translateFn = jest.fn((expr: string) => (expr === "word" ? "mot" : expr));

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("<div> mot </div>");
    expect(translateFn).toHaveBeenCalledWith("word");
  });

  test("translation works, even if initial string has inner consecutive white space", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>some  word</div>`;
    }

    const translateFn = jest.fn((expr: string) => (expr === "some  word" ? "un mot" : expr));

    await mount(SomeComponent, fixture, { translateFn });
    expect(translateFn).toHaveBeenCalledWith("some  word");
    expect(fixture.innerHTML).toBe("<div>un mot</div>");
  });

  test("body of t-sets are translated", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <t t-set="label">untranslated</t>
        <t t-esc="label"/>`;
    }

    const translateFn = () => "translated";

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("translated");
  });

  test("body of t-sets inside translation=off are not translated", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <t t-translation="off">
          <t t-set="label">untranslated</t>
          <t t-esc="label"/>
        </t>`;
    }

    const translateFn = () => "translated";

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("untranslated");
  });

  test("body of t-sets with html content are translated", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <t t-set="label"><div>untranslated</div></t>
        <t t-out="label"/>`;
    }

    const translateFn = () => "translated";

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("<div>translated</div>");
  });

  test("body of t-sets with text and html content are translated", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <t t-set="label">
          some text
          <div>untranslated</div>
        </t>
        <t t-out="label"/>`;
    }

    const translateFn = () => "translated";

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe(" translated <div>translated</div>");
  });

  test("t-set and falsy t-value: t-body are translated", async () => {
    class SomeComponent extends Component {
      static template = xml`
          <t t-set="label" t-value="false">untranslated</t>
          <t t-esc="label"/>`;
    }

    const translateFn = () => "translated";

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("translated");
  });
});
