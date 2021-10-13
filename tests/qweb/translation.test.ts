import { App, Component } from "../../src";
import { makeTestFixture, snapshotApp } from "../helpers";
import { xml } from "../../src/tags";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("translation support", () => {
  test("can translate node content", async () => {
    class SomeComponent extends Component {
      static template = xml`<div>word</div>`;
    }

    const app = new App(SomeComponent);
    app.configure({
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
    });
    const comp = await app.mount(fixture);

    const el = comp.el as HTMLElement;

    expect(el.outerHTML).toBe("<div>mot</div>");
    snapshotApp(app);
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

    const app = new App(SomeComponent);
    app.configure({
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
    });
    const comp = await app.mount(fixture);

    const el = comp.el as HTMLElement;

    expect(el.outerHTML).toBe("<div><span>mot</span><span>word</span></div>");
    snapshotApp(app);
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

    const app = new App(SomeComponent);
    app.configure({
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
    });
    const comp = await app.mount(fixture);

    const el = comp.el as HTMLElement;

    expect(el.outerHTML).toBe(
      '<div><p label="mot">mot</p><p title="mot">mot</p><p placeholder="mot">mot</p><p alt="mot">mot</p><p something="word">mot</p></div>'
    );
    snapshotApp(app);
  });

  test("can set translatable attributes", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div tomato="word" potato="word" title="word">text</div>
      `;
    }

    const app = new App(SomeComponent);
    app.configure({
      translateFn: (expr: string) => (expr === "word" ? "mot" : expr),
      translatableAttributes: ["potato"],
    });
    const comp = await app.mount(fixture);

    const el = comp.el as HTMLElement;
    expect(el.outerHTML).toBe('<div tomato="word" potato="mot" title="word">text</div>');
    snapshotApp(app);
  });

  test("translation is done on the trimmed text, with extra spaces readded after", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div> word </div>
      `;
    }

    const translateFn = jest.fn((expr: string) => (expr === "word" ? "mot" : expr));

    const app = new App(SomeComponent);
    app.configure({ translateFn });
    const comp = await app.mount(fixture);

    const el = comp.el as HTMLElement;

    expect(el.outerHTML).toBe("<div> mot </div>");
    expect(translateFn).toHaveBeenCalledWith("word");
    snapshotApp(app);
  });
});
