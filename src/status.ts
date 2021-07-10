import type { Component } from "./core/component";

export const enum STATUS {
  NEW,
  WILLSTARTED, // willstart has been called
  CREATED, // after first render is complete
  MOUNTED, // is ready, and in DOM. It has a valid el
  UNMOUNTED, // has a valid el, but is no longer in DOM
  DESTROYED,
}

type STATUS_DESCR = "new" | "willstarted" | "created" | "mounted" | "unmounted" | "destroyed";

export function status(component: Component): STATUS_DESCR {
  switch (component.__owl__.status) {
    case STATUS.NEW:
      return "new";
    case STATUS.WILLSTARTED:
      return "willstarted";
    case STATUS.CREATED:
      return "created";
    case STATUS.MOUNTED:
      return "mounted";
    case STATUS.UNMOUNTED:
      return "unmounted";
    case STATUS.DESTROYED:
      return "destroyed";
  }
}
