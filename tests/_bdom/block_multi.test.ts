import { elem, mount, multi, patch, remove, text } from "../../src/_bdom/blockdom";
import { makeBuilder as origMakeBuilder } from "../../src/_bdom/builder";
import { makeTestFixture } from "../helpers";

function makeBuilder(str: string) {
  const B = origMakeBuilder(str);
  expect(B.toString()).toMatchSnapshot();
  return B;
}

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

describe("multi blocks", () => {
  test("multiblock with 2 text blocks", async () => {
    const bdom = multi([text("foo"), text("bar")]);
    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("foobar");
  });

  test("a multiblock can be removed and leaves no extra text nodes", async () => {
    const builder1 = makeBuilder("<div>foo</div>");
    const builder2 = makeBuilder("<span>bar</span>");

    const bdom = multi([elem(builder1), elem(builder2)]);

    expect(fixture.childNodes.length).toBe(0);
    mount(bdom, fixture);
    expect(fixture.childNodes.length).toBe(4);
    remove(bdom);
    expect(fixture.childNodes.length).toBe(0);
  });

  test("multiblock with an empty children", async () => {
    const builder = makeBuilder("<div>foo</div>");
    const bdom = multi([elem(builder), undefined]);

    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");
  });

  test("multi block in a regular block", async () => {
    const builder1 = makeBuilder("<div><owl-child-0/></div>");
    const builder2 = makeBuilder("<span>yip yip</span>");

    const bdom = elem(builder1, [], [multi([elem(builder2)])]);

    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("<div><span>yip yip</span></div>");
  });

  test("patching a multiblock ", async () => {
    const bdom = multi([text("foo"), text("bar")]);
    mount(bdom, fixture);
    expect(fixture.innerHTML).toBe("foobar");

    patch(bdom, multi([text("blip"), text("bar")]));
    expect(fixture.innerHTML).toBe("blipbar");
  });
});
