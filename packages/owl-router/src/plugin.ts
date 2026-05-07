// -----------------------------------------------------------------------------
// RouterPlugin
// -----------------------------------------------------------------------------
//
// Owl plugin wrapping a Router instance. Reads its configuration from the
// plugin manager's config (set via `providePlugins(plugins, config)`):
//
//   - codec   (required)  — RouterCodec describing how state ↔ URL maps
//   - history (optional)  — HistoryAdapter; defaults to BrowserHistoryAdapter
//   - reload  (optional)  — reload callback; defaults to window.location.reload
//
// Components retrieve the router via `useRouter()` (see ./hooks).
// -----------------------------------------------------------------------------

import { config, onWillDestroy, Plugin } from "@odoo/owl-runtime";
import { Router } from "./router";
import type { RouterCodec } from "./codec";
import type { HistoryAdapter } from "./history";

// Plugin instances share one shape; the generic state parameter is purely a
// type-level view applied at the `useRouter()` boundary. Keeping the class
// itself non-generic avoids friction with PluginConstructor's `new
// (...args: any[]): Plugin` constraint.
export class RouterPlugin extends Plugin {
  static id = "router";

  router!: Router;

  setup() {
    this.router = new Router({
      codec: config<RouterCodec<any>>("codec"),
      history: config<HistoryAdapter | undefined>("history?"),
      reload: config<(() => void) | undefined>("reload?"),
    });
    onWillDestroy(() => this.router.dispose());
  }
}
