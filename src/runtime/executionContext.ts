import { ExecutionContext } from "../common/types";

export const executionContext: ExecutionContext[] = [];
// export const scheduledContexts: Set<ExecutionContext> = new Set();

export function getExecutionContext() {
  return executionContext[executionContext.length - 1];
}

export function makeExecutionContext({
  update,
  getParent,
  getChildren,
  meta,
}: {
  update: () => void;
  getParent?: () => ExecutionContext | undefined;
  getChildren?: () => ExecutionContext[];
  meta?: any;
}) {
  const executionContext: ExecutionContext = {
    update,
    getParent: getParent!,
    getChildren: getChildren!,
    signals: new Set(),
    meta: meta || {},
  };
  return executionContext;
}

export function pushExecutionContext(context: ExecutionContext) {
  executionContext.push(context);
}

export function popExecutionContext() {
  executionContext.pop();
}
