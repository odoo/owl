import {
  Component,
  mount,
  signal,
  useEffect,
  xml
} from "../../src";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

test("components and useEffect", async () => {
  const s = signal("a")

  class Test extends Component {
    static template = xml`<t t-out="this.current()"/>`;
    current = signal("");

    setup() {
      useEffect(() => {
        this.current.set(s());
      });
    }
  }
  await mount(Test, fixture);
  expect(fixture.innerHTML).toBe("a");
  s.set("b");
  await nextTick();
  expect(fixture.innerHTML).toBe("b");
});

