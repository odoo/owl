import { beforeEach, expect, test } from "vitest";
import {
  App,
  Component,
  ErrorBoundary,
  effect,
  onError,
  onWillStart,
  signal,
  xml,
} from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

test("fallback renders when descendant throws during render", async () => {
  class Boom extends Component {
    static template = xml`<t t-out="this.explode()"/>`;
    explode() {
      throw new Error("kaboom");
    }
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary>
        <t t-set-slot="fallback">fallback</t>
        <Boom/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Boom };
  }

  await mount(Root);
  await nextTick();
  expect(fixture.textContent).toBe("fallback");
});

test("default slot renders when there is no error", async () => {
  class Child extends Component {
    static template = xml`<span>ok</span>`;
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary>
        <t t-set-slot="fallback">fallback</t>
        <Child/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Child };
  }

  await mount(Root);
  await nextTick();
  expect(fixture.querySelector("span")?.textContent).toBe("ok");
});

test("error prop signal receives the caught error", async () => {
  class Boom extends Component {
    static template = xml`<t t-out="this.explode()"/>`;
    explode() {
      throw new Error("kaboom");
    }
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary error="this.error">
        <t t-set-slot="fallback">
          error: <t t-out="this.error()?.message"/>
        </t>
        <Boom/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Boom };
    error = signal<Error | null>(null);
  }

  await mount(Root);
  await nextTick();
  expect(fixture.textContent!.replace(/\s+/g, " ").trim()).toBe("error: kaboom");
});

test("effect on error prop signal fires when an error is caught", async () => {
  const observed: any[] = [];
  const error = signal<Error | null>(null);
  effect(() => {
    const e = error();
    if (e) observed.push(e.message);
  });

  class Boom extends Component {
    static template = xml`<t t-out="this.explode()"/>`;
    explode() {
      throw new Error("kaboom");
    }
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary error="this.error">
        <t t-set-slot="fallback">fb</t>
        <Boom/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Boom };
    error = error;
  }

  await mount(Root);
  await nextTick();
  expect(observed).toEqual(["kaboom"]);
});

test("resetting the error prop signal to null re-renders the default slot", async () => {
  const shouldThrow = signal(true);
  class Flaky extends Component {
    static template = xml`<span t-if="!this.throws()">ok</span>`;
    throws = () => {
      if (shouldThrow()) {
        throw new Error("flaky");
      }
      return false;
    };
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary error="this.error">
        <t t-set-slot="fallback">fb</t>
        <Flaky/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Flaky };
    error = signal<Error | null>(null);
  }

  const root = await mount(Root);
  await nextTick();
  expect(fixture.textContent!.trim()).toBe("fb");

  shouldThrow.set(false);
  root.error.set(null);
  await nextTick();
  await nextTick();
  expect(fixture.querySelector("span")?.textContent).toBe("ok");
});

test("outer onError is not called when inner ErrorBoundary handles", async () => {
  const outerCaught: any[] = [];
  class Boom extends Component {
    static template = xml`<t t-out="this.explode()"/>`;
    explode() {
      throw new Error("kaboom");
    }
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary>
        <t t-set-slot="fallback">fb</t>
        <Boom/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Boom };
    setup() {
      onError((e) => outerCaught.push(e));
    }
  }

  await mount(Root);
  await nextTick();
  expect(fixture.textContent).toBe("fb");
  expect(outerCaught).toEqual([]);
});

test("catches errors thrown in descendant onWillStart during initial mount", async () => {
  const rpc = makeDeferred<void>();
  class AsyncBoom extends Component {
    static template = xml`<span>unreachable</span>`;
    setup() {
      onWillStart(async () => {
        await rpc;
        throw new Error("async kaboom");
      });
    }
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary error="this.error">
        <t t-set-slot="fallback">fb: <t t-out="this.error()?.message"/></t>
        <AsyncBoom/>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, AsyncBoom };
    error = signal<Error | null>(null);
  }

  const app = new App({ test: true });
  const mounted = app.createRoot(Root).mount(fixture);
  rpc.resolve();
  await mounted;
  expect(fixture.textContent!.replace(/\s+/g, " ").trim()).toBe("fb: async kaboom");
  app.destroy();
});

test("nested ErrorBoundary: inner catches, outer stays clean", async () => {
  const outerCaught: any[] = [];
  class Boom extends Component {
    static template = xml`<t t-out="this.explode()"/>`;
    explode() {
      throw new Error("inner kaboom");
    }
  }
  class Root extends Component {
    static template = xml`
      <ErrorBoundary>
        <t t-set-slot="fallback">outer fb</t>
        <ErrorBoundary>
          <t t-set-slot="fallback">inner fb</t>
          <Boom/>
        </ErrorBoundary>
      </ErrorBoundary>`;
    static components = { ErrorBoundary, Boom };
    setup() {
      onError((e) => outerCaught.push(e));
    }
  }

  await mount(Root);
  await nextTick();
  await nextTick();
  expect(fixture.textContent!.trim()).toBe("inner fb");
  expect(outerCaught).toEqual([]);
});

async function mount<T extends typeof Component>(C: T) {
  const app = new App({ test: true });
  return app.createRoot(C).mount(fixture);
}
