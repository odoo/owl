// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------
//
// Owns the canonical reactive state of the router. Holds two signals:
//   - state(): the current state, decoded by the codec from the URL.
//   - url():   the current URL, encoded from the state by the codec.
//
// Components subscribe by calling these signals inside an effect/computed.
// Imperative writes (`push`, `replace`, `back`, ...) coalesce within a
// microtask so that several `pushState` calls in the same tick produce one
// history entry — matching the existing odoo router's debounced semantics.
// Pass `{ sync: true }` to flush immediately.
//
// The Router is unopinionated about state shape: a `RouterCodec<TState>`
// supplied by the consumer handles encode/decode. Locked-key bookkeeping
// (preserving keys like `debug`/`lang` across `replace`) is implemented here
// because it requires reading from the *previous* state — but the keys
// themselves are advertised by the codec.
// -----------------------------------------------------------------------------

import { signal, Signal } from "@odoo/owl-core";
import { getLockedKeys, type RouterCodec } from "./codec";
import { BrowserHistoryAdapter, type HistoryAdapter } from "./history";

export interface NavOptions {
  /** Bypass coalescing — push to history synchronously. */
  sync?: boolean;
  /** After pushing, reload the page (mirrors the existing `?debug=1` flow). */
  reload?: boolean;
  /**
   * Update the in-memory state and history but do not notify reactive
   * subscribers. Used by trap-state hacks like a back-button manager that
   * pushes a synthetic entry without wanting the rest of the app to react.
   */
  skipNotify?: boolean;
  /** Title to set on the resulting history entry. */
  title?: string;
}

export interface RouterOptions<TState> {
  codec: RouterCodec<TState>;
  history?: HistoryAdapter;
  /**
   * Optional reload callback. Defaults to `window.location.reload()`. Tests
   * (and SSR) inject a stub.
   */
  reload?: () => void;
}

interface PendingNav<TState> {
  mode: "push" | "replace";
  state: Partial<TState>;
  reload: boolean;
  title: string | undefined;
  skipNotify: boolean;
}

export class Router<TState extends Record<string, any> = Record<string, any>> {
  readonly codec: RouterCodec<TState>;
  readonly history: HistoryAdapter;
  private readonly lockedKeyList: ReadonlyArray<string>;
  private readonly _reload: () => void;

  private readonly stateSignal: Signal<TState>;
  private readonly urlSignal: Signal<URL>;

  // Pending nav buffer used by the microtask coalescer. When a push() arrives,
  // we queue the change here and schedule a microtask flush. Consecutive
  // calls before the flush merge into the same buffer.
  private pending: PendingNav<TState> | null = null;
  private pendingFlush: Promise<void> | null = null;

  // Disposers registered by subscribing to history events at construction.
  private disposers: Array<() => void> = [];
  private destroyed = false;

