import { mount } from "../../../src";
import { makeTestFixture } from "../../../tests/helpers";
import { DevtoolsWindow } from "../src/devtools_app/devtools_window/devtools_window";

let fixture = makeTestFixture();
beforeEach(() => {
  fixture = makeTestFixture();
});

describe("devtools", () => {
  test("mounting the devtools", async () => {
    await mount(DevtoolsWindow as any, fixture);
    expect(fixture.querySelector(".status-message")!.textContent).toContain("There are no apps currently running.")
  });
});
