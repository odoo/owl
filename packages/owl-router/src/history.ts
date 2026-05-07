// -----------------------------------------------------------------------------
// HistoryAdapter
// -----------------------------------------------------------------------------
//
// Abstracts away the browser's `window.history` + `popstate`/`pageshow` so the
// Router can be exercised in non-browser environments (tests, SSR). The
// adapter is the *only* place that talks to the global `window`/`document`.
//
// Two adapters ship in the package:
//   - BrowserHistoryAdapter — wraps the real browser API.
//   - MemoryHistoryAdapter  — keeps a stack in memory; used in tests.
// -----------------------------------------------------------------------------

export interface HistoryAdapter {
  /** Current URL. */
  url(): URL;
  /** Push a new entry. `title` is best-effort (browsers mostly ignore it). */
  push(url: URL, state: unknown, title?: string): void;
  /** Replace the current entry. */
  replace(url: URL, state: unknown, title?: string): void;
  /** Read the state object of the current entry. */
  currentState(): unknown;
  /** Navigate the history stack. */
  back(): void;
  forward(): void;
  go(n: number): void;
  /**
   * Subscribe to popstate-equivalent events. The handler receives the state
   * stored on the entry the browser navigated to, or `null` for entries that
   * have no associated state (e.g. anchor clicks).
   */
  onPopState(handler: (state: unknown) => void): () => void;
  /**
   * Subscribe to pageshow-equivalent events. `persisted` is true when the
   * page was restored from the bfcache.
   */
  onPageShow(handler: (persisted: boolean) => void): () => void;
}

// -----------------------------------------------------------------------------
// BrowserHistoryAdapter
// -----------------------------------------------------------------------------

export class BrowserHistoryAdapter implements HistoryAdapter {
  url(): URL {
    return new URL(window.location.href);
  }

  push(url: URL, state: unknown, title?: string): void {
    if (title !== undefined) {
      // Browsers (mostly) ignore the title argument of pushState, but they
      // *do* take the document title at push time as the history entry's
      // label. Set the document title transiently so the entry gets the
      // right name, then restore it.
      const previous = document.title;
      document.title = title;
      window.history.pushState(state, "", url.href);
      document.title = previous;
      return;
    }
    window.history.pushState(state, "", url.href);
  }

  replace(url: URL, state: unknown, title?: string): void {
    if (title !== undefined) {
      const previous = document.title;
      document.title = title;
      window.history.replaceState(state, "", url.href);
      document.title = previous;
      return;
    }
    window.history.replaceState(state, "", url.href);
  }

  currentState(): unknown {
    return window.history.state;
  }

  back(): void {
    window.history.back();
  }

  forward(): void {
    window.history.forward();
  }

  go(n: number): void {
    window.history.go(n);
  }

  onPopState(handler: (state: unknown) => void): () => void {
    const listener = (ev: PopStateEvent) => handler(ev.state);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }

  onPageShow(handler: (persisted: boolean) => void): () => void {
    const listener = (ev: PageTransitionEvent) => handler(ev.persisted);
    window.addEventListener("pageshow", listener);
    return () => window.removeEventListener("pageshow", listener);
  }
}

// -----------------------------------------------------------------------------
// MemoryHistoryAdapter
// -----------------------------------------------------------------------------
//
// In-memory history stack with the same surface area as the browser adapter.
// `back()`/`forward()`/`go()` notify popstate listeners synchronously.
// -----------------------------------------------------------------------------

interface MemoryEntry {
  url: URL;
  state: unknown;
  title: string;
}

export interface MemoryHistoryOptions {
  initialUrl?: string | URL;
  initialState?: unknown;
}

export class MemoryHistoryAdapter implements HistoryAdapter {
  private entries: MemoryEntry[];
  private cursor: number;
  private popHandlers: Array<(state: unknown) => void> = [];
  private showHandlers: Array<(persisted: boolean) => void> = [];

  constructor(options: MemoryHistoryOptions = {}) {
    const initial = options.initialUrl ?? "http://localhost/";
    this.entries = [
      {
        url: new URL(initial.toString()),
        state: options.initialState ?? null,
        title: "",
      },
    ];
    this.cursor = 0;
  }

  url(): URL {
    return new URL(this.entries[this.cursor].url.href);
  }

  push(url: URL, state: unknown, title = ""): void {
    this.entries.splice(this.cursor + 1);
    this.entries.push({ url: new URL(url.href), state, title });
    this.cursor = this.entries.length - 1;
  }

  replace(url: URL, state: unknown, title = ""): void {
    this.entries[this.cursor] = { url: new URL(url.href), state, title };
  }

  currentState(): unknown {
    return this.entries[this.cursor].state;
  }

  back(): void {
    this.go(-1);
  }

  forward(): void {
    this.go(1);
  }

  go(n: number): void {
    const target = this.cursor + n;
    if (target < 0 || target >= this.entries.length || n === 0) {
      return;
    }
    this.cursor = target;
    const state = this.entries[this.cursor].state;
    for (const handler of this.popHandlers.slice()) {
      handler(state);
    }
  }

  onPopState(handler: (state: unknown) => void): () => void {
    this.popHandlers.push(handler);
    return () => {
      const i = this.popHandlers.indexOf(handler);
      if (i !== -1) this.popHandlers.splice(i, 1);
    };
  }

  onPageShow(handler: (persisted: boolean) => void): () => void {
    this.showHandlers.push(handler);
    return () => {
      const i = this.showHandlers.indexOf(handler);
      if (i !== -1) this.showHandlers.splice(i, 1);
    };
  }

  /** Test helper: simulate a bfcache-style pageshow. */
  emitPageShow(persisted: boolean): void {
    for (const handler of this.showHandlers.slice()) {
      handler(persisted);
    }
  }
}
