import type { Component } from "./component";

// -----------------------------------------------------------------------------
//  Status
// -----------------------------------------------------------------------------

export const enum STATUS {
  NEW,
  MOUNTED, // is ready, and in DOM. It has a valid el
  // component has been created, but has been replaced by a newer component before being mounted
  // it is cancelled until the next animation frame where it will be destroyed
  CANCELLED,
  DESTROYED,
}

type STATUS_DESCR = "new" | "mounted" | "cancelled" | "destroyed";

export function status(component: Component): STATUS_DESCR {
  switch (component.__owl__.status) {
    case STATUS.NEW:
      return "new";
    case STATUS.CANCELLED:
      return "cancelled";
    case STATUS.MOUNTED:
      return "mounted";
    case STATUS.DESTROYED:
      return "destroyed";
  }
}
