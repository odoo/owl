import { Blocks } from "../../src/bdom";
import { makeTestFixture } from "../helpers";

const { BHtml } = Blocks;
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

describe("BHtml", () => {
  test("can be mounted and patched", async () => {
    const tree = new BHtml("<span>1</span><span>2</span>");
    tree.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span>");

    const tree2 = new BHtml("<div>coucou</div>");
    tree.patch(tree2);
    expect(fixture.innerHTML).toBe("<div>coucou</div>");
  });
});
