import { ExecutionContext } from "../common/types";

export const executionContexts: ExecutionContext[] = [];
(window as any).executionContexts = executionContexts;
// export const scheduledContexts: Set<ExecutionContext> = new Set();

export function getExecutionContext() {
  return executionContexts[executionContexts.length - 1];
}

export function pushExecutionContext(context: ExecutionContext) {
  executionContexts.push(context);
}

export function popExecutionContext() {
  executionContexts.pop();
}

// export function makeExecutionContext({ update, meta }: { update: () => void; meta?: any }) {
//   const executionContext: ExecutionContext = {
//     update,
//     atoms: new Set(),
//     meta: meta || {},
//   };
//   return executionContext;
// }
