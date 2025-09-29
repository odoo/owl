import { ExecutionContext } from "../common/types";

export const executionContexts: ExecutionContext[] = [];
(window as any).executionContexts = executionContexts;
// export const scheduledContexts: Set<ExecutionContext> = new Set();

export function getExecutionContext() {
  return executionContexts[executionContexts.length - 1];
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
  executionContexts.push(context);
}

export function popExecutionContext() {
  executionContexts.pop();
}
