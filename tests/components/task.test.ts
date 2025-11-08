import { taskEffect } from "../../src/runtime/cancellableContext";
import { Task } from "../../src/runtime/task";

export type Deffered = Promise<any> & {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
};

interface TaskWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

let resolvers: Record<string, TaskWithResolvers<string>> = {};
function getTask(id: string) {
  const resolver: {
    task?: Task<string>;
    resolve?: (value: string | PromiseLike<string>) => void;
    reject?: (reason?: any) => void;
  } = {};

  const promise = new Task<string>((res, rej) => {
    resolver.resolve = res;
    resolver.reject = rej;
  });
  resolver.task = promise;

  resolvers[id] = resolver as TaskWithResolvers<string>;
  return promise;
}
function tick() {
  return new Promise((r) => setTimeout(r, 0));
}

// const timeoutTask = (ms: number) => new Task((resolve) => setTimeout(() => resolve(ms), ms));

const steps: string[] = [];
function step(msg: string) {
  steps.push(msg);
}
function verifySteps(expected: string[]) {
  expect(steps).toEqual(expected);
  steps.length = 0;
}

afterEach(() => {
  resolvers = {};
});

describe("task", () => {
  test("should run a task properly", async () => {
    taskEffect(async () => {
      let result;
      step(`a:begin`);
      result = await getTask("a");
      step(`a:${result}`);
      result = await getTask("b");
      step(`b:${result}`);
    });

    verifySteps(["a:begin"]);
    resolvers["a"].resolve("a");
    await tick();
    verifySteps(["a:a"]);
    resolvers["b"].resolve("b");
    await tick();
    verifySteps(["b:b"]);
  });

  test("should cancel a task properly", async () => {
    const ctx = taskEffect(async () => {
      let result;
      step(`a:begin`);
      result = await getTask("a");
      step(`a:${result}`);
      result = await getTask("b");
      step(`b:${result}`);
    });

    verifySteps(["a:begin"]);
    resolvers["a"].resolve("a");
    await tick();
    verifySteps(["a:a"]);
    ctx.cancel();
    resolvers["b"].resolve("b");
    await tick();
    verifySteps([]);
  });

  test("should run a task with subtasks properly", async () => {
    taskEffect(async () => {
      let result;
      step(`a:begin`);
      result = await getTask("a");
      step(`a:${result}`);
      result = await getTask("b");
      step(`b:${result}`);
    });

    verifySteps(["a:begin"]);
    resolvers["a"].resolve("a");
    await tick();
    verifySteps(["a:a"]);
    resolvers["b"].resolve("b");
    await tick();
    verifySteps(["b:b"]);
  });
});
