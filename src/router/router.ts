import { Env } from "../component/component";
import { QWeb } from "../qweb/index";
import { shallowEqual } from "../utils";

type NavigationGuard = (info: {
  env: Env;
  to: Route | null;
  from: Route | null;
}) => boolean | Destination;

export interface Route {
  name: string;
  path: string;
  component?: any;
  redirect?: Destination;
  params: string[];
  beforeRouteEnter?: NavigationGuard;
}

export type RouteParams = { [key: string]: string | number };

export interface RouterEnv extends Env {
  router: Router;
}

export interface Destination {
  path?: string;
  to?: string;
  params?: RouteParams;
}

interface PositiveMatchResult {
  type: "match";
  route: Route;
  params: RouteParams;
}

interface NegativeMatchResult {
  type: "nomatch";
}

interface CancelledMatch {
  type: "cancelled";
}

type MatchResult = PositiveMatchResult | NegativeMatchResult | CancelledMatch;

interface Options {
  mode: Router["mode"];
}

const paramRegexp = /\{\{(.*?)\}\}/;

export class Router {
  currentRoute: Route | null = null;
  currentParams: RouteParams | null = null;
  mode: "history" | "hash";

  routes: { [id: string]: Route };
  routeIds: string[];
  env: RouterEnv;

  constructor(env: Env, routes: Partial<Route>[], options: Options = { mode: "history" }) {
    env.router = this;
    this.mode = options.mode;
    this.env = env as RouterEnv;

    this.routes = {};
    this.routeIds = [];
    let nextId = 1;
    for (let partialRoute of routes) {
      if (!partialRoute.name) {
        partialRoute.name = "__route__" + nextId++;
      }
      if (partialRoute.component) {
        QWeb.registerComponent("__component__" + partialRoute.name, partialRoute.component);
      }
      if (partialRoute.redirect) {
        this.validateDestination(partialRoute.redirect);
      }
      partialRoute.params = partialRoute.path ? findParams(partialRoute.path) : [];
      this.routes[partialRoute.name] = partialRoute as Route;
      this.routeIds.push(partialRoute.name);
    }
  }

  //--------------------------------------------------------------------------
  // Public API
  //--------------------------------------------------------------------------

  async start() {
    (this as any)._listener = ev => this._navigate(this.currentPath(), ev);
    window.addEventListener("popstate", (this as any)._listener);
    if (this.mode === "hash") {
      window.addEventListener("hashchange", (this as any)._listener);
    }
    const result = await this.matchAndApplyRules(this.currentPath());
    if (result.type === "match") {
      this.currentRoute = result.route;
      this.currentParams = result.params;
      const currentPath = this.routeToPath(result.route, result.params);
      if (currentPath !== this.currentPath()) {
        this.setUrlFromPath(currentPath);
      }
    }
  }

  async navigate(to: Destination): Promise<boolean> {
    const path = this.destToPath(to);
    return this._navigate(path);
  }
  async _navigate(path: string, ev?: any): Promise<boolean> {
    const initialName = this.currentRouteName;
    const initialParams = this.currentParams;
    const result = await this.matchAndApplyRules(path);
    if (result.type === "match") {
      const finalPath = this.routeToPath(result.route, result.params);
      const isPopStateEvent = ev && ev instanceof PopStateEvent;
      if (!isPopStateEvent) {
        this.setUrlFromPath(finalPath);
      }
      this.currentRoute = result.route;
      this.currentParams = result.params;
    } else if (result.type === "nomatch") {
      this.currentRoute = null;
      this.currentParams = null;
    }
    const didChange =
      this.currentRouteName !== initialName || !shallowEqual(this.currentParams, initialParams);
    if (didChange) {
      this.env.qweb.forceUpdate();
      return true;
    }
    return false;
  }

  destToPath(dest: Destination): string {
    this.validateDestination(dest);
    return dest.path || this.routeToPath(this.routes[dest.to!], dest.params!);
  }

  get currentRouteName(): string | null {
    return this.currentRoute && this.currentRoute.name;
  }

  //--------------------------------------------------------------------------
  // Private helpers
  //--------------------------------------------------------------------------

  private setUrlFromPath(path: string) {
    const separator = this.mode === "hash" ? location.pathname : "";
    const url = location.origin + separator + path;
    if (url !== window.location.href) {
      window.history.pushState({}, path, url);
    }
  }

  private validateDestination(dest: Destination) {
    if ((!dest.path && !dest.to) || (dest.path && dest.to)) {
      throw new Error(`Invalid destination: ${JSON.stringify(dest)}`);
    }
  }

  private routeToPath(route: Route, params: RouteParams): string {
    const path = route.path;
    const parts = path.split("/");
    const l = parts.length;
    for (let i = 0; i < l; i++) {
      const part = parts[i];
      const match = part.match(paramRegexp);
      if (match) {
        const key = match[1].split(".")[0];
        parts[i] = <string>params[key];
      }
    }
    const prefix = this.mode === "hash" ? "#" : "";
    return prefix + parts.join("/");
  }

  private currentPath(): string {
    let result = this.mode === "history" ? window.location.pathname : window.location.hash.slice(1);
    return result || "/";
  }

  private match(path: string): MatchResult {
    for (let routeId of this.routeIds) {
      let route = this.routes[routeId];
      let params = this.getRouteParams(route, path);
      if (params) {
        return {
          type: "match",
          route: route,
          params: params
        };
      }
    }
    return { type: "nomatch" };
  }

  private async matchAndApplyRules(path: string): Promise<MatchResult> {
    const result = this.match(path);
    if (result.type === "match") {
      return this.applyRules(result);
    }
    return result;
  }

  private async applyRules(matchResult: PositiveMatchResult): Promise<MatchResult> {
    const route = matchResult.route;
    if (route.redirect) {
      const path = this.destToPath(route.redirect);
      return this.matchAndApplyRules(path);
    }
    if (route.beforeRouteEnter) {
      const result = await route.beforeRouteEnter({
        env: this.env,
        from: this.currentRoute,
        to: route
      });
      if (result === false) {
        return { type: "cancelled" };
      } else if (result !== true) {
        // we want to navigate to another destination
        const path = this.destToPath(result);
        return this.matchAndApplyRules(path);
      }
    }

    return matchResult;
  }

  private getRouteParams(route: Route, path: string): RouteParams | false {
    if (route.path === "*") {
      return {};
    }
    if (path.startsWith("#")) {
      path = path.slice(1);
    }
    const descrParts = route.path.split("/");
    const targetParts = path.split("/");
    const l = descrParts.length;
    if (l !== targetParts.length) {
      return false;
    }
    const result = {};
    for (let i = 0; i < l; i++) {
      const descr = descrParts[i];
      let target: string | number = targetParts[i];
      const match = descr.match(paramRegexp);
      if (match) {
        const [key, suffix] = match[1].split(".");
        if (suffix === "number") {
          target = parseInt(target, 10);
        }
        result[key] = target;
      } else if (descr !== target) {
        return false;
      }
    }
    return result;
  }
}

function findParams(str: string): string[] {
  const globalParamRegexp = /\{\{(.*?)\}\}/g;
  const result: string[] = [];
  let m;
  do {
    m = globalParamRegexp.exec(str);
    if (m) {
      result.push(m[1].split(".")[0]);
    }
  } while (m);
  return result;
}
