import { PluginManager, signal, useOnChange } from "../src";
import { waitScheduler } from "./helpers";

describe("useOnChange", () => {
  test("callback writing one of its dependencies then throwing keeps running", async () => {
    class IntentionalTestError extends Error {
      override name = "IntentionalTestError";
    }
    const manager = new PluginManager({});
    const value = signal(0);
    const steps: number[] = [];
    manager.run(() =>
      useOnChange(
        () => [value()],
        (v) => {
          steps.push(v);
          if (v === 1) {
            value.set(10);
            throw new IntentionalTestError("one");
          }
        }
      )
    );
    value.set(1);
    await waitScheduler();
    value.set(2);
    await waitScheduler();
    expect(steps).toEqual([0, 1, 2]);
  });

  test("callback making its dependencies throw keeps its cleanup", async () => {
    const manager = new PluginManager({});
    const item = signal<{ id: number } | null>({ id: 0 });
    const steps: string[] = [];
    manager.run(() =>
      useOnChange(
        () => [item()!.id],
        (id) => {
          steps.push(`run ${id}`);
          if (id === 1) {
            item.set(null);
          }
          return () => steps.push(`cleanup ${id}`);
        }
      )
    );
    item.set({ id: 1 });
    await waitScheduler();
    manager.destroy();
    expect(steps).toEqual(["run 0", "cleanup 0", "run 1", "cleanup 1"]);
  });

  test("callback making its dependencies throw runs again once they recover", async () => {
    const manager = new PluginManager({});
    const item = signal<{ id: number } | null>({ id: 0 });
    const steps: number[] = [];
    manager.run(() =>
      useOnChange(
        () => [item()!.id],
        (id) => {
          steps.push(id);
          if (id === 1) {
            item.set(null);
          }
        }
      )
    );
    item.set({ id: 1 });
    await waitScheduler();
    item.set({ id: 2 });
    await waitScheduler();
    expect(steps).toEqual([0, 1, 2]);
  });
});
