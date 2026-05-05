import { OwlError } from "./owl_error";
import { ComputationAtom, disposeComputation } from "./computations";
import { STATUS, StatusValue } from "./status";
import type { PluginManager } from "./plugin_manager";

// -----------------------------------------------------------------------------
// Scope
// -----------------------------------------------------------------------------
//
// A Scope is the shared lifetime machinery used by every entity that outlives a
// single synchronous call: components and plugin managers. It unifies:
//   - "who is currently constructing?" (via the global scopeStack)
//   - "is this still alive?" (status + AbortSignal)
//   - "run this when I'm destroyed" (onDestroy callbacks)
//   - "dispose these computations on destroy" (computations list)
//
// Scope is `abstract`: the only concrete scopes in the runtime are
// `ComponentNode` and `PluginManager`, each of which extends Scope directly
// (rather than composing a separate scope object).
//
// `app` is typed as `any` because the concrete App type lives in owl-runtime;
// subclasses in owl-runtime narrow the field to their App type.
//
// The AbortController/signal and destroy-callback list are created lazily so
// that scopes which never use them pay nothing beyond a null pointer.
// -----------------------------------------------------------------------------

export const scopeStack: Scope[] = [];

/**
 * Returns the active scope. Throws if no scope is active — use this inside
 * hooks and setup functions where the caller is expected to be in a scope.
 */
export function useScope(): Scope {
  const scope = getScope();
  if (!scope) {
    throw new OwlError("No active scope");
  }
  return scope;
}

export abstract class Scope {
  app: any;
  pluginManager: PluginManager;
  status: StatusValue = STATUS.NEW;
  computations: ComputationAtom[] = [];
  willStart: Array<() => any> = [];
  private _controller: AbortController | null = null;
  private _destroyCbs: Array<() => void> | null = null;

  constructor(app: any) {
    this.app = app;
    this.pluginManager = app.pluginManager;
  }

  /**
   * Pushes this scope on the stack for the duration of `callback`. Any code
   * executed inside `callback` can reach this scope via `useScope()`.
   */
  run<T>(callback: () => T): T {
    scopeStack.push(this);
    try {
      return callback();
    } finally {
      scopeStack.pop();
    }
  }

  /**
   * An AbortSignal tied to this scope's lifetime. If the scope is already
   * dead, returns a pre-aborted signal. Lazily allocates an AbortController
   * on first access.
   */
  get abortSignal(): AbortSignal {
    if (this.status > STATUS.MOUNTED) {
      if (!this._controller) {
        this._controller = new AbortController();
        this._controller.abort();
      }
      return this._controller.signal;
    }
    return (this._controller ??= new AbortController()).signal;
  }

  /**
   * Awaits `p`, throwing an AbortError if the scope is dead before or after
   * the await. Unlike `until(signal, p)`, this does not allocate an
   * AbortController — status checks are sufficient for guarding between
   * awaits.
   */
  async until<T>(p: Promise<T>): Promise<T> {
    if (this.status > STATUS.MOUNTED) {
      throw makeAbortError();
    }
    const result = await p;
    if (this.status > STATUS.MOUNTED) {
      throw makeAbortError();
    }
    return result;
  }

  /**
   * Registers a callback to run when the scope is destroyed. If the scope is
   * already destroyed, the callback is invoked immediately.
   */
  onDestroy(cb: () => void): void {
    if (this.status >= STATUS.DESTROYED) {
      cb();
      return;
    }
    (this._destroyCbs ??= []).push(cb);
  }

  /**
   * Marks the scope as cancelled and aborts its signal. Used when an entity is
   * abandoned before it reaches the MOUNTED state. Subclasses may override to
   * extend the behavior (e.g. ComponentNode recurses to children).
   */
  cancel(): void {
    if (this.status > STATUS.MOUNTED) {
      return;
    }
    this.status = STATUS.CANCELLED;
    this._controller?.abort();
  }

  /**
   * Aborts the scope's signal, runs all registered onDestroy callbacks in
   * reverse registration order, disposes any computations attached to this
   * scope, and transitions status to DESTROYED. Callbacks run *before* the
   * status transition so they can still observe the pre-destroyed state
   * (matching the prior onWillDestroy contract). Errors in callbacks are
   * routed to `reportError`.
   */
  finalize(reportError: (e: unknown) => void): void {
    if (this.status >= STATUS.DESTROYED) {
      return;
    }
    if (this._controller && !this._controller.signal.aborted) {
      this._controller.abort();
    }
    const cbs = this._destroyCbs;
    if (cbs) {
      this._destroyCbs = null;
      for (let i = cbs.length - 1; i >= 0; i--) {
        try {
          cbs[i]();
        } catch (e) {
          reportError(e);
        }
      }
    }
    for (const computation of this.computations) {
      disposeComputation(computation);
    }
    this.status = STATUS.DESTROYED;
  }

  /**
   * Wrapper applied to lifecycle callbacks before they are stored. The base
   * implementation prepends the scope as the first argument, so every
   * lifecycle callback receives the scope it was registered in.
   * ComponentNode overrides to additionally bind `this` to the component and,
   * in dev mode, to rename the bound function so the hook shows up as
   * `ComponentName.hookName` in stack traces.
   */
  decorate(fn: Function, _hookName: string): Function {
    return fn.bind(undefined, this);
  }
}

/**
 * Returns the scope currently active on the stack, or null if none. Prefer
 * `useScope()` in hook-like code that expects to be called inside a scope;
 * reach for `getScope()` only when the absence of a scope is meaningful.
 */
export function getScope(): Scope | null {
  const len = scopeStack.length;
  return len ? scopeStack[len - 1] : null;
}

export function isAbortError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "AbortError";
}

function makeAbortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}
