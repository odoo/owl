import { getCancellableTask } from "../src/runtime/cancellablePromise";

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const steps: string[] = [];
beforeEach(() => {
  steps.length = 0;
});
function step(message: string) {
  steps.push(message);
}
function verifySteps(expectedSteps: string[]) {
  expect(steps).toEqual(expectedSteps);
  steps.length = 0;
}

const deffereds: Record<string, Deferred> = {};
const deferred = (key: string) => {
  deffereds[key] ||= withResolvers();
  return deffereds[key].promise;
};
const resolve = async (key: string) => {
  deffereds[key] ||= withResolvers();
  deffereds[key].resolve(key);
  await delay();
  return;
};

beforeEach(() => {
  for (const key in deffereds) {
    delete deffereds[key];
  }
});

type Deferred = { promise: Promise<any>; resolve: (value: any) => void };
function withResolvers<T = any>(): Deferred {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  // @ts-ignore
  return { promise, resolve };
}

describe("cancellablePromise", () => {
  test("should cancel a simple promise", async () => {
    // const { getPromise, resolve } = prepare();
    const context = getCancellableTask(async () => {
      step("a before");
      await deferred("a value");
      step("a after");
      const asyncFunction = async () => {
        step("b before");
        await deferred("b value");
        step("b after");
      };
      await asyncFunction();
      step("gen end");
    });
    verifySteps(["a before"]);
    await resolve("a value");
    verifySteps(["a after", "b before"]);
    context.cancel();
    await resolve("b value");
    expect(context.isCancel).toBe(true);
    verifySteps([]);
  });
  test("should cancel in a sub promise", async () => {
    const context = getCancellableTask(async () => {
      let result;
      step("a before");
      result = await deferred("a value");
      step(`a after:${result}`);
      const asyncFunction = async () => {
        let result;
        step("b.1 before");
        result = await deferred("b.1 value");
        step(`b.1 after:${result}`);
        const asyncFunction = async () => {
          let result;
          step("b.1.1 before");
          result = await deferred("b.1.1 value");
          step(`b.1.1 after:${result}`);
          result = await deferred("b.1.2 value");
          step(`b.1.2 after:${result}`);
          return result;
        };
        result = await asyncFunction();
        step(`sub-sub result:${result}`);
        result = await deferred("b.2 value");
        step(`b.2 after:${result}`);
        return result;
      };
      result = await asyncFunction();
      step(`sub result:${result}`);
      result = await deferred("b value");
      step(`b after:${result}`);
    });
    verifySteps(["a before"]);
    await resolve("a value");
    verifySteps(["a after:a value", "b.1 before"]);
    await resolve("b.1 value");
    verifySteps(["b.1 after:b.1 value", "b.1.1 before"]);
    await resolve("b.1.1 value");
    verifySteps(["b.1.1 after:b.1.1 value"]);
    context.cancel();

    expect(context.isCancel).toBe(true);
    await resolve("b.1.2 value");
    await resolve("b.2 value");
    await resolve("b value");
    verifySteps([]);
  });
});
