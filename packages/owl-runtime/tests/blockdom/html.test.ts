import { html, mount, patch, text } from "../../src/blockdom";
import { markup } from "../../src/utils";
import { makeTestFixture } from "./helpers";

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

  test("patching with an equal Markup keeps the content nodes", () => {
    const tree = html(markup("<b>foo</b>") as any);
    mount(tree, fixture);
    const b = fixture.querySelector("b");

    patch(tree, html(markup("<b>foo</b>") as any));
    expect(fixture.querySelector("b")).toBe(b);

    patch(tree, html(markup("<b>bar</b>") as any));
    expect(fixture.querySelector("b")).not.toBe(b);
    expect(fixture.innerHTML).toBe("<b>bar</b>");
  });

  test("html vnode can be used as text", () => {
    mount(text(html("<p>a</p>") as any), fixture);
    expect(fixture.textContent).toBe("<p>a</p>");
  });

  test("html vnode can represent <tr>", () => {
    const fixture = document.createElement("table");
    // const block = createBlock('<table><block-child-0/></table>');
    // const tree = block([], [html(`<tr><td>tomato</td></tr>`)]);
    const tree = html(`<tr><td>tomato</td></tr>`);
    mount(tree, fixture);
    expect(fixture.innerHTML).toBe("<tr><td>tomato</td></tr>");

    patch(tree, html(`<tr><td>potato</td></tr>`));
    expect(fixture.innerHTML).toBe("<tr><td>potato</td></tr>");
  });
});
