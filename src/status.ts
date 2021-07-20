import type { Component } from "./component";

export const enum STATUS {
  NEW,
  MOUNTED, // is ready, and in DOM. It has a valid el
  DESTROYED,
}

type STATUS_DESCR = "new" | "mounted" | "destroyed";

export function status(component: Component): STATUS_DESCR {
  switch (component.__owl__.status) {
    case STATUS.NEW:
      return "new";
    case STATUS.MOUNTED:
      return "mounted";
    case STATUS.DESTROYED:
      return "destroyed";
  }
}
