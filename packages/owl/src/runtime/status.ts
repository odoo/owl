import type { Component } from "./component";
import { Plugin } from "./plugin_manager";

// -----------------------------------------------------------------------------
//  Status
// -----------------------------------------------------------------------------

export const STATUS = {
  NEW: 0,
  MOUNTED: 1, // is ready, and in DOM. It has a valid el
  // component has been created, but has been replaced by a newer component before being mounted
  // it is cancelled until the next animation frame where it will be destroyed
  CANCELLED: 2,
  DESTROYED: 3,
} as const;
export type STATUS = (typeof STATUS)[keyof typeof STATUS];

type STATUS_DESCR = "new" | "started" | "mounted" | "cancelled" | "destroyed";

export function status(entity: Component | Plugin): STATUS_DESCR {
  switch (entity.__owl__.status) {
    case STATUS.NEW:
      return "new";
    case STATUS.CANCELLED:
      return "cancelled";
    case STATUS.MOUNTED:
      return entity instanceof Plugin ? "started" : "mounted";
    case STATUS.DESTROYED:
      return "destroyed";
  }
}
