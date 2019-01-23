export type Query = { [key: string]: string };

export interface Route {
  // this is the part before the hash: www.something.com/web#action=1 => web
  path: string;
  query: Query;
  title: string;
}

function clearSlaches(s: string): string {
  return s.replace(/\/$/, "").replace(/^\//, "");
}

export default class Router {
  listeners: { owner: any; callback: (info: Route) => void }[] = [];

  constructor() {
    window.addEventListener("popstate", this.onUrlChange.bind(this));
    window.onhashchange = function() {
      console.log("aaaa");
      debugger;
    };
  }

  onUrlChange(event: PopStateEvent) {
    debugger;
    event.preventDefault();
    const info = this.getRoute();
    for (let listener of this.listeners) {
      listener.callback.call(listener.owner, info);
    }
  }

  /**
   * @param {Route} route relative route: for example, /web/
   * @param {Query} query
   */
  navigate(info: Partial<Route>) {
    const currentRoute = this.getRoute();
    const route = info.path || currentRoute.path;
    const query = info.query || {};
    const title = info.title || currentRoute.title;
    const url = this.formatURL(route, query);
    window.history.pushState(null, title, url);
  }
  register(owner: any, callback: (info: Route) => void) {
    this.listeners.push({ owner, callback });
  }

  unregister(owner: any) {
    this.listeners = this.listeners.filter(l => l.owner !== owner);
  }

  formatURL(path: string, query: Query): string {
    let url = clearSlaches(path);
    let hasHash = false;
    for (let key in query) {
      url = url + (hasHash ? "&" : "#");
      url = url + `${key}=${query[key]}`;
      hasHash = true;
    }
    return "/" + url;
  }

  getRoute(): Route {
    const path = clearSlaches(window.location.pathname);
    const query = {};
    for (let part of window.location.hash.slice(1).split("?")) {
      let [key, value] = part.split("=");
      query[key] = value;
    }
    return { path, query, title: document.title };
  }
}