  constructor(options: RouterOptions<TState>) {
    this.codec = options.codec;
    this.history = options.history ?? new BrowserHistoryAdapter();
    this.lockedKeyList = getLockedKeys(this.codec);
    this._reload = options.reload ?? (() => window.location.reload());

    const initialUrl = this.history.url();
    const initialState = this.codec.decode(initialUrl);
    this.stateSignal = signal<TState>(initialState);
    this.urlSignal = signal<URL>(initialUrl);

    this.disposers.push(this.history.onPopState((entryState) => this.onPopState(entryState)));
    this.disposers.push(
      this.history.onPageShow((persisted) => {
        if (persisted) {
          // bfcache restore — re-decode the URL into state so subscribers see
          // the entry the browser just restored. This matches the old
          // router's `pageshow.persisted` -> ROUTE_CHANGE behavior.
          this.refreshFromUrl();
        }
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Reactive reads
  // ---------------------------------------------------------------------------

  state(): TState {
    return this.stateSignal();
  }

  url(): URL {
    return this.urlSignal();
  }

  // ---------------------------------------------------------------------------
  // Imperative writes
  // ---------------------------------------------------------------------------

  push(state: Partial<TState>, options: NavOptions = {}): void {
    this.enqueue("push", state, options);
  }

  replace(state: Partial<TState>, options: NavOptions = {}): void {
    this.enqueue("replace", state, options);
  }

  /**
   * Soft-navigate to a URL: decode it with the codec and use the result as
   * the new state, replacing what was there. Useful for internal link
   * clicks where the URL is the canonical truth (not a merge with the
   * current state).
   *
   * Defaults to a synchronous push entry; pass `{ replace: true }` to use
   * replaceState instead.
   */
  navigate(url: string | URL, options: NavOptions & { replace?: boolean } = {}): void {
    if (this.destroyed) return;
    this.cancelPending();
    const target = url instanceof URL ? url : new URL(url, this.history.url().href);
    const next = this.codec.decode(target);
    const entryState = this.toEntryState(next);
    if (options.replace) {
      this.history.replace(target, entryState, options.title);
    } else {
      this.history.push(target, entryState, options.title);
    }
    if (!options.skipNotify) {
      this.urlSignal.set(target);
      this.stateSignal.set(next);
    }
    if (options.reload) {
      this._reload();
    }
  }

  back(): void {
    this.cancelPending();
    this.history.back();
  }

  forward(): void {
    this.cancelPending();
    this.history.forward();
  }

  go(n: number): void {
    this.cancelPending();
    this.history.go(n);
  }

  /** Drop any pending coalesced push without applying it. */
  cancelPending(): void {
    this.pending = null;
    this.pendingFlush = null;
  }

  /** Stop listening to history events and release internal resources. */
  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelPending();
    for (const fn of this.disposers) {
      fn();
    }
    this.disposers.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private enqueue(mode: "push" | "replace", state: Partial<TState>, options: NavOptions): void {
    if (this.destroyed) return;

    if (!this.pending) {
      this.pending = {
        mode,
        state: { ...state },
        reload: !!options.reload,
        title: options.title,
        skipNotify: !!options.skipNotify,
      };
    } else {
      // Replace is sticky: once any caller in a coalesced batch asks for
      // replace, the flush is a replace. Matches the existing odoo router's
      // `pushArgs.replace ||= options.replace` semantics.
      if (mode === "replace") {
        this.pending.mode = "replace";
      }
      Object.assign(this.pending.state, state);
      this.pending.reload ||= !!options.reload;
      if (options.title !== undefined) {
        this.pending.title = options.title;
      }
      // skipNotify is sticky as well.
      this.pending.skipNotify ||= !!options.skipNotify;
    }

    if (options.sync) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.pendingFlush) return;
    const flush = Promise.resolve().then(() => {
      // Bail if the flush was cancelled or another flush replaced us.
      if (this.pendingFlush !== flush) return;
      this.pendingFlush = null;
      this.flush();
    });
    this.pendingFlush = flush;
  }

  private flush(): void {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    this.pendingFlush = null;

    const previous = this.stateSignal();
    const next = this.computeNextState(previous, pending);
    const nextUrl = new URL(this.codec.encode(next), this.history.url().href);

    if (pending.mode === "push") {
      this.history.push(nextUrl, this.toEntryState(next), pending.title);
    } else {
      this.history.replace(nextUrl, this.toEntryState(next), pending.title);
    }

    if (!pending.skipNotify) {
      this.stateSignal.set(next);
      this.urlSignal.set(nextUrl);
    }

    if (pending.reload) {
      this._reload();
    }
  }

  /**
   * Build the next full state from the previous state and the partial update.
   * - `push` layers the partial on top of the previous state.
   * - `replace` keeps only the locked keys from the previous state, then
   *   layers the partial. This matches odoo's existing `replace` semantics.
   */
  private computeNextState(previous: TState, pending: PendingNav<TState>): TState {
    if (pending.mode === "replace") {
      const base = {} as TState;
      for (const key of this.lockedKeyList) {
        if (key in previous) {
          (base as any)[key] = (previous as any)[key];
        }
      }
      return Object.assign(base, pending.state) as TState;
    }
    return Object.assign({}, previous, pending.state) as TState;
  }

  /**
   * Decide what we put in `history.state` for an entry. We currently store
   * the decoded state object so popstate handlers can short-circuit the
   * decode step — matching the existing odoo router's `nextState` field.
   */
  private toEntryState(state: TState): unknown {
    return { nextState: state };
  }

  private onPopState(entryState: unknown): void {
    if (this.destroyed) return;
    this.cancelPending();
    const url = this.history.url();
    const fromEntry =
      entryState && typeof entryState === "object" && "nextState" in (entryState as any)
        ? ((entryState as any).nextState as TState)
        : null;
    const next = fromEntry ?? this.codec.decode(url);
    this.urlSignal.set(url);
    this.stateSignal.set(next);
  }

  private refreshFromUrl(): void {
    if (this.destroyed) return;
    const url = this.history.url();
    this.urlSignal.set(url);
    this.stateSignal.set(this.codec.decode(url));
  }
}
