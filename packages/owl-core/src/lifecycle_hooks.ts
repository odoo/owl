import { Scope, useScope } from "./scope";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: (scope: Scope) => Promise<void> | void | any) {
  const scope = useScope();
  scope.willStart.push(scope.decorate(fn, "onWillStart") as () => any);
}

export function onWillDestroy(fn: (scope: Scope) => void | any) {
  const scope = useScope();
  scope.onDestroy(scope.decorate(fn, "onWillDestroy") as () => void);
}
