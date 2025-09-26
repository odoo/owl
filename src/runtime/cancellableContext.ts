export type TaskContext = { isCancelled: boolean; cancel: () => void; meta: Record<string, any> };

export const taskContextStack: TaskContext[] = [];

export function getTaskContext() {
  return taskContextStack[taskContextStack.length - 1];
}

export function makeTaskContext(): TaskContext {
  let isCancelled = false;
  return {
    get isCancelled() {
      return isCancelled;
    },
    cancel() {
      isCancelled = true;
    },
    meta: {},
  };
}

export function useTaskContext(ctx?: TaskContext) {
  ctx ??= makeTaskContext();
  taskContextStack.push(ctx);
  return {
    ctx,
    cleanup: () => {
      taskContextStack.pop();
    },
  };
}

export function pushTaskContext(context: TaskContext) {
  taskContextStack.push(context);
}

export function popTaskContext() {
  taskContextStack.pop();
}

export function taskEffect(fn: Function) {
  const { ctx, cleanup } = useTaskContext();
  fn();
  cleanup();
  return ctx;
}
