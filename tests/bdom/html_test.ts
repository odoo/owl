import { html, mount, patch, text } from "../../src/bdom";
import { makeTestFixture } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("html block", () => {
  test("can be mounted and patched", async () => {
    const tree = html("<span>1</span><span>2</span>");
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span>");

    patch(tree, html("<div>coucou</div>"));
    expect(fixture.innerHTML).toBe("<div>coucou</div>");
  });

  test("html vnode can be used as text", () => {
    mount(text(html("<p>a</p>") as any), fixture);
    expect(fixture.textContent).toBe("<p>a</p>");
  });
});
