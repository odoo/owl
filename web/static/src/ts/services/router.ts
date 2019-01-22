export type Route = string;
export type Query = { [key: string]: string };

export interface RouteInfo {
  route: Route;
  query: Query;
  title: string;
}

export default class Router {
  listeners: { owner: any; callback: (info: RouteInfo) => void }[] = [];

  constructor() {
    window.addEventListener("popstate", this.onUrlChange.bind(this));
  }

  onUrlChange() {
      const info = this.getRouteInfo();
      for (let listener of this.listeners) {
          listener.callback.call(listener.owner, info);
      }
  }

  /**
   * @param {Route} route relative route: for example, /web/
   * @param {Query} query
   */
  navigate(info: Partial<RouteInfo>) {
    const currentRouteInfo = this.getRouteInfo();
    const route = info.route || currentRouteInfo.route;
    const query = info.query || {};
    const title = info.title || currentRouteInfo.title;
    const url = this.formatURL(route, query);
    window.history.pushState(null, title, url);
  }
  register(owner: any, callback: (info: RouteInfo) => void) {
    this.listeners.push({ owner, callback });
  }

  unregister(owner: any) {
    this.listeners = this.listeners.filter(l => l.owner !== owner);
  }

  formatURL(route: Route, query: Query): string {
    let url = route;
    let hasHash = false;
    for (let key in query) {
      url = url + (hasHash ? "&" : "#");
      url = url + `${key}=${query[key]}`;
      hasHash = true;
    }
    return url;
  }

  getRouteInfo(): RouteInfo {
    const route = window.location.pathname.slice(1);
    const query = {};
    for (let part of window.location.hash.slice(1).split("?")) {
      let [key, value] = part.split("=");
      query[key] = value;
    }
    return { route, query, title: document.title };
  }
}
