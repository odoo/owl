import { addBenchmark, fixture } from "../utils";

addBenchmark({
  label: `Render`,
  async setup({ parseProps }, data) {
    return parseProps?.(data) ?? data;
  },
  async run({ owl, Root }, props) {
    return owl.mount(Root, fixture, { props });
  },
});
