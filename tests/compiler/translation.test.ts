import { Component, mount, props, xml } from "../../src";
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
    expect(translateFn).toHaveBeenCalledWith("word", "");
  });

  test("translation works, even if initial string has inner consecutive white space", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>some  word</div>`;
    }

    const translateFn = jest.fn((expr: string) => (expr === "some  word" ? "un mot" : expr));

    await mount(SomeComponent, fixture, { translateFn });
    expect(translateFn).toHaveBeenCalledWith("some  word", "");
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

  test("body of t-sets inside translation=off are not translated 2", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <t>
          <t t-translation="off" t-set="label">untranslated</t>
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

  test("t-translation with several children", async () => {
    class SomeComponent extends Component {
      static template = xml`
          <div>
            <t t-translation="off">
                <div/>
                <div/>
            </t>
            <t t-if="true"/>
        </div>
      `;
    }
    await mount(SomeComponent, fixture);
    expect(fixture.outerHTML).toBe("<div><div><div></div><div></div></div></div>");
  });
});

describe("translation context", () => {
  test("translation of text in context", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>word</div>
        <div t-translation-context="fr">word</div>
      `;
    }

    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "fr" ? (expr === "word" ? "mot" : expr) : expr
    );

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("<div>word</div><div>mot</div>");
    expect(translateFn).toHaveBeenCalledWith("word", "");
    expect(translateFn).toHaveBeenCalledWith("word", "fr");
  });
  test("translation of attributes in context", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div t-translation-context="en" t-translation-context-title="fr" title="title" label="game"/>
      `;
    }

    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "fr" ? (expr === "title" ? "titre" : expr) : expr
    );

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe(`<div title="titre" label="game"></div>`);
    expect(translateFn).toHaveBeenCalledWith("title", "fr");
    expect(translateFn).toHaveBeenCalledWith("game", "en");
  });
  test("body of t-sets are translated in context", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <t t-set="label" t-translation-context="fr">untranslated</t>
        <t t-esc="label"/>`;
    }

    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "fr" ? "traduit" : expr
    );

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("traduit");
    expect(translateFn).toHaveBeenCalledWith("untranslated", "fr");
  });
  test("props with modifier .translate are translated in context", async () => {
    class ChildComponent extends Component {
      static template = xml`<span t-esc="this.props.text"/>`;
      props = props(["text"]);
    }

    class SomeComponent extends Component {
      static components = { ChildComponent };
      static template = xml`
        <ChildComponent text.translate="game" t-translation-context-text.translate="fr" />`;
    }

    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "fr" ? "jeu" : expr
    );

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("<span>jeu</span>");
    expect(translateFn).toHaveBeenCalledWith("game", "fr");
  });
  test("slot attrs and text contents are translated in context", async () => {
    class ChildComponent extends Component {
      static template = xml`
        <div t-translation-context="ja">
          <t t-call-slot="a"/>
        </div>`;
      props = props();
    }

    class SomeComponent extends Component {
      static components = { ChildComponent };
      static template = xml`
        <ChildComponent t-translation-context="fr">
          <t t-set-slot="a" title.translate="title" t-translation-context-title.translate="pt">game</t>
        </ChildComponent>
        `;
    }

    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "fr" ? "jeu" : translationCtx === "pt" ? "título" : expr
    );

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("<div>jeu</div>");
    expect(translateFn).toHaveBeenCalledWith("game", "fr");
    expect(translateFn).toHaveBeenCalledWith("title", "pt");
  });
  test("default slot params and content translated in context", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          <t
            t-call-slot="default"
            t-translation-context="fr"
            param.translate="param"
            title.translate="title"
            t-translation-context-title.translate="pt"
          >
            foo
          </t>
        </div>`;
      props = props();
    }

    const translateFn = jest.fn((expr: string, translationCtx: string) =>
      translationCtx === "pt" ? "título" : expr
    );

    await mount(SomeComponent, fixture, { translateFn });
    expect(fixture.innerHTML).toBe("<div> foo </div>");
    expect(translateFn).toHaveBeenCalledWith("foo", "fr");
    expect(translateFn).toHaveBeenCalledWith("param", "fr");
    expect(translateFn).toHaveBeenCalledWith("title", "pt");
  });

  test("t-translation-context with several children", async () => {
    class SomeComponent extends Component {
      static template = xml`
          <div>
            <t t-translation-context="ctx">
                <div/>
                <div/>
            </t>
            <t t-if="true"/>
        </div>
      `;
    }
    await mount(SomeComponent, fixture);
    expect(fixture.outerHTML).toBe("<div><div><div></div><div></div></div></div>");
  });
});
