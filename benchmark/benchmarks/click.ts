import { addBenchmark, fixture, waitForMutation } from "../utils";

addBenchmark({
  label: `Click`,
  async setup({ owl, Root, parseProps }, data) {
    const props = parseProps?.(data) ?? data;
    return owl.mount(Root, fixture, { dev: false, props });
  },
  async run() {
    const promise = waitForMutation();
    for (const button of fixture.getElementsByTagName("button")) {
      button.click();
    }
    await promise;
  },
});
